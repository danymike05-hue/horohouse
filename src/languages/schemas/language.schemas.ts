import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export const LANGS = ['fr', 'en', 'zh'] as const;
export type Lang = (typeof LANGS)[number];
export const EXERCISE_TYPES = ['choice', 'tiles', 'type', 'match', 'fill'] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

/**
 * One screen of a lesson.
 * - choice: pick the right answer among options
 * - tiles: build the answer from word tiles (options = the tile bank)
 * - type: type the answer
 * - match: pair left and right items
 * - fill: choose the word that completes the sentence (prompt contains "___")
 */
@Schema({ _id: true })
export class Exercise {
  @Prop({ enum: EXERCISE_TYPES, required: true }) type: ExerciseType;
  /** Instruction key shown above, e.g. "translate", "meaning", "pairs", "complete" */
  @Prop({ default: 'translate' }) instruction: string;
  /** What the learner reads (a sentence, a word); empty for match */
  @Prop({ default: '' }) prompt: string;
  /** Pinyin (or other romanization) for a Chinese prompt */
  @Prop() promptRomanization?: string;
  /** Language of the prompt, for display (fonts, direction later) */
  @Prop({ enum: LANGS }) promptLang?: Lang;
  /** Accepted answers; the first is the one shown as correct */
  @Prop({ type: [String], default: [] }) answers: string[];
  /** Options (choice / fill) or the tile bank (tiles) */
  @Prop({ type: [String], default: [] }) options: string[];
  /** Pinyin for each option, same order (Chinese tiles and fill-ins) */
  @Prop({ type: [String], default: undefined }) optionsRomanization?: string[];
  @Prop({ type: [{ left: String, right: String, _id: false }], default: [] }) pairs: { left: string; right: string }[];
  /** Language of the expected answer (tiles in Chinese join without spaces) */
  @Prop({ enum: LANGS }) answerLang?: Lang;
  @Prop() explanation?: string;
}
export const ExerciseSchema = SchemaFactory.createForClass(Exercise);

@Schema({ _id: true })
export class Lesson {
  @Prop({ required: true, trim: true }) title: string;
  @Prop({ type: [ExerciseSchema], default: [] }) exercises: Exercise[];
  @Prop({ default: true }) isPublished: boolean;
}
export const LessonSchema = SchemaFactory.createForClass(Lesson);

@Schema({ _id: true })
export class Unit {
  @Prop({ required: true, trim: true }) title: string;
  @Prop({ trim: true }) description?: string;
  /** CEFR level, e.g. A1 */
  @Prop({ default: 'A1' }) level: string;
  @Prop({ type: [LessonSchema], default: [] }) lessons: Lesson[];
}
export const UnitSchema = SchemaFactory.createForClass(Unit);

/** A course: learn targetLang, explained in baseLang. Units and lessons live inside it. */
@Schema({ timestamps: true })
export class LanguageCourse {
  @Prop({ required: true, unique: true, trim: true }) slug: string;
  @Prop({ enum: LANGS, required: true }) targetLang: Lang;
  @Prop({ enum: LANGS, required: true }) baseLang: Lang;
  @Prop({ type: Object, default: {} }) title: { en?: string; fr?: string };
  @Prop({ type: Object, default: {} }) description: { en?: string; fr?: string };
  @Prop({ default: 0 }) order: number;
  @Prop({ default: false, index: true }) isPublished: boolean;
  @Prop({ type: [UnitSchema], default: [] }) units: Unit[];
}
export type LanguageCourseDocument = LanguageCourse & Document;
export const LanguageCourseSchema = SchemaFactory.createForClass(LanguageCourse);

/** One learner: streak, daily goal and XP (shared by all courses), and per-course progress */
@Schema({ timestamps: true })
export class LanguageProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true }) userId: Types.ObjectId;
  @Prop({ default: 0 }) streak: number;
  @Prop({ default: 0 }) longestStreak: number;
  /** Last day (YYYY-MM-DD, Cameroon time) with a finished lesson */
  @Prop() lastDay?: string;
  @Prop({ default: 20 }) dailyGoal: number;
  @Prop() todayKey?: string;
  @Prop({ default: 0 }) todayXp: number;
  @Prop({ default: 0 }) totalXp: number;
  @Prop() weekKey?: string;
  @Prop({ default: 0 }) weekXp: number;
  @Prop({ default: true }) reminders: boolean;
  @Prop({ type: [{ courseId: Types.ObjectId, completed: [String], xp: Number, _id: false }], default: [] })
  courses: { courseId: Types.ObjectId; completed: string[]; xp: number }[];
  /** Day a streak reminder was last sent (one a day at most) */
  @Prop() remindedDay?: string;
}
export type LanguageProfileDocument = LanguageProfile & Document;
export const LanguageProfileSchema = SchemaFactory.createForClass(LanguageProfile);
LanguageProfileSchema.index({ lastDay: 1, streak: 1 });
