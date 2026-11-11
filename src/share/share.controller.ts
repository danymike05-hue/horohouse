import { Controller, Get, Header, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard, Public } from '../auth/guards/roles.guard';
import { ShareService } from './share.service';

const langOf = (l?: string) => (String(l ?? '').toLowerCase().startsWith('fr') ? 'fr' : 'en');

/**
 * QR codes and printable posters for listings and host profiles. Public: they only
 * contain what the public listing / profile page already shows.
 */
@ApiTags('Share')
@Controller('share')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShareController {
  constructor(private readonly share: ShareService) {}

  @Get('property/:id')
  @Public()
  @ApiOperation({ summary: 'Share link + QR code (PNG data URL) for a listing' })
  @ApiQuery({ name: 'lang', required: false })
  property(@Param('id') id: string, @Query('lang') lang?: string) {
    return this.share.getPropertyShare(id, langOf(lang));
  }

  @Get('host/:id')
  @Public()
  @ApiOperation({ summary: 'Share link + QR code (PNG data URL) for a host profile' })
  @ApiQuery({ name: 'lang', required: false })
  host(@Param('id') id: string, @Query('lang') lang?: string) {
    return this.share.getHostShare(id, langOf(lang));
  }

  @Get('property/:id/poster')
  @Public()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({ summary: 'Printable QR poster for a listing (HTML)' })
  propertyPoster(@Param('id') id: string, @Query('lang') lang?: string) {
    return this.share.propertyPoster(id, langOf(lang));
  }

  @Get('host/:id/poster')
  @Public()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({ summary: 'Printable QR poster for a host profile (HTML)' })
  hostPoster(@Param('id') id: string, @Query('lang') lang?: string) {
    return this.share.hostPoster(id, langOf(lang));
  }
}
