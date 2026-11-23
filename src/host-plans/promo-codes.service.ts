// Discount codes a host makes for their own guests (Starter and up). The discount comes
// out of the stay price, so the host pays for it, not HoroHouse.
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Model, Types } from 'mongoose';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import { HostPlansService } from './host-plans.service';

@Schema({ timestamps: true, collection: 'promo_codes' })
export class PromoCode {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) hostId: Types.ObjectId;
  @Prop({ type: String, required: true, unique: true }) code: string;
  @Prop({ required: true, min: 5, max: 50 }) percentOff: number;
  /** Empty: every listing of the host */
  @Prop({ type: [Types.ObjectId], default: [] }) propertyIds: Types.ObjectId[];
  @Prop({ default: 1 }) minNights: number;
  @Prop() startsAt?: Date;
  @Prop() endsAt?: Date;
  @Prop() maxUses?: number;
  @Prop({ default: 0 }) uses: number;
  @Prop({ default: true }) isActive: boolean;
}
export type PromoCodeDocument = PromoCode & Document;
export const PromoCodeSchema = SchemaFactory.createForClass(PromoCode);

export interface PromoInput {
  code?: string;
  percentOff?: number;
  propertyIds?: string[];
  minNights?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  maxUses?: number | null;
  isActive?: boolean;
}

const CODE_RE = /^[A-Z0-9]{4,16}$/;
const norm = (c: unknown) => String(c ?? '').trim().toUpperCase().replace(/\s+/g, '');

@Injectable()
export class PromoCodesService {
  constructor(
    @InjectModel(PromoCode.name) private readonly codes: Model<PromoCodeDocument>,
    @InjectModel(Property.name) private readonly properties: Model<PropertyDocument>,
    private readonly plans: HostPlansService,
  ) {}

  private view(c: any) {
    return {
      id: String(c._id),
      code: c.code,
      percentOff: c.percentOff,
      propertyIds: (c.propertyIds ?? []).map(String),
      minNights: c.minNights ?? 1,
      startsAt: c.startsAt ?? null,
      endsAt: c.endsAt ?? null,
      maxUses: c.maxUses ?? null,
      uses: c.uses ?? 0,
      isActive: c.isActive !== false,
      createdAt: c.createdAt,
    };
  }

  async mine(hostId: string) {
    const rows = await this.codes.find({ hostId: new Types.ObjectId(hostId) }).sort({ createdAt: -1 }).lean();
    return { canCreate: await this.plans.canUsePromoCodes(hostId), codes: rows.map((r) => this.view(r)) };
  }

