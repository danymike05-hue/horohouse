import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import {
  SavedScholarship, SavedScholarshipDocument, Scholarship, ScholarshipDocument, ScholarshipLevel,
} from './schemas/scholarship.schema';
import { CreateScholarshipDto, ScholarshipQueryDto, UpdateScholarshipDto } from './dto/scholarship.dto';
import { StudentProfile } from '../student-profiles/schemas/student-profile.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { escapeRegex } from '../common/regex.util';

const DAY = 24 * 60 * 60 * 1000;

/** The student's level as entered in their profile → scholarship levels */
function levelsFor(studyLevel?: string): ScholarshipLevel[] {
  const v = String(studyLevel ?? '').toUpperCase();
  if (/^L[1-3]$/.test(v)) return ['bachelor'];
  if (v === 'BTS') return ['diploma', 'bachelor'];
  if (/^M[12]$/.test(v)) return ['master'];
  if (v === 'PHD') return ['phd'];
  return [];
}

/** Still open: no deadline (all year) or a deadline from the start of today */
const openFilter = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return { $or: [{ deadline: { $exists: false } }, { deadline: null }, { deadline: { $gte: today } }] };
};

@Injectable()
export class ScholarshipsService {
  private readonly logger = new Logger(ScholarshipsService.name);

  constructor(
    @InjectModel(Scholarship.name) private scholarshipModel: Model<ScholarshipDocument>,
    @InjectModel(SavedScholarship.name) private savedModel: Model<SavedScholarshipDocument>,
    @InjectModel(StudentProfile.name) private profileModel: Model<any>,
    private notifications: NotificationsService,
  ) {}

  // ── Students ────────────────────────────────────────────────────────────────

