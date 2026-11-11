import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FeedbackDocument = Feedback & Document;

export const FEEDBACK_CATEGORIES = ['suggestion', 'bug', 'other'] as const;

/** "Give us feedback" from the app's Profile tab. */
@Schema({ timestamps: true })
export class Feedback {
  /** Empty when sent by someone who isn't logged in */
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  userId?: Types.ObjectId;

  /** 1 = unhappy, 2 = neutral, 3 = happy */
  @Prop({ min: 1, max: 3 })
  rating?: number;

  @Prop({ type: String, enum: FEEDBACK_CATEGORIES, default: 'suggestion' })
  category: string;

  @Prop({ required: true, trim: true, maxlength: 2000 })
  message: string;

  /** e.g. "android 1.0.0", which helps with bug reports */
  @Prop({ trim: true, maxlength: 80 })
  device?: string;
}

export const FeedbackSchema = SchemaFactory.createForClass(Feedback);
