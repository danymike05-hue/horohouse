import { Body, Controller, Get, Module, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsIn } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { Message, MessageSchema } from '../chat/schemas/message.schema';
import { Review, ReviewSchema } from '../reviews/schemas/review.schema';
import {
  Translation,
  TRANSLATION_LANGUAGES,
  TranslationLanguage,
  TranslationSchema,
  TranslationsService,
} from './translations.service';

class TranslateDto {
  @IsIn(TRANSLATION_LANGUAGES as unknown as string[])
  target: TranslationLanguage;
}

/**
 * Translates messages and reviews by id, never text sent by the app: the server checks who
 * may read it, and this can't be used as a free translation service on the owner's bill.
 */
@ApiTags('Translations')
@ApiBearerAuth('JWT-auth')
@Controller('translations')
@UseGuards(JwtAuthGuard)
export class TranslationsController {
  constructor(private readonly translations: TranslationsService) {}

  @Get('status')
  @ApiOperation({ summary: 'Whether translation is switched on' })
  status() {
    return { enabled: this.translations.enabled };
  }

  @Post('message/:id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Translate a message from a conversation you are in' })
  message(@Param('id') id: string, @Body() dto: TranslateDto, @Req() req: any) {
    return this.translations.translateMessage(String(req.user._id ?? req.user.id), id, dto.target);
  }

  @Post('review/:id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Translate a published review' })
  review(@Param('id') id: string, @Body() dto: TranslateDto, @Req() req: any) {
    return this.translations.translateReview(String(req.user._id ?? req.user.id), id, dto.target);
  }
}

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Translation.name, schema: TranslationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Review.name, schema: ReviewSchema },
    ]),
  ],
  controllers: [TranslationsController],
  providers: [TranslationsService],
})
export class TranslationsModule {}