  async list(userId: string, q: ScholarshipQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const and: any[] = [{ isPublished: true }, openFilter()];
    if (q.level) and.push({ levels: q.level });
    if (q.country) and.push({ destinationCountry: new RegExp(`^${escapeRegex(q.country)}$`, 'i') });
    if (q.field) and.push({ $or: [{ fields: { $size: 0 } }, { fields: new RegExp(escapeRegex(q.field), 'i') }] });
    if (q.fullyFunded) and.push({ 'coverage.fullyFunded': true });
    if (q.withinDays) and.push({ deadline: { $lte: new Date(Date.now() + q.withinDays * DAY) } });
    if (q.q) {
      const rx = new RegExp(escapeRegex(q.q), 'i');
      and.push({ $or: [{ title: rx }, { provider: rx }, { destinationCountry: rx }, { destinationCity: rx }, { fields: rx }] });
    }
    const filter = { $and: and };

    const savedIds = new Set(
      (await this.savedModel.find({ userId: new Types.ObjectId(userId) }).select('scholarshipId').lean())
        .map((s) => String(s.scholarshipId)),
    );

    if (q.matched) {
      // Fit with the profile: matching level counts most, then a field like their faculty
      const profile = await this.profileModel.findOne({ userId: new Types.ObjectId(userId) }).select('studyLevel faculty').lean() as any;
      const myLevels = levelsFor(profile?.studyLevel);
      const faculty = String(profile?.faculty ?? '').toLowerCase().trim();
      const all = await this.scholarshipModel.find(filter).limit(300).lean();
      const scored = all
        .map((s: any) => {
          let score = 0;
          if (myLevels.length && s.levels?.some((l: string) => myLevels.includes(l as ScholarshipLevel))) score += 2;
          if (!s.levels?.length) score += 1;
          if (faculty && s.fields?.some((f: string) => f.toLowerCase().includes(faculty) || faculty.includes(f.toLowerCase()))) score += 2;
          if (!s.fields?.length) score += 0.5;
          return { s, score };
        })
        .sort((a, b) => b.score - a.score || this.byDeadline(a.s, b.s));
      const items = scored.slice((page - 1) * limit, page * limit).map(({ s, score }) => ({ ...this.view(s, savedIds), match: score >= 3 }));
      return { items, total: scored.length, page, limit };
    }

    const [docs, total] = await Promise.all([
      // Soonest deadline first; "all year" ones after
      this.scholarshipModel.aggregate([
        { $match: filter },
        { $addFields: { _noDeadline: { $cond: [{ $ifNull: ['$deadline', false] }, 0, 1] } } },
        { $sort: { _noDeadline: 1, deadline: 1, createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
      ]),
      this.scholarshipModel.countDocuments(filter),
    ]);
    return { items: docs.map((s) => this.view(s, savedIds)), total, page, limit };
  }

  /** For the list's header: how many are open, how many close within 30 days, and the next five */
  async summary(userId: string) {
    const base = { $and: [{ isPublished: true }, openFilter()] };
    const soon = { $and: [...base.$and, { deadline: { $lte: new Date(Date.now() + 30 * DAY) } }] };
    const [open, closingSoon, next, savedRows] = await Promise.all([
      this.scholarshipModel.countDocuments(base),
      this.scholarshipModel.countDocuments(soon),
      this.scholarshipModel.find(soon).sort({ deadline: 1 }).limit(5).lean(),
      this.savedModel.find({ userId: new Types.ObjectId(userId) }).select('scholarshipId').lean(),
    ]);
    const savedIds = new Set(savedRows.map((r) => String(r.scholarshipId)));
    return { open, closingSoon, next: next.map((s) => this.view(s, savedIds)) };
  }

  async detail(userId: string, id: string) {
    const s = await this.findPublished(id);
    const saved = await this.savedModel.exists({ userId: new Types.ObjectId(userId), scholarshipId: s._id });
    return this.view(s, new Set(saved ? [String(s._id)] : []));
  }

  async save(userId: string, id: string) {
    const s = await this.findPublished(id);
    await this.savedModel.updateOne(
      { userId: new Types.ObjectId(userId), scholarshipId: s._id },
      { $setOnInsert: { userId: new Types.ObjectId(userId), scholarshipId: s._id } },
      { upsert: true },
    );
    return { saved: true };
  }

  async unsave(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Scholarship not found');
    await this.savedModel.deleteOne({ userId: new Types.ObjectId(userId), scholarshipId: new Types.ObjectId(id) });
    return { saved: false };
  }

  async saved(userId: string) {
    const rows = await this.savedModel.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).lean();
    const docs = await this.scholarshipModel.find({ _id: { $in: rows.map((r) => r.scholarshipId) }, isPublished: true }).lean();
    const ids = new Set(docs.map((d) => String(d._id)));
    return docs.sort((a, b) => this.byDeadline(a, b)).map((s) => this.view(s, ids));
  }

  // ── Admins ──────────────────────────────────────────────────────────────────

  async adminList(q: { q?: string; status?: 'published' | 'draft' | 'expired' }) {
    const and: any[] = [];
    if (q.status === 'published') and.push({ isPublished: true }, openFilter());
    if (q.status === 'draft') and.push({ isPublished: false });
    if (q.status === 'expired') and.push({ deadline: { $lt: new Date(new Date().setHours(0, 0, 0, 0)) } });
    if (q.q) {
      const rx = new RegExp(escapeRegex(q.q), 'i');
      and.push({ $or: [{ title: rx }, { provider: rx }, { destinationCountry: rx }] });
    }
    const docs = await this.scholarshipModel.find(and.length ? { $and: and } : {}).sort({ updatedAt: -1 }).limit(200).lean();
    return docs.map((s) => this.view(s, new Set()));
  }

  async create(adminId: string, dto: CreateScholarshipDto) {
    const doc = await this.scholarshipModel.create({
      ...this.clean(dto),
      deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      lastCheckedAt: new Date(),
      createdBy: new Types.ObjectId(adminId),
    });
    return this.view(doc.toObject(), new Set());
  }

  async update(id: string, dto: UpdateScholarshipDto) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Scholarship not found');
    const { markChecked, deadline, ...rest } = dto;
    const set: any = this.clean(rest);
    const unset: any = {};
    if (deadline === null) unset.deadline = 1;
    else if (deadline) set.deadline = new Date(deadline);
    if (markChecked) set.lastCheckedAt = new Date();
    if (rest.coverage) {
      // Replace the coverage block as a whole (unticked boxes come back false)
      set.coverage = { fullyFunded: false, tuition: false, housing: false, allowance: false, flights: false, ...rest.coverage };
    }
    const doc = await this.scholarshipModel.findByIdAndUpdate(
      id,
      { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { new: true, runValidators: true },
    ).lean();
    if (!doc) throw new NotFoundException('Scholarship not found');
    return this.view(doc, new Set());
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Scholarship not found');
    const res = await this.scholarshipModel.deleteOne({ _id: id });
    if (!res.deletedCount) throw new NotFoundException('Scholarship not found');
    await this.savedModel.deleteMany({ scholarshipId: new Types.ObjectId(id) });
    return { deleted: true };
  }

  // ── Deadline reminders: 14 and 3 days before, for saved scholarships ────────

  @Cron('0 8 * * *', { name: 'scholarship-deadline-reminders', timeZone: 'Africa/Douala' })
  async sendDeadlineReminders() {
    for (const days of [14, 3] as const) {
      try {
        await this.remindAt(days);
      } catch (err: any) {
        this.logger.warn(`Scholarship reminders (${days} days) failed: ${err?.message}`);
      }
    }
  }

  private async remindAt(days: 14 | 3) {
    const flag = days === 14 ? 'reminded14' : 'reminded3';
    const from = new Date(Date.now() + (days - 1) * DAY);
    const to = new Date(Date.now() + days * DAY);
    const due = await this.scholarshipModel.find({ isPublished: true, deadline: { $gt: from, $lte: to } }).select('_id title').lean();
    if (!due.length) return;
    const titles = new Map(due.map((d) => [String(d._id), d.title]));
    const rows = await this.savedModel.find({ scholarshipId: { $in: due.map((d) => d._id) }, [flag]: false }).lean();
    let sent = 0;
    for (const row of rows) {
      // Claim it first so a second server can't send the same reminder
      const claimed = await this.savedModel.updateOne({ _id: row._id, [flag]: false }, { $set: { [flag]: true } });
      if (!claimed.modifiedCount) continue;
      const title = titles.get(String(row.scholarshipId)) ?? '';
      await this.notifications.create(
        {
          userId: String(row.userId),
          type: NotificationType.SYSTEM,
          title: days === 14 ? 'Scholarship deadline in 2 weeks' : 'Scholarship deadline in 3 days',
          message: `${title}: applications close ${days === 14 ? 'in 2 weeks' : 'in 3 days'}. Get your documents ready.`,
          link: `/student/scholarships/${row.scholarshipId}`,
        } as any,
        {
          title: days === 14 ? 'Date limite de bourse dans 2 semaines' : 'Date limite de bourse dans 3 jours',
          message: `${title} : les candidatures ferment ${days === 14 ? 'dans 2 semaines' : 'dans 3 jours'}. Préparez vos documents.`,
        },
      ).catch(() => undefined);
      sent++;
    }
    if (sent) this.logger.log(`Sent ${sent} scholarship reminder(s) (${days} days)`);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async findPublished(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Scholarship not found');
    const s = await this.scholarshipModel.findOne({ _id: id, isPublished: true }).lean();
    if (!s) throw new NotFoundException('Scholarship not found');
    return s;
  }

  private byDeadline(a: any, b: any) {
    const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    return da - db;
  }

  /** Trim lists and drop empty entries */
  private clean<T extends Record<string, any>>(dto: T): T {
    const out: any = { ...dto };
    for (const k of ['fields', 'eligibleNationalities', 'requirements', 'documents', 'levels']) {
      if (Array.isArray(out[k])) out[k] = [...new Set(out[k].map((v: string) => String(v).trim()).filter(Boolean))];
    }
    if (out.applyUrl && !/^https:\/\//i.test(out.applyUrl)) throw new BadRequestException('The apply link must start with https://');
    return out;
  }

  private view(s: any, savedIds: Set<string>) {
    const id = String(s._id);
    const deadline = s.deadline ? new Date(s.deadline) : null;
    return {
      _id: id,
      title: s.title,
      provider: s.provider,
      providerType: s.providerType,
      description: s.description,
      levels: s.levels ?? [],
      fields: s.fields ?? [],
      destinationCountry: s.destinationCountry,
      destinationCity: s.destinationCity,
      eligibleNationalities: s.eligibleNationalities ?? [],
      coverage: s.coverage ?? {},
      deadline: deadline ? deadline.toISOString() : null,
      daysLeft: deadline ? Math.ceil((deadline.getTime() - Date.now()) / DAY) : null,
      language: s.language,
      requirements: s.requirements ?? [],
      documents: s.documents ?? [],
      applyUrl: s.applyUrl,
      sourceUrl: s.sourceUrl,
      lastCheckedAt: s.lastCheckedAt,
      createdAt: s.createdAt,
      isPublished: !!s.isPublished,
      saved: savedIds.has(id),
    };
  }
}
