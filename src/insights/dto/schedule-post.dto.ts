import { IsDateString } from "class-validator";

export class SchedulePostDto {
  @IsDateString()
  scheduledAt: string;
}