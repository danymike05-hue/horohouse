import {
  Controller,
  Post,
  Body,
  Patch,
  Query,
  Get,
  Header,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NewsletterService } from './newsletter.service';
import { SubscribeNewsletterDto } from './dto/newsletter.dto';
import { isValidUnsubscribeToken } from './unsubscribe-token';

@ApiTags('Newsletter')
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Post('subscribe')
  @ApiOperation({ summary: 'Subscribe to newsletter' })
  subscribe(@Body() dto: SubscribeNewsletterDto) {
    return this.newsletterService.subscribe(dto);
  }

  /** From the website or app: needs the token of the email's unsubscribe link */
  @Patch('unsubscribe')
  @ApiOperation({
    summary: 'Unsubscribe from newsletter (signed link token required)',
  })
  unsubscribe(@Query('email') email: string, @Query('token') token: string) {
    if (!isValidUnsubscribeToken(email, token))
      throw new ForbiddenException('This unsubscribe link is not valid.');
    return this.newsletterService.unsubscribe(email);
  }

  /** The link in the newsletter email: unsubscribes and shows a short page */
  @Get('unsubscribe')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({ summary: 'Unsubscribe from the newsletter email link' })
  async unsubscribeFromEmail(
    @Query('email') email: string,
    @Query('token') token: string,
  ) {
    const ok = isValidUnsubscribeToken(email, token);
    if (ok) await this.newsletterService.unsubscribe(email);
    const [title, text] = ok
      ? [
          'You are unsubscribed',
          'You will no longer receive the HoroHouse newsletter. / Vous ne recevrez plus la newsletter HoroHouse.',
        ]
      : [
          'This link is not valid',
          'Use the unsubscribe link from your latest email. / Utilisez le lien de votre dernier e-mail.',
        ];
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HoroHouse</title></head>
<body style="font-family:system-ui,sans-serif;background:#F3F7FF;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px">
<div style="background:#fff;border-radius:20px;padding:32px;max-width:420px;text-align:center;box-shadow:0 10px 30px rgba(16,32,74,.08)">
<h1 style="font-size:22px;color:#10204A;margin:0 0 10px">${title}</h1><p style="color:#5B6785;line-height:1.5;margin:0">${text}</p></div></body></html>`;
  }
}
