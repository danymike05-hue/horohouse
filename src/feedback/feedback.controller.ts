import { Body, Controller, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { Public } from '../auth/guards/roles.guard';
import { FeedbackService } from './feedback.service';
import { FEEDBACK_CATEGORIES } from './feedback.schema';

class CreateFeedbackDto {
  @IsOptional() @IsInt() @Min(1) @Max(3) rating?: number;
  @IsOptional() @IsIn([...FEEDBACK_CATEGORIES]) category?: string;
  @IsString() @Length(3, 2000) message: string;
  @IsOptional() @IsString() @Length(1, 80) device?: string;
}

@ApiTags('feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) { }

  /** Open to everyone; a logged-in sender is recorded. */
  @Post()
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send feedback about the app' })
  create(@Body() dto: CreateFeedbackDto, @Req() req: any) {
    return this.feedback.create(dto, req.user);
  }
}
