import {
  BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit, ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import {
  LanguageCourse, LanguageCourseDocument, LanguageFollow, LanguageFollowDocument, LanguageMemory, LanguageMemoryDocument,
  LanguageProfile, LanguageProfileDocument,
} from './schemas/language.schemas';
import { Subscription, SubscriptionDocument, SubscriptionStatus } from '../payments/schemas/subscription.schema';
import { BADGES, badgeIdsFor } from './badges';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  CompleteLessonDto, CourseDto, DraftDto, ExerciseResultDto, ExplainDto, LessonDto, ResultsDto, StoryCompleteDto, UnitDto,
  UpdateCourseDto, UpdateLanguageProfileDto, UpdateLessonDto,
} from './dto/languages.dto';
import { starterCourses } from './seed/build';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';

/** XP rules: a new lesson 10 (+5 with no mistakes), a lesson done again 5; at most 300 a day */
const XP_NEW = 10;
const XP_PERFECT_BONUS = 5;
const XP_REPEAT = 5;
const XP_DAILY_CAP = 300;
/** Practice: 5 XP, +1 for every 2 right answers, at most 10 */
const XP_PRACTICE_BASE = 5;
const XP_PRACTICE_MAX = 10;
/** Days until the next review, by box (0 = due now) */
const BOX_DAYS = [0, 1, 3, 7, 14, 30];
/** Placement: questions per unit, and how many must be right to skip the unit */
// Placement goes level by level (A1, A2, B1…): a few questions per level, spread over its units
const PLACEMENT_PER_LEVEL = 4;
const PLACEMENT_PASS = 3;
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** A profile's per-course progress as plain objects that are safe to copy and change */
function plainCourses(p: any): any[] {
  const list = typeof p?.toObject === 'function' ? p.toObject().courses : p?.courses;
  return (list ?? []).map((x: any) => ({ ...x, completed: [...(x.completed ?? [])] }));
}

/** Units grouped by CEFR level, in level order (units without a known level count as A1) */
function levelGroups(units: any[]): { level: string; units: any[] }[] {
  const by = new Map<string, any[]>();
  for (const u of units) {
    const lv = LEVELS.includes(u.level) ? u.level : 'A1';
    by.set(lv, [...(by.get(lv) ?? []), u]);
  }
  return LEVELS.filter((lv) => by.has(lv)).map((level) => ({ level, units: by.get(level)! }));
}
/** Stars earned (spent in the shop) */
const STARS = { lesson: 5, perfect: 5, practice: 2, checkpoint: 15, story: 5, mock: 10 } as const;
/** Lives: 5 at most, one back every 3 hours; an active plan means unlimited */
const LIVES_MAX = 5;
const LIFE_MS = 3 * 3600_000;
/** Streak freezes: hold at most 2; one earned every 7 days of streak */
const FREEZE_MAX = 2;
const SHOP = { freeze: 50, refill: 30 } as const;
/** Checkpoint: questions, and share needed to pass */
const CHECKPOINT_SIZE = 10;
const CHECKPOINT_PASS = 0.7;
const MOCK_SIZE = 20;
const DIVISIONS = 5;

