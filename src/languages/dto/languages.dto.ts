import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { EXERCISE_TYPES, LANGS } from '../schemas/language.schemas';

const LANG_LIST = LANGS as unknown as string[];

export class CompleteLessonDto {
  @IsInt() @Min(0) @Max(100) mistakes: number;
  @IsInt() @Min(1) @Max(100) total: number;
}

export class UpdateLanguageProfileDto {
  @IsOptional() @IsIn([10, 20, 30, 50]) dailyGoal?: number;
  @IsOptional() @IsBoolean() reminders?: boolean;
}

class PairDto {
  @IsString() @Length(1, 120) left: string;
  @IsString() @Length(1, 120) right: string;
}

export class ExerciseDto {
  @IsIn(EXERCISE_TYPES as unknown as string[]) type: string;
  @IsOptional() @IsIn(['translate', 'meaning', 'pairs', 'complete']) instruction?: string;
  @IsOptional() @IsString() @MaxLength(300) prompt?: string;
  @IsOptional() @IsString() @MaxLength(300) promptRomanization?: string;
  @IsOptional() @IsIn(LANG_LIST) promptLang?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(300, { each: true }) answers?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(16) @IsString({ each: true }) @MaxLength(120, { each: true }) options?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(16) @IsString({ each: true }) @MaxLength(120, { each: true }) optionsRomanization?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(6) @ValidateNested({ each: true }) @Type(() => PairDto) pairs?: PairDto[];
  @IsOptional() @IsIn(LANG_LIST) answerLang?: string;
  @IsOptional() @IsString() @MaxLength(300) explanation?: string;
}

export class CourseDto {
  @IsString() @Length(3, 60) slug: string;
  @IsIn(LANG_LIST) targetLang: string;
  @IsIn(LANG_LIST) baseLang: string;
  @IsString() @Length(2, 60) titleEn: string;
  @IsString() @Length(2, 60) titleFr: string;
  @IsOptional() @IsString() @MaxLength(300) descriptionEn?: string;
  @IsOptional() @IsString() @MaxLength(300) descriptionFr?: string;
}

export class UpdateCourseDto {
  @IsOptional() @IsString() @Length(2, 60) titleEn?: string;
  @IsOptional() @IsString() @Length(2, 60) titleFr?: string;
  @IsOptional() @IsString() @MaxLength(300) descriptionEn?: string;
  @IsOptional() @IsString() @MaxLength(300) descriptionFr?: string;
  @IsOptional() @IsBoolean() isPublished?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(999) order?: number;
}

export class UnitDto {
  @IsString() @Length(2, 80) title: string;
  @IsOptional() @IsString() @MaxLength(200) description?: string;
  @IsOptional() @IsIn(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) level?: string;
}

export class LessonDto {
  @IsString() @Length(2, 80) title: string;
}

export class UpdateLessonDto {
  @IsOptional() @IsString() @Length(2, 80) title?: string;
  @IsOptional() @IsBoolean() isPublished?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => ExerciseDto) exercises?: ExerciseDto[];
}

export class DraftDto {
  @IsIn(LANG_LIST) targetLang: string;
  @IsIn(LANG_LIST) baseLang: string;
  @IsString() @Length(3, 120) theme: string;
  @IsOptional() @IsIn(['A1', 'A2', 'B1', 'B2']) level?: string;
}