  private async checkInput(hostId: string, dto: PromoInput, partial: boolean) {
    const set: any = {};
    if (!partial || dto.code !== undefined) {
      const code = norm(dto.code);
      if (!CODE_RE.test(code)) throw new BadRequestException({ code: 'BAD_CODE', message: 'Use 4 to 16 letters or numbers.' });
      set.code = code;
    }
    if (!partial || dto.percentOff !== undefined) {
      const pct = Math.round(Number(dto.percentOff));
      if (!(pct >= 5 && pct <= 50)) throw new BadRequestException({ code: 'BAD_PERCENT', message: 'The discount must be between 5% and 50%.' });
      set.percentOff = pct;
    }
    if (dto.propertyIds !== undefined) {
      const ids = [...new Set((dto.propertyIds ?? []).filter((x) => Types.ObjectId.isValid(x)))].map((x) => new Types.ObjectId(x));
      if (ids.length) {
        const own = await this.properties.countDocuments({ _id: { $in: ids }, ownerId: new Types.ObjectId(hostId) });
        if (own !== ids.length) throw new ForbiddenException('You can only add your own listings');
      }
      set.propertyIds = ids;
    }
    if (dto.minNights !== undefined) set.minNights = Math.max(1, Math.min(90, Math.round(Number(dto.minNights) || 1)));
    if (dto.startsAt !== undefined) set.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.endsAt !== undefined) set.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (set.startsAt && set.endsAt && set.endsAt <= set.startsAt) throw new BadRequestException({ code: 'BAD_DATES', message: 'The end date must be after the start date.' });
    if (dto.maxUses !== undefined) set.maxUses = dto.maxUses ? Math.max(1, Math.round(Number(dto.maxUses))) : null;
    if (dto.isActive !== undefined) set.isActive = !!dto.isActive;
    return set;
  }

  async create(hostId: string, dto: PromoInput) {
    await this.plans.assertPromoCodes(hostId);
    const set = await this.checkInput(hostId, dto, false);
    try {
      const row = await this.codes.create({ hostId: new Types.ObjectId(hostId), ...set });
      return this.view(row.toObject());
    } catch (err: any) {
      if (err?.code === 11000) throw new ConflictException({ code: 'CODE_TAKEN', message: 'This code is already used. Try another.' });
      throw err;
    }
  }

  async update(hostId: string, id: string, dto: PromoInput) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Code not found');
    // Switching a code off is always allowed; anything else needs the plan
    if (Object.keys(dto).some((k) => k !== 'isActive') || dto.isActive) await this.plans.assertPromoCodes(hostId);
    const set = await this.checkInput(hostId, dto, true);
    try {
      const row = await this.codes.findOneAndUpdate({ _id: id, hostId: new Types.ObjectId(hostId) }, { $set: set }, { new: true }).lean();
      if (!row) throw new NotFoundException('Code not found');
      return this.view(row);
    } catch (err: any) {
      if (err?.code === 11000) throw new ConflictException({ code: 'CODE_TAKEN', message: 'This code is already used. Try another.' });
      throw err;
    }
  }

  async remove(hostId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Code not found');
    const res = await this.codes.deleteOne({ _id: id, hostId: new Types.ObjectId(hostId) });
    if (!res.deletedCount) throw new NotFoundException('Code not found');
  }

  /** Is this code good for this stay? Throws with a reason the app can show. */
  async check(rawCode: string, propertyId: string, nights: number, at = new Date()) {
    const code = norm(rawCode);
    const fail = (reason: string, message: string) => new BadRequestException({ code: 'PROMO_INVALID', reason, message });
    if (!CODE_RE.test(code) || !Types.ObjectId.isValid(propertyId)) throw fail('not_found', 'This code doesn’t exist.');
    const promo: any = await this.codes.findOne({ code }).lean();
    const property: any = await this.properties.findById(propertyId).select('ownerId').lean();
    if (!promo || !property || String(promo.hostId) !== String(property.ownerId)) throw fail('not_found', 'This code doesn’t exist for this place.');
    if (!promo.isActive) throw fail('inactive', 'This code is no longer active.');
    if (promo.propertyIds?.length && !promo.propertyIds.some((p: any) => String(p) === String(propertyId))) throw fail('not_for_listing', 'This code is not for this place.');
    if (promo.startsAt && at < new Date(promo.startsAt)) throw fail('not_started', 'This code isn’t active yet.');
    if (promo.endsAt && at > new Date(promo.endsAt)) throw fail('expired', 'This code has expired.');
    if (promo.maxUses && (promo.uses ?? 0) >= promo.maxUses) throw fail('used_up', 'This code has been used up.');
    if (nights > 0 && nights < (promo.minNights ?? 1)) throw fail('min_nights', `This code is for stays of ${promo.minNights} nights or more.`);
    // A host who left the plans that include codes: their codes stop working
    if (!(await this.plans.canUsePromoCodes(String(promo.hostId)))) throw fail('inactive', 'This code is no longer active.');
    return { code: promo.code, percentOff: promo.percentOff, id: String(promo._id), minNights: promo.minNights ?? 1 };
  }

  /** Booking made with the code: count a use (atomic, so the last use can't be taken twice) */
  async use(rawCode: string, propertyId: string, nights: number) {
    const ok = await this.check(rawCode, propertyId, nights);
    const filter: any = { _id: ok.id };
    const promo: any = await this.codes.findById(ok.id).select('maxUses').lean();
    if (promo?.maxUses) filter.uses = { $lt: promo.maxUses };
    const res = await this.codes.updateOne(filter, { $inc: { uses: 1 } });
    if (res.modifiedCount !== 1) throw new BadRequestException({ code: 'PROMO_INVALID', reason: 'used_up', message: 'This code has been used up.' });
    return ok;
  }

  /** The booking didn't happen after all */
  async giveBack(code: string | undefined) {
    if (!code) return;
    await this.codes.updateOne({ code: norm(code), uses: { $gt: 0 } }, { $inc: { uses: -1 } });
  }
}
