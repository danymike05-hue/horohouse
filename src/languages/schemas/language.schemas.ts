import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export const LANGS = ['fr', 'en', 'zh'] as const;
export type Lang = (typeof LANGS)[number];
export const EXERCISE_TYPES = ['choice', 'tiles', 'type', 'match', 'fill', 'listen', 'speak'] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

/**
 * One screen of a lesson.
 * - choice: pick the right answer among options
 * - tiles: build the answer from word tiles (options = the tile bank)
 * - type: type the answer
 * - match: pair left and right items
 * - fill: choose the word that completes the sentence (prompt contains "___")
 * - listen: the prompt is spoken (not shown); type it, or pick it when options are given
 * - speak: say the prompt aloud; the phone's speech recognition checks it
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
  /** Short grammar / usage notes shown from the unit header (in the explanation language) */
  @Prop() tips?: string;
  /** Set on starter units, so later starter units can be added without duplicating or overwriting */
  @Prop() seedKey?: string;
}
export const UnitSchema = SchemaFactory.createForClass(Unit);

/** A short dialogue read line by line, then a few questions */
@Schema({ _id: true })
export class Story {
  @Prop({ required: true, trim: true }) title: string;
  @Prop({ default: 'A1' }) level: string;
  /** Unit it belongs to (shown after that unit); empty = available from the start */
  @Prop() unitSeedKey?: string;
  @Prop({ type: [{ speaker: String, text: String, romanization: String, translation: String, _id: false }], default: [] })
  lines: { speaker: string; text: string; romanization?: string; translation: string }[];
  @Prop({ type: [ExerciseSchema], default: [] }) questions: Exercise[];
  @Prop({ default: true }) isPublished: boolean;
  @Prop() seedKey?: string;
}
export const StorySchema = SchemaFactory.createForClass(Story);

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
  @Prop({ type: [StorySchema], default: [] }) stories: Story[];
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
  @Prop({
    type: [{
      courseId: Types.ObjectId, completed: [String], xp: Number,
      gold: { type: [String], default: [] }, checkpoints: { type: [String], default: [] },
      stories: { type: [String], default: [] }, bestMock: { type: Number, default: 0 }, _id: false,
    }],
    default: [],
  })
  courses: {
    courseId: Types.ObjectId; completed: string[]; xp: number;
    /** Lessons redone with no mistakes */
    gold?: string[];
    /** Units whose checkpoint test was passed */
    checkpoints?: string[];
    stories?: string[];
    /** Best mock-exam score, % */
    bestMock?: number;
  }[];
  /** Streak freezes held (max 2): a missed day uses one instead of breaking the streak */
  @Prop({ default: 0 }) freezes: number;
  /** Stars: earned in lessons, spent in the shop */
  @Prop({ default: 0 }) stars: number;
  /** Lives (max 5): a mistake in a lesson costs one; one comes back every few hours */
  @Prop({ default: 5 }) lives: number;
  @Prop() livesAt?: Date;
  @Prop({ type: [{ id: String, at: Date, _id: false }], default: [] }) badges: { id: string; at: Date }[];
  @Prop({ default: 0 }) lessonsDone: number;
  @Prop({ default: 0 }) perfectLessons: number;
  /** League division: 0 bronze … 4 diamond */
  @Prop({ default: 0 }) division: number;
  /** Last 14 days with practice (YYYY-MM-DD) */
  @Prop({ type: [String], default: [] }) activeDays: string[];
  /** Practice count per hour of the day (Cameroon time), for reminder timing */
  @Prop({ type: [Number], default: () => Array(24).fill(0) }) activeHours: number[];
  /** Week (Monday key) the weekly report was last sent for */
  @Prop() reportedWeek?: string;
  /** Week (Monday key) divisions were last settled for */
  @Prop() settledWeek?: string;
  /** Day a streak reminder was last sent (one a day at most) */
  @Prop() remindedDay?: string;
}
export type LanguageProfileDocument = LanguageProfile & Document;
export const LanguageProfileSchema = SchemaFactory.createForClass(LanguageProfile);
LanguageProfileSchema.index({ lastDay: 1, streak: 1 });

/**
 * How well a learner knows one exercise (Leitner boxes 0–5). Right answers move it up a box
 * and push the next review further out; a wrong answer sends it back to box 0.
 */
@Schema({ timestamps: true })
export class LanguageMemory {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) userId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, required: true }) courseId: Types.ObjectId;
  @Prop({ required: true }) exerciseId: string;
  @Prop({ default: 0, min: 0, max: 5 }) box: number;
  @Prop({ required: true }) due: Date;
  @Prop({ default: 0 }) seen: number;
  @Prop({ default: 0 }) wrong: number;
}
export type LanguageMemoryDocument = LanguageMemory & Document;
export const LanguageMemorySchema = SchemaFactory.createForClass(LanguageMemory);
LanguageMemorySchema.index({ userId: 1, exerciseId: 1 }, { unique: true });
LanguageMemorySchema.index({ userId: 1, courseId: 1, due: 1 });

/** Following another learner (friends list and shared weekly quest) */
@Schema({ timestamps: true })
export class LanguageFollow {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) userId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) followId: Types.ObjectId;
}
export type LanguageFollowDocument = LanguageFollow & Document;
export const LanguageFollowSchema = SchemaFactory.createForClass(LanguageFollow);
LanguageFollowSchema.index({ userId: 1, followId: 1 }, { unique: true });
