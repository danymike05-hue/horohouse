import {
  BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit, ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import {
  LanguageCourse, LanguageCourseDocument, LanguageProfile, LanguageProfileDocument,
} from './schemas/language.schemas';
import {
  CompleteLessonDto, CourseDto, DraftDto, LessonDto, UnitDto, UpdateCourseDto, UpdateLanguageProfileDto, UpdateLessonDto,
} from './dto/languages.dto';
import { starterCourses } from './seed/build';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';

/** XP rules: a new lesson 10 (+5 with no mistakes), a lesson done again 5; at most 300 a day */
const XP_NEW = 10;
const XP_PERFECT_BONUS = 5;
const XP_REPEAT = 5;
const XP_DAILY_CAP = 300;

/** Days in Cameroon time (UTC+1, no daylight saving) */
const dayKey = (offsetDays = 0) => new Date(Date.now() + 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
function weekKey(): string {
  const d = new Date(Date.now() + 3600_000);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class LanguagesService implements OnModuleInit {
  private readonly logger = new Logger(LanguagesService.name);

  constructor(
    @InjectModel(LanguageCourse.name) private courseModel: Model<LanguageCourseDocument>,
    @InjectModel(LanguageProfile.name) private profileModel: Model<LanguageProfileDocument>,
    private notifications: NotificationsService,
    private config: ConfigService,
  ) {}

  /** First start: put the starter courses in (only when there are none) */
  async onModuleInit() {
    try {
      if (await this.courseModel.estimatedDocumentCount()) return;
      await this.courseModel.insertMany(starterCourses());
      this.logger.log('Language starter courses added');
    } catch (err: any) {
      this.logger.warn(`Could not add starter courses: ${err?.message}`);
    }
  }

  // ── Learner ─────────────────────────────────────────────────────────────────

  private async profileOf(userId: string): Promise<LanguageProfileDocument> {
    const uid = new Types.ObjectId(userId);
    return this.profileModel.findOneAndUpdate({ userId: uid }, { $setOnInsert: { userId: uid } }, { upsert: true, new: true });
  }

  /** Today's numbers reset at midnight, the week's on Monday; a missed day breaks the streak */
  private fresh(p: LanguageProfileDocument) {
    const today = dayKey();
    const brokenStreak = !!p.lastDay && p.lastDay !== today && p.lastDay !== dayKey(-1);
    return {
      streak: brokenStreak ? 0 : p.streak,
      longestStreak: p.longestStreak,
      dailyGoal: p.dailyGoal,
      todayXp: p.todayKey === today ? p.todayXp : 0,
      weekXp: p.weekKey === weekKey() ? p.weekXp : 0,
      totalXp: p.totalXp,
      reminders: p.reminders,
      doneToday: p.lastDay === today,
    };
  }

  async me(userId: string) {
    return this.fresh(await this.profileOf(userId));
  }

  async updateMe(userId: string, dto: UpdateLanguageProfileDto) {
    await this.profileModel.updateOne({ userId: new Types.ObjectId(userId) }, { $set: dto }, { upsert: true });
    return this.me(userId);
  }

  async courses(userId: string, uiLang?: string) {
    const [docs, profile] = await Promise.all([
      this.courseModel.find({ isPublished: true }).sort({ order: 1 }).lean(),
      this.profileOf(userId),
    ]);
    const progress = new Map(profile.courses.map((c) => [String(c.courseId), c]));
    return {
      profile: this.fresh(profile),
      courses: docs.map((c: any) => {
        const lessons = this.lessonsOf(c);
        const mine = progress.get(String(c._id));
        const completed = lessons.filter((l) => mine?.completed.includes(String(l._id))).length;
        return {
          _id: String(c._id), slug: c.slug, targetLang: c.targetLang, baseLang: c.baseLang,
          title: c.title?.[uiLang === 'fr' ? 'fr' : 'en'] ?? c.title?.en,
          description: c.description?.[uiLang === 'fr' ? 'fr' : 'en'] ?? c.description?.en,
          lessons: lessons.length, completed, xp: mine?.xp ?? 0, started: !!mine,
        };
      }),
    };
  }

  /** Published lessons in order, with their unit */
  private lessonsOf(c: any) {
    return (c.units ?? []).flatMap((u: any) => (u.lessons ?? []).filter((l: any) => l.isPublished !== false).map((l: any) => ({ ...l, unitId: u._id })));
  }

  async path(userId: string, courseId: string, uiLang?: string) {
    const c = await this.findCourse(courseId, true);
    const profile = await this.profileOf(userId);
    const done = new Set(profile.courses.find((x) => String(x.courseId) === String(c._id))?.completed ?? []);
    let currentGiven = false;
    const units = (c.units ?? []).map((u: any) => ({
      _id: String(u._id), title: u.title, level: u.level, description: u.description,
      lessons: (u.lessons ?? []).filter((l: any) => l.isPublished !== false).map((l: any) => {
        const id = String(l._id);
        let state: 'done' | 'current' | 'locked' = 'locked';
        if (done.has(id)) state = 'done';
        else if (!currentGiven) { state = 'current'; currentGiven = true; }
        return { _id: id, title: l.title, exercises: l.exercises?.length ?? 0, state };
      }),
    }));
    return {
      course: {
        _id: String(c._id), targetLang: c.targetLang, baseLang: c.baseLang,
        title: c.title?.[uiLang === 'fr' ? 'fr' : 'en'] ?? c.title?.en,
      },
      units,
      profile: this.fresh(profile),
    };
  }

  async lesson(userId: string, courseId: string, lessonId: string) {
    const c = await this.findCourse(courseId, true);
    const { lesson, unlocked } = await this.locate(userId, c, lessonId);
    if (!unlocked) throw new ForbiddenException('Finish the previous lessons first');
    return {
      _id: String(lesson._id), title: lesson.title, targetLang: c.targetLang, baseLang: c.baseLang,
      exercises: (lesson.exercises ?? []).map((e: any) => ({ ...e, _id: String(e._id) })),
    };
  }

  /** Finishing a lesson: XP decided here (not by the app), streak and daily goal updated */
  async complete(userId: string, courseId: string, lessonId: string, dto: CompleteLessonDto) {
    const c = await this.findCourse(courseId, true);
    const { lesson, unlocked, alreadyDone } = await this.locate(userId, c, lessonId);
    if (!unlocked) throw new ForbiddenException('Finish the previous lessons first');
    if (dto.mistakes > dto.total) throw new BadRequestException('More mistakes than exercises');
    const exCount = lesson.exercises?.length ?? 0;
    if (exCount && dto.total < Math.min(exCount, 3)) throw new BadRequestException('Lesson not finished');

    const p = await this.profileOf(userId);
    const now = this.fresh(p);
    const today = dayKey();
    let xp = alreadyDone ? XP_REPEAT : XP_NEW + (dto.mistakes === 0 ? XP_PERFECT_BONUS : 0);
    xp = Math.max(0, Math.min(xp, XP_DAILY_CAP - now.todayXp));

    // Streak: +1 on the first lesson of a new day, back to 1 after a missed day
    let streak = now.streak;
    if (p.lastDay !== today) streak = p.lastDay === dayKey(-1) ? p.streak + 1 : 1;
    const goalBefore = now.todayXp >= p.dailyGoal;
    const todayXp = now.todayXp + xp;

    const courses = [...p.courses];
    const i = courses.findIndex((x) => String(x.courseId) === String(c._id));
    const entry = i >= 0 ? { ...courses[i] } : { courseId: c._id as Types.ObjectId, completed: [] as string[], xp: 0 };
    if (!entry.completed.includes(String(lesson._id))) entry.completed = [...entry.completed, String(lesson._id)];
    entry.xp = (entry.xp ?? 0) + xp;
    if (i >= 0) courses[i] = entry; else courses.push(entry);

    await this.profileModel.updateOne({ _id: p._id }, {
      $set: {
        streak, longestStreak: Math.max(p.longestStreak, streak), lastDay: today,
        todayKey: today, todayXp, totalXp: p.totalXp + xp,
        weekKey: weekKey(), weekXp: now.weekXp + xp, courses,
      },
    });
    return {
      xpGained: xp,
      perfect: dto.mistakes === 0,
      streak,
      streakGrew: p.lastDay !== today,
      goalReached: !goalBefore && todayXp >= p.dailyGoal,
      todayXp,
      dailyGoal: p.dailyGoal,
      capped: xp === 0 && now.todayXp >= XP_DAILY_CAP,
    };
  }

  private async locate(userId: string, c: any, lessonId: string) {
    const lessons = this.lessonsOf(c);
    const idx = lessons.findIndex((l: any) => String(l._id) === lessonId);
    if (idx < 0) throw new NotFoundException('Lesson not found');
    const profile = await this.profileOf(userId);
    const done = new Set(profile.courses.find((x) => String(x.courseId) === String(c._id))?.completed ?? []);
    const alreadyDone = done.has(lessonId);
    // Open: done before, or every earlier lesson is done
    const unlocked = alreadyDone || lessons.slice(0, idx).every((l: any) => done.has(String(l._id)));
    return { lesson: lessons[idx], unlocked, alreadyDone };
  }

  private async findCourse(id: string, publishedOnly: boolean): Promise<any> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Course not found');
    const c = await this.courseModel.findOne({ _id: id, ...(publishedOnly ? { isPublished: true } : {}) }).lean();
    if (!c) throw new NotFoundException('Course not found');
    return c;
  }

  // ── Admins ──────────────────────────────────────────────────────────────────

  adminCourses() {
    return this.courseModel.find().sort({ order: 1 }).lean();
  }

  async createCourse(dto: CourseDto) {
    if (dto.targetLang === dto.baseLang) throw new BadRequestException('The course and explanation languages must differ');
    if (await this.courseModel.exists({ slug: dto.slug })) throw new BadRequestException('That slug is taken');
    const count = await this.courseModel.countDocuments();
    return this.courseModel.create({
      slug: dto.slug, targetLang: dto.targetLang, baseLang: dto.baseLang, order: count + 1,
      title: { en: dto.titleEn, fr: dto.titleFr },
      description: { en: dto.descriptionEn ?? '', fr: dto.descriptionFr ?? '' },
    });
  }

  async updateCourse(id: string, dto: UpdateCourseDto) {
    const set: any = {};
    if (dto.titleEn !== undefined) set['title.en'] = dto.titleEn;
    if (dto.titleFr !== undefined) set['title.fr'] = dto.titleFr;
    if (dto.descriptionEn !== undefined) set['description.en'] = dto.descriptionEn;
    if (dto.descriptionFr !== undefined) set['description.fr'] = dto.descriptionFr;
    if (dto.isPublished !== undefined) set.isPublished = dto.isPublished;
    if (dto.order !== undefined) set.order = dto.order;
    const c = await this.courseModel.findByIdAndUpdate(this.oid(id), { $set: set }, { new: true }).lean();
    if (!c) throw new NotFoundException('Course not found');
    return c;
  }

  async deleteCourse(id: string) {
    const res = await this.courseModel.deleteOne({ _id: this.oid(id) });
    if (!res.deletedCount) throw new NotFoundException('Course not found');
    return { deleted: true };
  }

  async addUnit(courseId: string, dto: UnitDto) {
    return this.mutate(courseId, (c) => { c.units.push({ title: dto.title, description: dto.description, level: dto.level ?? 'A1', lessons: [] }); });
  }

  async updateUnit(courseId: string, unitId: string, dto: UnitDto) {
    return this.mutate(courseId, (c) => {
      const u = this.unit(c, unitId);
      u.title = dto.title;
      if (dto.description !== undefined) u.description = dto.description;
      if (dto.level) u.level = dto.level;
    });
  }

  async moveUnit(courseId: string, unitId: string, dir: 'up' | 'down') {
    return this.mutate(courseId, (c) => {
      const i = c.units.findIndex((u: any) => String(u._id) === unitId);
      const j = dir === 'up' ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= c.units.length) return;
      [c.units[i], c.units[j]] = [c.units[j], c.units[i]];
    });
  }

  async deleteUnit(courseId: string, unitId: string) {
    return this.mutate(courseId, (c) => { this.unit(c, unitId); c.units = c.units.filter((u: any) => String(u._id) !== unitId); });
  }

  async addLesson(courseId: string, unitId: string, dto: LessonDto) {
    return this.mutate(courseId, (c) => { this.unit(c, unitId).lessons.push({ title: dto.title, exercises: [], isPublished: false }); });
  }

  async updateLesson(courseId: string, unitId: string, lessonId: string, dto: UpdateLessonDto) {
    return this.mutate(courseId, (c) => {
      const l = this.unit(c, unitId).lessons.find((x: any) => String(x._id) === lessonId);
      if (!l) throw new NotFoundException('Lesson not found');
      if (dto.title !== undefined) l.title = dto.title;
      if (dto.isPublished !== undefined) l.isPublished = dto.isPublished;
      if (dto.exercises) l.exercises = dto.exercises.map((e) => this.cleanExercise(e));
    });
  }

  async deleteLesson(courseId: string, unitId: string, lessonId: string) {
    return this.mutate(courseId, (c) => {
      const u = this.unit(c, unitId);
      u.lessons = u.lessons.filter((x: any) => String(x._id) !== lessonId);
    });
  }

  /** Each exercise type needs its own pieces; refuse ones that couldn't be answered */
  private cleanExercise(e: any) {
    const trim = (a?: string[]) => (a ?? []).map((x) => String(x).trim()).filter(Boolean);
    const out = { ...e, answers: trim(e.answers), options: trim(e.options), pairs: (e.pairs ?? []).filter((p: any) => p.left?.trim() && p.right?.trim()) };
    const bad = (msg: string) => { throw new BadRequestException(`Exercise "${e.prompt || e.type}": ${msg}`); };
    if (e.type === 'match') { if (out.pairs.length < 2) bad('needs at least 2 pairs'); }
    else {
      if (!out.prompt?.trim()) bad('needs a prompt');
      if (!out.answers.length) bad('needs an answer');
      if ((e.type === 'choice' || e.type === 'fill') && (out.options.length < 2 || !out.options.includes(out.answers[0]))) bad('options must include the answer');
      if (e.type === 'fill' && !out.prompt.includes('___')) bad('the prompt needs ___ where the word goes');
      if (e.type === 'tiles' && out.options.length < 2) bad('needs word tiles');
    }
    return out;
  }

  private async mutate(courseId: string, fn: (c: any) => void) {
    const c: any = await this.courseModel.findById(this.oid(courseId));
    if (!c) throw new NotFoundException('Course not found');
    fn(c);
    c.markModified('units');
    await c.save();
    return c.toObject();
  }

  private unit(c: any, unitId: string) {
    const u = c.units.find((x: any) => String(x._id) === unitId);
    if (!u) throw new NotFoundException('Unit not found');
    return u;
  }

  private oid(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Not found');
    return new Types.ObjectId(id);
  }

  /** AI first draft of a lesson for an admin to review (needs OPENAI_API_KEY on the server) */
  async draft(dto: DraftDto) {
    const key = this.config.get<string>('OPENAI_API_KEY');
    if (!key) throw new ServiceUnavailableException('AI drafts need OPENAI_API_KEY on the server');
    const names: Record<string, string> = { fr: 'French', en: 'English', zh: 'Mandarin Chinese (simplified characters)' };
    const prompt = [
      `Write a ${dto.level ?? 'A1'} lesson to learn ${names[dto.targetLang]} for speakers of ${names[dto.baseLang]}, theme: "${dto.theme}".`,
      'Context: university students in Cameroon. Use natural, correct, everyday language.',
      'Return JSON {"exercises": [...]} with 10 to 12 exercises. Each exercise has:',
      'type: "choice" | "tiles" | "type" | "match" | "fill";',
      'instruction: "meaning" (choice), "translate" (tiles, type), "pairs" (match), "complete" (fill);',
      'prompt: the text shown (for fill, a target-language sentence with ___ where one word goes; empty for match);',
      `promptRomanization: pinyin when the prompt is Chinese, else omit;`,
      'answers: accepted answers, best first; options: for choice/fill 4 options including the answer, for tiles the words of the answer plus 2-3 wrong words;',
      'pairs: for match, 4 objects {left: target text, right: base text}.',
      'Chinese tiles are words (not single letters). Never include the answer in the prompt.',
    ].join('\n');
    let res: Response;
    try {
      res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: this.config.get<string>('OPENAI_MODEL') || 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
        }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new ServiceUnavailableException('The AI service could not be reached');
    }
    if (!res.ok) throw new ServiceUnavailableException('The AI service refused the request');
    const data: any = await res.json();
    let parsed: any;
    try { parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}'); } catch { parsed = {}; }
    const list = Array.isArray(parsed.exercises) ? parsed.exercises : [];
    // Keep only usable ones; the admin reviews everything before publishing
    const usable: any[] = [];
    for (const e of list.slice(0, 15)) {
      try {
        usable.push(this.cleanExercise({
          type: e.type, instruction: e.instruction, prompt: String(e.prompt ?? ''), promptRomanization: e.promptRomanization,
          promptLang: e.type === 'choice' || e.type === 'type' || e.type === 'fill' ? dto.targetLang : dto.baseLang,
          answers: Array.isArray(e.answers) ? e.answers.map(String) : [], options: Array.isArray(e.options) ? e.options.map(String) : [],
          pairs: Array.isArray(e.pairs) ? e.pairs.map((p: any) => ({ left: String(p.left ?? ''), right: String(p.right ?? '') })) : [],
          answerLang: e.type === 'tiles' || e.type === 'fill' ? dto.targetLang : dto.baseLang,
        }));
      } catch { /* skip a broken one */ }
    }
    if (!usable.length) throw new ServiceUnavailableException('The AI draft was not usable; try another theme');
    return { exercises: usable };
  }

  // ── Evening reminder: keep the streak going ───────────────────────────────

  @Cron('0 19 * * *', { name: 'language-streak-reminders', timeZone: 'Africa/Douala' })
  async remindStreaks() {
    const today = dayKey();
    const atRisk = await this.profileModel
      .find({ reminders: true, streak: { $gt: 0 }, lastDay: dayKey(-1), remindedDay: { $ne: today } })
      .select('userId streak').limit(2000).lean();
    let sent = 0;
    for (const p of atRisk) {
      const claimed = await this.profileModel.updateOne({ _id: p._id, remindedDay: { $ne: today } }, { $set: { remindedDay: today } });
      if (!claimed.modifiedCount) continue;
      await this.notifications.create(
        {
          userId: String(p.userId), type: NotificationType.SYSTEM,
          title: `Keep your ${p.streak}-day streak`,
          message: 'One short lesson tonight keeps it going.',
          link: '/languages',
        } as any,
        { title: `Gardez votre série de ${p.streak} jours`, message: 'Une petite leçon ce soir suffit pour la continuer.' },
      ).catch(() => undefined);
      sent++;
    }
    if (sent) this.logger.log(`Sent ${sent} language streak reminder(s)`);
  }
}
