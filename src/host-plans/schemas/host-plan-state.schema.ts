import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/** One row per host: what they have used of the plan extras and the growth offers */
@Schema({ timestamps: true, collection: 'host_plan_states' })
export class HostPlanState {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  /** Free plan's one welcome boost */
  @Prop() welcomeBoostUsedAt?: Date;

  /** AI listing writer: uses ever (Free) and uses in `aiWriterMonth` (paid plans) */
  @Prop({ default: 0 }) aiWriterLifetime: number;
  @Prop({ default: 0 }) aiWriterMonthUses: number;
  /** "2026-11" */
  @Prop() aiWriterMonth?: string;

  @Prop() trialUsedAt?: Date;
  @Prop() trialPlan?: string;
  @Prop() foundingClaimedAt?: Date;

  /** This host's code to bring other hosts */
  @Prop({ type: String, unique: true, sparse: true }) referralCode?: string;
  /** Who brought this host, and when that person got their reward */
  @Prop({ type: Types.ObjectId, ref: 'User' }) referredBy?: Types.ObjectId;
  @Prop() referredAt?: Date;
  @Prop() referralRewardedAt?: Date;
  @Prop({ default: 0 }) referralRewards: number;
}

export type HostPlanStateDocument = HostPlanState & Document;
export const HostPlanStateSchema = SchemaFactory.createForClass(HostPlanState);

/** Shared counters (founding host spots) */
@Schema({ collection: 'host_plan_counters' })
export class HostPlanCounter {
  @Prop({ type: String, required: true }) _id: string;
  @Prop({ default: 0 }) count: number;
}
export type HostPlanCounterDocument = HostPlanCounter & Document;
export const HostPlanCounterSchema = SchemaFactory.createForClass(HostPlanCounter);