/** Whole days between two YYYY-MM-DD keys */
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
/** Hour of the day in Cameroon */
const hourNow = () => new Date(Date.now() + 3600_000).getUTCHours();
/** Last week's Monday key */
const lastWeekKey = () => {
  const d = new Date(`${weekKey()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
};

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
    @InjectModel(LanguageMemory.name) private memoryModel: Model<LanguageMemoryDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(LanguageFollow.name) private followModel: Model<LanguageFollowDocument>,
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
    private notifications: NotificationsService,
    private config: ConfigService,
  ) {}

  /** First start: put the starter courses in (only when there are none) */
  async onModuleInit() {
    try {
      await this.syncStarterContent();
    } catch (err: any) {
      this.logger.warn(`Could not add starter courses: ${err?.message}`);
    }
  }

  /**
   * Starter content: new courses are inserted; existing ones only get the starter units they
   * don't have yet (matched by seedKey, or by title for units added before seedKey existed).
   * Nothing an admin changed is overwritten.
   */
  private async syncStarterContent() {
    for (const seed of starterCourses()) {
      const existing: any = await this.courseModel.findOne({ slug: seed.slug });
      if (!existing) {
        await this.courseModel.create(seed);
        this.logger.log(`Language course added: ${seed.slug}`);
        continue;
      }
      let changed = false;
      (seed.units as any[]).forEach((su: any, i: number) => {
        // Tag an older copy of this starter unit with its key: same title, or (if an admin
        // renamed it) the untagged unit in the same position
        const untagged = existing.units.find((u: any) => !u.seedKey && u.title === su.title)
          ?? (existing.units[i] && !existing.units[i].seedKey && !existing.units.some((u: any) => u.seedKey === su.seedKey)
            // Same position only counts if it looks like the same unit (an admin's own unit stays theirs)
            && existing.units[i].level === su.level && existing.units[i].lessons?.[0]?.title === su.lessons?.[0]?.title
            ? existing.units[i] : undefined);
        if (untagged) { untagged.seedKey = su.seedKey; changed = true; }
        if (!existing.units.some((u: any) => u.seedKey === su.seedKey)) {
          existing.units.push(su);
          changed = true;
          this.logger.log(`Starter unit added to ${seed.slug}: ${su.title} (#${i + 1})`);
        }
      });
      // Tips for starter units, only where none were written; listening and speaking added to
      // starter lessons that predate them (nothing else in the lesson is touched)
      for (const su of seed.units as any[]) {
        const u = existing.units.find((x: any) => x.seedKey === su.seedKey);
        if (!u) continue;
        if (!u.tips && su.tips) { u.tips = su.tips; changed = true; }
        (su.lessons ?? []).forEach((sl: any, li: number) => {
          const l = u.lessons?.[li];
          if (!l || l.title !== sl.title) return;
          if ((l.exercises ?? []).some((e: any) => e.type === 'listen' || e.type === 'speak')) return;
          const extra = (sl.exercises ?? []).filter((e: any) => e.type === 'listen' || e.type === 'speak');
          if (extra.length) { l.exercises = [...(l.exercises ?? []), ...extra]; changed = true; }
        });
      }
      // Starter stories, by seedKey
      existing.stories = existing.stories ?? [];
      for (const st of (seed as any).stories ?? []) {
        if (!existing.stories.some((x: any) => x.seedKey === st.seedKey)) { existing.stories.push(st); changed = true; }
      }
      if (changed) {
        existing.markModified('units');
        existing.markModified('stories');
        await existing.save();
      }
    }
  }

  // ── Learner ─────────────────────────────────────────────────────────────────

  private async profileOf(userId: string): Promise<LanguageProfileDocument> {
    const uid = new Types.ObjectId(userId);
    return this.profileModel.findOneAndUpdate({ userId: uid }, { $setOnInsert: { userId: uid } }, { upsert: true, new: true });
  }

  /** Today's numbers reset at midnight, the week's on Monday; a missed day breaks the streak */
  private fresh(p: LanguageProfileDocument, unlimited = false) {
    const today = dayKey();
    const missed = p.lastDay ? daysBetween(p.lastDay, today) - 1 : 0;
    const brokenStreak = !!p.lastDay && missed > 0 && missed > (p.freezes ?? 0);
    return {
      streak: brokenStreak ? 0 : p.streak,
      freezes: p.freezes ?? 0,
      /** Days the next lesson will cover with freezes */
      freezeUsedOnNext: !brokenStreak && missed > 0 ? missed : 0,
      stars: p.stars ?? 0,
      lives: unlimited ? LIVES_MAX : this.livesNow(p),
      livesMax: LIVES_MAX,
      unlimitedLives: unlimited,
      nextLifeAt: unlimited || this.livesNow(p) >= LIVES_MAX ? null : new Date((p.livesAt ? new Date(p.livesAt).getTime() : Date.now()) + LIFE_MS * (Math.floor((Date.now() - (p.livesAt ? new Date(p.livesAt).getTime() : Date.now())) / LIFE_MS) + 1)).toISOString(),
      division: p.division ?? 0,
      badges: (p.badges ?? []).length,
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
    return this.fresh(await this.profileOf(userId), await this.hasPlan(userId));
  }

  /** Lives right now, counting the ones that came back since */
  private livesNow(p: any): number {
    const stored = p.lives ?? LIVES_MAX;
    if (stored >= LIVES_MAX || !p.livesAt) return Math.min(LIVES_MAX, stored);
    const back = Math.floor((Date.now() - new Date(p.livesAt).getTime()) / LIFE_MS);
    return Math.min(LIVES_MAX, stored + Math.max(0, back));
  }

  /** Lives after a change, keeping the regeneration clock right */
  private livesPatch(p: any, delta: number) {
    const now = this.livesNow(p);
    const next = Math.max(0, Math.min(LIVES_MAX, now + delta));
    // The clock restarts when dropping below the maximum
    const livesAt = next >= LIVES_MAX ? undefined
      : now >= LIVES_MAX || !p.livesAt ? new Date()
        : new Date(new Date(p.livesAt).getTime() + Math.floor((Date.now() - new Date(p.livesAt).getTime()) / LIFE_MS) * LIFE_MS);
    return { lives: next, livesAt };
  }

  /** An active paid plan means unlimited lives */
  private async hasPlan(userId: string): Promise<boolean> {
    const sub = await this.subscriptionModel.exists({
      userId: new Types.ObjectId(userId), status: SubscriptionStatus.ACTIVE,
      $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gt: new Date() } }],
    });
    return !!sub;
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
    const unlimited = await this.hasPlan(userId);
    return {
      profile: this.fresh(profile, unlimited),
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
    const mine = profile.courses.find((x) => String(x.courseId) === String(c._id));
    const done = new Set(mine?.completed ?? []);
    const gold = new Set(mine?.gold ?? []);
    const checkpoints = new Set(mine?.checkpoints ?? []);
    const storiesDone = new Set(mine?.stories ?? []);
    let currentGiven = false;
    const units = (c.units ?? []).map((u: any) => {
      const lessons = (u.lessons ?? []).filter((l: any) => l.isPublished !== false).map((l: any) => {
        const id = String(l._id);
        let state: 'done' | 'current' | 'locked' = 'locked';
        if (done.has(id)) state = 'done';
        else if (!currentGiven) { state = 'current'; currentGiven = true; }
        return { _id: id, title: l.title, exercises: l.exercises?.length ?? 0, state, gold: gold.has(id) };
      });
      const allDone = lessons.length > 0 && lessons.every((l: any) => l.state === 'done');
      // Stories that follow this unit
      const stories = (c.stories ?? []).filter((st: any) => st.isPublished !== false && st.unitSeedKey && st.unitSeedKey === u.seedKey)
        .map((st: any) => ({ _id: String(st._id), title: st.title, done: storiesDone.has(String(st._id)), open: allDone }));
      return {
        _id: String(u._id), title: u.title, level: u.level, description: u.description, tips: u.tips || null,
        lessons, stories, checkpoint: { open: allDone, passed: checkpoints.has(String(u._id)) },
      };
    });
    return {
      course: {
        _id: String(c._id), targetLang: c.targetLang, baseLang: c.baseLang,
        title: c.title?.[uiLang === 'fr' ? 'fr' : 'en'] ?? c.title?.en,
      },
      units,
      profile: this.fresh(profile, await this.hasPlan(userId)),
      dueCount: await this.dueCount(userId, c._id),
      mistakesCount: await this.memoryModel.countDocuments({ userId: new Types.ObjectId(userId), courseId: c._id, wrong: { $gt: 0 }, box: { $lte: 1 } }),
      bestMock: mine?.bestMock ?? 0,
      finished: done.size,
    };
  }

  async lesson(userId: string, courseId: string, lessonId: string) {
    const c = await this.findCourse(courseId, true);
    const { lesson, unlocked } = await this.locate(userId, c, lessonId);
    if (!unlocked) throw new ForbiddenException('Finish the previous lessons first');
    const p = await this.profileOf(userId);
    const unlimited = await this.hasPlan(userId);
    if (!unlimited && this.livesNow(p) <= 0) {
      throw new ForbiddenException({ code: 'NO_LIVES', message: 'You are out of lives. Practise or wait for one to come back.' });
    }
    return {
      lives: unlimited ? null : this.livesNow(p),
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

    // Only this lesson's own exercises go into the review schedule
    const own = new Set((lesson.exercises ?? []).map((e: any) => String(e._id)));
    await this.remember(userId, c._id, (dto.results ?? []).filter((r) => own.has(r.exerciseId)));
    const wanted = alreadyDone ? XP_REPEAT : XP_NEW + (dto.mistakes === 0 ? XP_PERFECT_BONUS : 0);
    return this.award(userId, c, wanted, dto.mistakes === 0, {
      kind: 'lesson', lessonId: String(lesson._id), alreadyDone, mistakes: Math.min(dto.mistakes, dto.livesLost ?? dto.mistakes),
    });
  }

  /**
   * One place for everything a finished activity gives: XP (daily cap), stars, streak (freezes
   * cover missed days, a new one every 7 days), lives, gold lessons, badges and activity.
   */
  private async award(
    userId: string, c: any, wanted: number, perfect: boolean,
    opts: {
      kind: 'lesson' | 'practice' | 'checkpoint' | 'story' | 'mock';
      lessonId?: string; alreadyDone?: boolean; mistakes?: number; unitId?: string; storyId?: string; mockScore?: number;
    },
  ) {
    const p: any = await this.profileOf(userId);
    const unlimited = await this.hasPlan(userId);
    const now = this.fresh(p, unlimited);
    const today = dayKey();
    const xp = Math.max(0, Math.min(wanted, XP_DAILY_CAP - now.todayXp));

    // Streak: +1 on the first activity of a new day; freezes cover missed days
    let streak = now.streak;
    let freezes = p.freezes ?? 0;
    let freezeUsed = 0;
    const firstToday = p.lastDay !== today;
    if (firstToday) {
      const missed = p.lastDay ? daysBetween(p.lastDay, today) - 1 : 0;
      if (!p.lastDay) streak = 1;
      else if (missed <= 0) streak = p.streak + 1;
      else if (missed <= freezes) { freezes -= missed; freezeUsed = missed; streak = p.streak + 1; }
      else streak = 1;
      if (streak > 0 && streak % 7 === 0) freezes = Math.min(FREEZE_MAX, freezes + 1);
    }
    const goalBefore = now.todayXp >= p.dailyGoal;
    const todayXp = now.todayXp + xp;

    // Stars
    let stars = 0;
    if (opts.kind === 'lesson') stars = opts.alreadyDone ? 1 : STARS.lesson + (perfect ? STARS.perfect : 0);
    else stars = STARS[opts.kind];

    // Per-course progress. Plain copies: spreading a Mongoose sub-document doesn't copy its
    // fields, which used to drop every lesson finished after the first one
    const courses: any[] = plainCourses(p);
    const i = courses.findIndex((x: any) => String(x.courseId) === String(c._id));
    const entry: any = i >= 0 ? { ...courses[i] } : { courseId: c._id as Types.ObjectId, completed: [], xp: 0, gold: [], checkpoints: [], stories: [], bestMock: 0 };
    const addTo = (k: string, v?: string) => { if (v && !(entry[k] ?? []).includes(v)) entry[k] = [...(entry[k] ?? []), v]; };
    if (opts.kind === 'lesson') {
      addTo('completed', opts.lessonId);
      // Gold: a finished lesson redone with no mistakes
      if (opts.alreadyDone && perfect) addTo('gold', opts.lessonId);
    }
    if (opts.kind === 'checkpoint') addTo('checkpoints', opts.unitId);
    if (opts.kind === 'story') addTo('stories', opts.storyId);
    if (opts.kind === 'mock') entry.bestMock = Math.max(entry.bestMock ?? 0, opts.mockScore ?? 0);
    entry.xp = (entry.xp ?? 0) + xp;
    if (i >= 0) courses[i] = entry; else courses.push(entry);

    // Lives: mistakes in a lesson cost one each; practice gives one back
    const lifeDelta = unlimited ? 0 : opts.kind === 'lesson' ? -(opts.mistakes ?? 0) : opts.kind === 'practice' ? 1 : 0;
    const lives = lifeDelta ? this.livesPatch(p, lifeDelta) : {};

    // Activity (for the weekly report and reminder timing)
    const activeDays = [...new Set([...(p.activeDays ?? []), today])].slice(-14);
    const activeHours = (p.activeHours?.length === 24 ? [...p.activeHours] : Array(24).fill(0));
    activeHours[hourNow()] += 1;

    const next: any = {
      ...p.toObject(), streak, freezes, courses, todayXp, totalXp: p.totalXp + xp,
      lessonsDone: (p.lessonsDone ?? 0) + (opts.kind === 'lesson' && !opts.alreadyDone ? 1 : 0),
      perfectLessons: (p.perfectLessons ?? 0) + (opts.kind === 'lesson' && perfect ? 1 : 0),
    };
    const newBadges = badgeIdsFor(next, opts).filter((id) => !(p.badges ?? []).some((b: any) => b.id === id));

    await this.profileModel.updateOne({ _id: p._id }, {
      $set: {
        streak, longestStreak: Math.max(p.longestStreak, streak), lastDay: today, freezes,
        todayKey: today, todayXp, totalXp: p.totalXp + xp, stars: (p.stars ?? 0) + stars,
        weekKey: weekKey(), weekXp: now.weekXp + xp, courses, activeDays, activeHours,
        lessonsDone: next.lessonsDone, perfectLessons: next.perfectLessons,
        ...lives,
      },
      ...(newBadges.length ? { $push: { badges: { $each: newBadges.map((id) => ({ id, at: new Date() })) } } } : {}),
    });
    return {
      xpGained: xp,
      starsGained: stars,
      perfect,
      streak,
      streakGrew: firstToday,
      freezeUsed,
      goalReached: !goalBefore && todayXp >= p.dailyGoal,
      todayXp,
      dailyGoal: p.dailyGoal,
      capped: xp === 0 && now.todayXp >= XP_DAILY_CAP,
      gold: opts.kind === 'lesson' && !!opts.alreadyDone && perfect,
      newBadges: newBadges.map((id) => ({ id, ...BADGES[id] })),
      lives: unlimited ? null : (lives as any).lives ?? this.livesNow(p),
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

  // ── Review schedule ─────────────────────────────────────────────────────────

  /** Move each answered exercise up a box (right) or back to box 0 (wrong) */
  private async remember(userId: string, courseId: any, results: ExerciseResultDto[]) {
    if (!results.length) return;
    const uid = new Types.ObjectId(userId);
    const cid = new Types.ObjectId(String(courseId));
    const existing = await this.memoryModel.find({ userId: uid, exerciseId: { $in: results.map((r) => r.exerciseId) } }).lean();
    const byId = new Map(existing.map((m) => [m.exerciseId, m]));
    const now = Date.now();
    const ops = results.map((r) => {
      const prev = byId.get(r.exerciseId);
      const box = r.correct ? Math.min(5, (prev?.box ?? 0) + 1) : 0;
      return {
        updateOne: {
          filter: { userId: uid, exerciseId: r.exerciseId },
          update: {
            $set: { courseId: cid, box, due: new Date(now + BOX_DAYS[box] * 86_400_000) },
            $inc: { seen: 1, wrong: r.correct ? 0 : 1 },
          },
          upsert: true,
        },
      };
    });
    await this.memoryModel.bulkWrite(ops as any, { ordered: false }).catch((e) => this.logger.warn(`Review schedule not saved: ${e?.message}`));
  }

  /** Every exercise of the lessons this learner finished, by id */
  private async finishedExercises(userId: string, c: any) {
    const profile = await this.profileOf(userId);
    const done = new Set(profile.courses.find((x) => String(x.courseId) === String(c._id))?.completed ?? []);
    const map = new Map<string, any>();
    for (const l of this.lessonsOf(c)) {
      if (!done.has(String(l._id))) continue;
      for (const e of l.exercises ?? []) map.set(String(e._id), { ...e, _id: String(e._id) });
    }
    return map;
  }

  /** Practice: what's due first (weakest box first), topped up with the least-known ones */
  async practice(userId: string, courseId: string, kind: 'review' | 'mistakes' = 'review') {
    const c = await this.findCourse(courseId, true);
    const pool = await this.finishedExercises(userId, c);
    if (!pool.size) throw new BadRequestException('Finish a lesson first, then practise it here');
    if (kind === 'mistakes') {
      // Recent mistakes not yet relearned
      const wrong = await this.memoryModel
        .find({ userId: new Types.ObjectId(userId), courseId: c._id, wrong: { $gt: 0 }, box: { $lte: 1 }, exerciseId: { $in: [...pool.keys()] } })
        .sort({ updatedAt: -1 }).limit(12).lean();
      if (!wrong.length) throw new BadRequestException('No mistakes to review. Nice!');
      return { dueCount: wrong.length, exercises: wrong.map((m) => pool.get(m.exerciseId)).filter(Boolean), targetLang: c.targetLang, baseLang: c.baseLang };
    }
    const memories = await this.memoryModel
      .find({ userId: new Types.ObjectId(userId), courseId: c._id, exerciseId: { $in: [...pool.keys()] } })
      .sort({ due: 1, box: 1 }).lean();
    const now = Date.now();
    const due = memories.filter((m) => new Date(m.due).getTime() <= now).sort((a, b) => a.box - b.box);
    const picked: string[] = due.slice(0, 12).map((m) => m.exerciseId);
    // Top up: exercises never reviewed, then the lowest boxes
    const known = new Map(memories.map((m) => [m.exerciseId, m.box]));
    const rest = [...pool.keys()]
      .filter((id) => !picked.includes(id))
      .sort((a, b) => (known.get(a) ?? -1) - (known.get(b) ?? -1) || Math.random() - 0.5);
    for (const id of rest) { if (picked.length >= 10) break; picked.push(id); }
    return {
      dueCount: due.length,
      exercises: picked.map((id) => pool.get(id)).filter(Boolean),
      targetLang: c.targetLang, baseLang: c.baseLang,
    };
  }

  async completePractice(userId: string, courseId: string, dto: ResultsDto) {
    const c = await this.findCourse(courseId, true);
    const pool = await this.finishedExercises(userId, c);
    const valid = dto.results.filter((r) => pool.has(r.exerciseId));
    if (valid.length < 3) throw new BadRequestException('Practice not finished');
    await this.remember(userId, c._id, valid);
    const right = valid.filter((r) => r.correct).length;
    const wanted = Math.min(XP_PRACTICE_MAX, XP_PRACTICE_BASE + Math.floor(right / 2));
    return this.award(userId, c, wanted, right === valid.length, { kind: 'practice' });
  }

  /** How many exercises are due for review in a course (for the "Practice" badge) */
  async dueCount(userId: string, courseId: any) {
    return this.memoryModel.countDocuments({ userId: new Types.ObjectId(userId), courseId: new Types.ObjectId(String(courseId)), due: { $lte: new Date() } });
  }

  // ── Placement test ──────────────────────────────────────────────────────────

  /** A few questions from each unit, in course order */
  async placement(userId: string, courseId: string) {
    const c = await this.findCourse(courseId, true);
    const prefer = ['choice', 'tiles', 'fill', 'type'];
    const questions: any[] = [];
    for (const group of levelGroups(c.units ?? [])) {
      // Round robin over the level's units, evenly spaced inside each
      const perUnit = group.units.map((u: any) => {
        const usable = (u.lessons ?? []).filter((l: any) => l.isPublished !== false).flatMap((l: any) => l.exercises ?? []).filter((e: any) => prefer.includes(e.type));
        const step = Math.max(1, Math.floor(usable.length / PLACEMENT_PER_LEVEL));
        return usable.filter((_: any, i: number) => i % step === 0).map((e: any) => ({ ...e, _id: String(e._id), unitId: String(u._id), level: group.level }));
      });
      const picked: any[] = [];
      for (let k = 0; picked.length < PLACEMENT_PER_LEVEL && perUnit.some((list) => list.length > k); k++) {
        for (const list of perUnit) if (list[k] && picked.length < PLACEMENT_PER_LEVEL) picked.push(list[k]);
      }
      questions.push(...picked);
    }
    return { questions, targetLang: c.targetLang, baseLang: c.baseLang };
  }

  /** Levels passed in a row from A1 are opened (their lessons count as done, no XP) */
  async submitPlacement(userId: string, courseId: string, dto: ResultsDto) {
    const c = await this.findCourse(courseId, true);
    const unitLevel = new Map<string, string>((c.units ?? []).map((u: any): [string, string] => [String(u._id), String(u.level || 'A1')]));
    const score = new Map<string, number>();
    const asked = new Map<string, number>();
    for (const r of dto.results) {
      const lv = r.unitId ? unitLevel.get(r.unitId) : undefined;
      if (!lv) continue;
      asked.set(lv, (asked.get(lv) ?? 0) + 1);
      if (r.correct) score.set(lv, (score.get(lv) ?? 0) + 1);
    }
    const passedUnits: any[] = [];
    let levelReached: string | null = null;
    for (const group of levelGroups(c.units ?? [])) {
      // 3 of 4 right; a level with fewer questions needs all but one (at least one)
      const n = Math.min(PLACEMENT_PER_LEVEL, asked.get(group.level) ?? 0);
      const need = n >= PLACEMENT_PER_LEVEL ? PLACEMENT_PASS : Math.max(1, n - 1);
      if (n > 0 && (score.get(group.level) ?? 0) >= need) { passedUnits.push(...group.units); levelReached = group.level; } else break;
    }
    const lessonIds = passedUnits.flatMap((u) => (u.lessons ?? []).filter((l: any) => l.isPublished !== false).map((l: any) => String(l._id)));
    if (lessonIds.length) {
      const p = await this.profileOf(userId);
      const courses: any[] = plainCourses(p);
      const i = courses.findIndex((x) => String(x.courseId) === String(c._id));
      const entry = i >= 0 ? { ...courses[i] } : { courseId: c._id as Types.ObjectId, completed: [] as string[], xp: 0 };
      entry.completed = [...new Set([...entry.completed, ...lessonIds])];
      if (i >= 0) courses[i] = entry; else courses.push(entry);
      await this.profileModel.updateOne({ _id: p._id }, { $set: { courses } });
    }
    return { unitsPassed: passedUnits.length, lessonsOpened: lessonIds.length, totalUnits: (c.units ?? []).length, levelReached };
  }

  // ── Leagues: this week's XP, within your campus and campus against campus ──

  async league(userId: string) {
    const week = weekKey();
    const me: any = await this.userModel.findById(userId).select('studentProfile.universityName').lean();
    const myCampus: string | undefined = me?.studentProfile?.universityName || undefined;
    const myProfile = await this.profileOf(userId);
    const myXp = myProfile.weekKey === week ? myProfile.weekXp : 0;

    // Learners with XP this week, with their name and campus
    const rows: any[] = await this.profileModel.aggregate([
      { $match: { weekKey: week, weekXp: { $gt: 0 } } },
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'u', pipeline: [{ $project: { name: 1, profilePicture: 1, 'studentProfile.universityName': 1 } }] } },
      { $unwind: '$u' },
      { $project: { userId: 1, weekXp: 1, streak: 1, division: 1, name: '$u.name', picture: '$u.profilePicture', campus: '$u.studentProfile.universityName' } },
    ]);
    // First name and initial only
    const short = (n?: string) => {
      const parts = String(n ?? '').trim().split(/\s+/).filter(Boolean);
      return parts.length ? `${parts[0]}${parts[1] ? ` ${parts[1][0]}.` : ''}` : '—';
    };
    const myDivision = myProfile.division ?? 0;
    // Your campus and your division (bronze … diamond)
    const group = (myCampus ? rows.filter((r) => r.campus === myCampus) : rows).filter((r) => (r.division ?? 0) === myDivision);
    const ranked = group.sort((a, b) => b.weekXp - a.weekXp);
    const myRank = myXp > 0 ? ranked.findIndex((r) => String(r.userId) === userId) + 1 : null;
    const following = new Set((await this.followModel.find({ userId: new Types.ObjectId(userId) }).select('followId').lean()).map((f) => String(f.followId)));
    const people = ranked.slice(0, 30).map((r, i) => ({
      id: String(r.userId), rank: i + 1, name: short(r.name), picture: r.picture, xp: r.weekXp, streak: r.streak,
      me: String(r.userId) === userId, following: following.has(String(r.userId)),
    }));
    // Promotion / relegation zones shown on the list (needs 5+ people)
    const zone = ranked.length >= 5 ? Math.max(1, Math.ceil(ranked.length * 0.2)) : 0;

    // Campus against campus: total XP this week
    const byCampus = new Map<string, { xp: number; learners: number }>();
    for (const r of rows) {
      if (!r.campus) continue;
      const cur = byCampus.get(r.campus) ?? { xp: 0, learners: 0 };
      cur.xp += r.weekXp; cur.learners += 1;
      byCampus.set(r.campus, cur);
    }
    const campuses = [...byCampus.entries()]
      .map(([name, v]) => ({ name, ...v, mine: name === myCampus }))
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 15)
      .map((x, i) => ({ rank: i + 1, ...x }));

    // Week ends Monday 00:00 Cameroon time
    const monday = new Date(`${week}T00:00:00+01:00`).getTime() + 7 * 86_400_000;
    return {
      scope: myCampus ? 'campus' : 'everyone',
      campus: myCampus ?? null,
      division: myDivision,
      promoteTop: myDivision < DIVISIONS - 1 ? zone : 0,
      relegateBottom: myDivision > 0 ? zone : 0,
      groupSize: ranked.length,
      myXp, myRank, people, campuses,
      endsAt: new Date(monday).toISOString(),
    };
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
      if (dto.tips !== undefined) u.tips = dto.tips;
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

  // ── Streak reminder at the hour each learner usually practises ───────────────

  /** Usual practice hour (8–21), or 19:00 until there's enough history */
  private usualHour(p: any): number {
    const h: number[] = p.activeHours ?? [];
    const total = h.reduce((a, b) => a + (b || 0), 0);
    if (total < 5) return 19;
    let best = 19;
    for (let i = 8; i <= 21; i++) if ((h[i] ?? 0) > (h[best] ?? 0)) best = i;
    return best;
  }

  @Cron('0 * * * *', { name: 'language-streak-reminders' })
  async remindStreaks() {
    const hour = hourNow();
    if (hour < 8 || hour > 21) return;
    const today = dayKey();
    const atRisk = await this.profileModel
      .find({ reminders: true, streak: { $gt: 0 }, lastDay: dayKey(-1), remindedDay: { $ne: today } })
      .select('userId streak activeHours freezes').limit(5000).lean();
    let sent = 0;
    for (const p of atRisk) {
      // At their usual hour, and in any case by 20:00
      if (this.usualHour(p) !== hour && hour !== 20) continue;
      const claimed = await this.profileModel.updateOne({ _id: p._id, remindedDay: { $ne: today } }, { $set: { remindedDay: today } });
      if (!claimed.modifiedCount) continue;
      const freeze = (p.freezes ?? 0) > 0;
      await this.notifications.create(
        {
          userId: String(p.userId), type: NotificationType.SYSTEM,
          title: `Keep your ${p.streak}-day streak`,
          message: freeze ? 'A freeze will protect it, but a short lesson keeps it growing.' : 'One short lesson today keeps it going.',
          link: '/languages',
        } as any,
        {
          title: `Gardez votre série de ${p.streak} jours`,
          message: freeze ? 'Un gel la protégera, mais une petite leçon la fait grandir.' : "Une petite leçon aujourd'hui suffit pour la continuer.",
        },
      ).catch(() => undefined);
      sent++;
    }
    if (sent) this.logger.log(`Sent ${sent} language streak reminder(s)`);
  }

  // ── Monday: settle last week's divisions, then send each learner their weekly report ──

  @Cron('10 0 * * 1', { name: 'language-divisions', timeZone: 'Africa/Douala' })
  async settleDivisions() {
    const last = lastWeekKey();
    const rows: any[] = await this.profileModel.aggregate([
      { $match: { weekKey: last, settledWeek: { $ne: last } } },
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'u', pipeline: [{ $project: { 'studentProfile.universityName': 1 } }] } },
      { $project: { weekXp: 1, division: 1, badges: 1, campus: { $ifNull: [{ $arrayElemAt: ['$u.studentProfile.universityName', 0] }, ''] } } },
    ]);
    const groups = new Map<string, any[]>();
    for (const r of rows) {
      const k = `${r.campus}|${r.division ?? 0}`;
      groups.set(k, [...(groups.get(k) ?? []), r]);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => b.weekXp - a.weekXp);
      const zone = list.length >= 5 ? Math.max(1, Math.ceil(list.length * 0.2)) : 0;
      for (let i = 0; i < list.length; i++) {
        const r = list[i];
        let division = r.division ?? 0;
        if (zone && i < zone && r.weekXp > 0) division = Math.min(DIVISIONS - 1, division + 1);
        else if (zone && i >= list.length - zone) division = Math.max(0, division - 1);
        const update: any = { $set: { division, settledWeek: last } };
        if (list.length >= 3 && i < 3 && r.weekXp > 0 && !(r.badges ?? []).some((b: any) => b.id === 'league_top3')) {
          update.$push = { badges: { id: 'league_top3', at: new Date() } };
        }
        await this.profileModel.updateOne({ _id: r._id }, update);
      }
    }
    if (rows.length) this.logger.log(`Language divisions settled for ${rows.length} learner(s)`);
  }

  @Cron('0 9 * * 1', { name: 'language-weekly-report', timeZone: 'Africa/Douala' })
  async weeklyReports() {
    const last = lastWeekKey();
    const from = new Date(`${last}T00:00:00+01:00`);
    const to = new Date(from.getTime() + 7 * 86_400_000);
    const profiles = await this.profileModel.find({ weekKey: last, weekXp: { $gt: 0 }, reportedWeek: { $ne: last } })
      .select('userId weekXp activeDays streak').limit(5000).lean();
    let sent = 0;
    for (const p of profiles) {
      const claimed = await this.profileModel.updateOne({ _id: p._id, reportedWeek: { $ne: last } }, { $set: { reportedWeek: last } });
      if (!claimed.modifiedCount) continue;
      const days = (p.activeDays ?? []).filter((d) => d >= last && daysBetween(last, d) < 7).length;
      const words = await this.memoryModel.countDocuments({ userId: p.userId, createdAt: { $gte: from, $lt: to } });
      await this.notifications.create(
        {
          userId: String(p.userId), type: NotificationType.SYSTEM,
          title: 'Your week in languages',
          message: `${p.weekXp} XP, ${days} day(s) of practice, ${words} new item(s) learned. Keep it up!`,
          link: '/languages',
        } as any,
        { title: 'Votre semaine de langues', message: `${p.weekXp} XP, ${days} jour(s) de pratique, ${words} nouvel(s) élément(s) appris. Continuez !` },
      ).catch(() => undefined);
      sent++;
    }
    if (sent) this.logger.log(`Sent ${sent} weekly language report(s)`);
  }

  // ── Shop: stars for a streak freeze or a full set of lives ─────────────────

  async shop(userId: string) {
    const p = await this.profileOf(userId);
    const unlimited = await this.hasPlan(userId);
    return {
      stars: p.stars ?? 0,
      items: [
        { id: 'freeze', price: SHOP.freeze, owned: p.freezes ?? 0, max: FREEZE_MAX, available: (p.freezes ?? 0) < FREEZE_MAX },
        { id: 'refill', price: SHOP.refill, owned: unlimited ? LIVES_MAX : this.livesNow(p), max: LIVES_MAX, available: !unlimited && this.livesNow(p) < LIVES_MAX },
      ],
    };
  }

  async buy(userId: string, item: 'freeze' | 'refill') {
    const p: any = await this.profileOf(userId);
    const price = SHOP[item];
    if ((p.stars ?? 0) < price) throw new BadRequestException({ code: 'NOT_ENOUGH_STARS', message: 'Not enough stars yet' });
    if (item === 'freeze' && (p.freezes ?? 0) >= FREEZE_MAX) throw new BadRequestException('You already hold the most freezes');
    if (item === 'refill' && this.livesNow(p) >= LIVES_MAX) throw new BadRequestException('Your lives are already full');
    // Conditional on the stars still being there, so two taps can't spend them twice
    const set: any = item === 'freeze' ? { freezes: (p.freezes ?? 0) + 1 } : { lives: LIVES_MAX, livesAt: null };
    const res = await this.profileModel.updateOne({ _id: p._id, stars: { $gte: price } }, { $inc: { stars: -price }, $set: set });
    if (!res.modifiedCount) throw new BadRequestException({ code: 'NOT_ENOUGH_STARS', message: 'Not enough stars yet' });
    return this.shop(userId);
  }

  /** Leaving a lesson early still costs the lives already lost */
  async spendLives(userId: string, count: number) {
    if (await this.hasPlan(userId)) return { lives: null };
    const p = await this.profileOf(userId);
    const patch = this.livesPatch(p, -Math.max(0, Math.min(LIVES_MAX, count)));
    await this.profileModel.updateOne({ _id: p._id }, { $set: patch });
    return { lives: patch.lives };
  }

  // ── Badges ─────────────────────────────────────────────────────────────────

  async badges(userId: string) {
    const p = await this.profileOf(userId);
    const earned = new Map((p.badges ?? []).map((b) => [b.id, b.at]));
    return Object.entries(BADGES).map(([id, b]) => ({ id, ...b, earnedAt: earned.get(id) ?? null }));
  }

  // ── Checkpoints: a test at the end of each unit ────────────────────────────

  private unitOf(c: any, unitId: string) {
    const u = (c.units ?? []).find((x: any) => String(x._id) === unitId);
    if (!u) throw new NotFoundException('Unit not found');
    return u;
  }

  async checkpoint(userId: string, courseId: string, unitId: string) {
    const c = await this.findCourse(courseId, true);
    const u = this.unitOf(c, unitId);
    const profile = await this.profileOf(userId);
    const done = new Set(profile.courses.find((x) => String(x.courseId) === String(c._id))?.completed ?? []);
    const lessons = (u.lessons ?? []).filter((l: any) => l.isPublished !== false);
    if (!lessons.every((l: any) => done.has(String(l._id)))) throw new ForbiddenException('Finish the unit first');
    const pool = lessons.flatMap((l: any) => (l.exercises ?? []).filter((e: any) => e.type !== 'speak'));
    const picked = pool.sort(() => Math.random() - 0.5).slice(0, CHECKPOINT_SIZE).map((e: any) => ({ ...e, _id: String(e._id) }));
    return { title: u.title, exercises: picked, targetLang: c.targetLang, baseLang: c.baseLang };
  }

  async completeCheckpoint(userId: string, courseId: string, unitId: string, dto: ResultsDto) {
    const c = await this.findCourse(courseId, true);
    const u = this.unitOf(c, unitId);
    const own = new Set((u.lessons ?? []).flatMap((l: any) => (l.exercises ?? []).map((e: any) => String(e._id))));
    const valid = dto.results.filter((r) => own.has(r.exerciseId));
    if (valid.length < 5) throw new BadRequestException('Checkpoint not finished');
    await this.remember(userId, c._id, valid);
    const score = valid.filter((r) => r.correct).length / valid.length;
    if (score < CHECKPOINT_PASS) return { passed: false, score: Math.round(score * 100) };
    const res = await this.award(userId, c, 20, score === 1, { kind: 'checkpoint', unitId });
    return { passed: true, score: Math.round(score * 100), ...res };
  }

  // ── Mock exam: 20 questions across the course, timed in the app ────────────

  async mock(userId: string, courseId: string) {
    const c = await this.findCourse(courseId, true);
    const pool = this.lessonsOf(c).flatMap((l: any) => (l.exercises ?? []).filter((e: any) => ['choice', 'tiles', 'fill', 'type', 'listen'].includes(e.type)));
    if (pool.length < 5) throw new BadRequestException('This course is too short for a test yet');
    const picked = pool.sort(() => Math.random() - 0.5).slice(0, MOCK_SIZE).map((e: any) => ({ ...e, _id: String(e._id) }));
    return { exercises: picked, minutes: 10, targetLang: c.targetLang, baseLang: c.baseLang };
  }

  async completeMock(userId: string, courseId: string, dto: ResultsDto) {
    const c = await this.findCourse(courseId, true);
    const own = new Set(this.lessonsOf(c).flatMap((l: any) => (l.exercises ?? []).map((e: any) => String(e._id))));
    const valid = dto.results.filter((r) => own.has(r.exerciseId));
    if (valid.length < 5) throw new BadRequestException('Test not finished');
    const score = Math.round((valid.filter((r) => r.correct).length / valid.length) * 100);
    const res = await this.award(userId, c, score >= 50 ? 15 : 5, score === 100, { kind: 'mock', mockScore: score });
    return { score, ...res };
  }

  // ── Words learned: vocabulary from finished lessons, with how well it's known ──

  async words(userId: string, courseId: string) {
    const c = await this.findCourse(courseId, true);
    const pool = await this.finishedExercises(userId, c);
    const items = [...pool.values()].filter((e: any) => e.type === 'choice' && e.instruction === 'meaning' && e.prompt && e.answers?.[0]);
    const memories = await this.memoryModel.find({ userId: new Types.ObjectId(userId), exerciseId: { $in: items.map((e: any) => e._id) } }).lean();
    const box = new Map(memories.map((m) => [m.exerciseId, m.box]));
    const seen = new Set<string>();
    return items
      .filter((e: any) => (seen.has(e.prompt) ? false : (seen.add(e.prompt), true)))
      .map((e: any) => ({ word: e.prompt, romanization: e.promptRomanization, meaning: e.answers[0], strength: box.get(e._id) ?? 0 }))
      .sort((a, b) => a.strength - b.strength || a.word.localeCompare(b.word));
  }

  // ── "Explain my answer" (AI, short, in the explanation language) ────────────

  async explain(dto: ExplainDto) {
    const key = this.config.get<string>('OPENAI_API_KEY');
    if (!key) throw new ServiceUnavailableException('Explanations need OPENAI_API_KEY on the server');
    const names: Record<string, string> = { fr: 'French', en: 'English', zh: 'Mandarin Chinese' };
    const prompt = [
      `A learner of ${names[dto.targetLang]} (explanations in ${names[dto.baseLang]}) answered an exercise.`,
      `Exercise: ${dto.prompt}`, `Expected answer: ${dto.expected}`, `Learner's answer: ${dto.given || '(empty)'}`,
      `In ${names[dto.baseLang]}, explain in at most 3 short sentences why the expected answer is right and what was wrong,`,
      'with one simple tip. Be kind and concrete. No preamble.',
    ].join('\n');
    let res: Response;
    try {
      res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: this.config.get<string>('OPENAI_MODEL') || 'gpt-4o-mini', temperature: 0.3, max_tokens: 220, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new ServiceUnavailableException('The AI service could not be reached');
    }
    if (!res.ok) throw new ServiceUnavailableException('The AI service refused the request');
    const data: any = await res.json();
    const text = String(data?.choices?.[0]?.message?.content ?? '').trim();
    if (!text) throw new ServiceUnavailableException('No explanation came back');
    return { text: text.slice(0, 800) };
  }

  // ── Stories ────────────────────────────────────────────────────────────────

  async story(userId: string, courseId: string, storyId: string) {
    const c = await this.findCourse(courseId, true);
    const st = (c.stories ?? []).find((x: any) => String(x._id) === storyId && x.isPublished !== false);
    if (!st) throw new NotFoundException('Story not found');
    if (st.unitSeedKey) {
      const u = (c.units ?? []).find((x: any) => x.seedKey === st.unitSeedKey);
      const profile = await this.profileOf(userId);
      const done = new Set(profile.courses.find((x) => String(x.courseId) === String(c._id))?.completed ?? []);
      if (u && !(u.lessons ?? []).filter((l: any) => l.isPublished !== false).every((l: any) => done.has(String(l._id)))) {
        throw new ForbiddenException('Finish the unit to open this story');
      }
    }
    return {
      _id: String(st._id), title: st.title, level: st.level, lines: st.lines,
      questions: (st.questions ?? []).map((q: any) => ({ ...q, _id: String(q._id) })),
      targetLang: c.targetLang, baseLang: c.baseLang,
    };
  }

  async completeStory(userId: string, courseId: string, storyId: string, dto: StoryCompleteDto) {
    const c = await this.findCourse(courseId, true);
    const st = (c.stories ?? []).find((x: any) => String(x._id) === storyId);
    if (!st) throw new NotFoundException('Story not found');
    if (dto.correct > dto.total) throw new BadRequestException('More right answers than questions');
    const profile = await this.profileOf(userId);
    const already = (profile.courses.find((x) => String(x.courseId) === String(c._id))?.stories ?? []).includes(storyId);
    return this.award(userId, c, already ? 3 : 10, dto.correct === dto.total, { kind: 'story', storyId });
  }

  // ── Friends: follow learners, a shared weekly goal ─────────────────────────

  async follow(userId: string, followId: string) {
    if (!Types.ObjectId.isValid(followId) || followId === userId) throw new BadRequestException('You can’t follow that account');
    if (!(await this.profileModel.exists({ userId: new Types.ObjectId(followId) }))) throw new NotFoundException('Learner not found');
    const count = await this.followModel.countDocuments({ userId: new Types.ObjectId(userId) });
    if (count >= 100) throw new BadRequestException('You follow the most learners already');
    await this.followModel.updateOne(
      { userId: new Types.ObjectId(userId), followId: new Types.ObjectId(followId) },
      { $setOnInsert: { userId: new Types.ObjectId(userId), followId: new Types.ObjectId(followId) } },
      { upsert: true },
    );
    // First friend badge
    await this.profileModel.updateOne(
      { userId: new Types.ObjectId(userId), 'badges.id': { $ne: 'friend_1' } },
      { $push: { badges: { id: 'friend_1', at: new Date() } } },
    );
    return { following: true };
  }

  async unfollow(userId: string, followId: string) {
    if (!Types.ObjectId.isValid(followId)) throw new BadRequestException('Unknown learner');
    await this.followModel.deleteOne({ userId: new Types.ObjectId(userId), followId: new Types.ObjectId(followId) });
    return { following: false };
  }

  async friends(userId: string) {
    const week = weekKey();
    const ids = (await this.followModel.find({ userId: new Types.ObjectId(userId) }).select('followId').lean()).map((f) => f.followId);
    const [profiles, users, me] = await Promise.all([
      this.profileModel.find({ userId: { $in: ids } }).select('userId weekKey weekXp streak lastDay').lean(),
      this.userModel.find({ _id: { $in: ids } }).select('name profilePicture').lean(),
      this.profileOf(userId),
    ]);
    const byUser = new Map(profiles.map((p) => [String(p.userId), p]));
    const short = (n?: string) => {
      const parts = String(n ?? '').trim().split(/\s+/).filter(Boolean);
      return parts.length ? `${parts[0]}${parts[1] ? ` ${parts[1][0]}.` : ''}` : '—';
    };
    const list = users.map((u: any) => {
      const p: any = byUser.get(String(u._id));
      return {
        id: String(u._id), name: short(u.name), picture: u.profilePicture,
        weekXp: p?.weekKey === week ? p.weekXp : 0, streak: p?.streak ?? 0, activeToday: p?.lastDay === dayKey(),
      };
    }).sort((a, b) => b.weekXp - a.weekXp);
    // Shared weekly goal: grows with the group
    const myXp = me.weekKey === week ? me.weekXp : 0;
    const target = 100 + 100 * Math.min(list.length, 9);
    const total = myXp + list.reduce((a, f) => a + f.weekXp, 0);
    return { friends: list, quest: { target, total, done: total >= target }, myXp };
  }

}
