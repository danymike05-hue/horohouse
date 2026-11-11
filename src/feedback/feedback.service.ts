import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Feedback, FeedbackDocument } from './feedback.schema';
import { NotificationsService } from '../notifications/notifications.service';

export interface FeedbackInput {
  rating?: number;
  category?: string;
  message: string;
  device?: string;
}

const CATEGORY_LABEL: Record<string, string> = { suggestion: 'Suggestion', bug: 'Bug', other: 'Other' };
const RATING_LABEL: Record<number, string> = { 1: '🙁', 2: '😐', 3: '🙂' };

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    @InjectModel(Feedback.name) private readonly feedbackModel: Model<FeedbackDocument>,
    private readonly notifications: NotificationsService,
  ) { }

  /** Saves it, then tells the admins. The notice failing never loses the feedback. */
  async create(input: FeedbackInput, user?: { _id?: any; name?: string } | null): Promise<{ received: true }> {
    const userId = user?._id && Types.ObjectId.isValid(String(user._id)) ? new Types.ObjectId(String(user._id)) : undefined;
    const text = input.message.trim();
    const saved = await this.feedbackModel.create({
      userId,
      rating: input.rating,
      category: input.category ?? 'suggestion',
      message: text,
      device: input.device,
    });

    const from = user?.name ? user.name : 'A visitor (not logged in)';
    const mood = input.rating ? `${RATING_LABEL[input.rating]} ` : '';
    try {
      await this.notifications.notifyAdmins({
        title: `${mood}App feedback: ${CATEGORY_LABEL[input.category ?? 'suggestion'] ?? 'Other'}`,
        message: `${from}: ${text.length > 300 ? `${text.slice(0, 297)}…` : text}${input.device ? ` (${input.device})` : ''}`,
        metadata: { feedbackId: String(saved._id), kind: 'app_feedback' },
      });
    } catch (err: any) {
      this.logger.warn(`Feedback ${saved._id} saved, but admins weren't notified: ${err?.message}`);
    }
    return { received: true };
  }
}
