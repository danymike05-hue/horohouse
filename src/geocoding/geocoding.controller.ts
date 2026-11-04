import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard, Public } from '../auth/guards/roles.guard';
import { GeocodingService } from './geocoding.service';

@ApiTags('Geocoding')
@Controller('geocode')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GeocodingController {
  constructor(private readonly geocoding: GeocodingService) {}

  @Get('search')
  @Public()
  @ApiOperation({ summary: 'Address / place search (OpenStreetMap, cached)' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'countrycodes', required: false, description: 'e.g. cm or cm,ng,ga' })
  @ApiQuery({ name: 'viewbox', required: false, description: 'lon_min,lat_max,lon_max,lat_min (soft bias)' })
  @ApiQuery({ name: 'lang', required: false, description: 'fr | en' })
  search(
    @Query('q') q: string,
    @Query('limit') limit?: string,
    @Query('countrycodes') countrycodes?: string,
    @Query('viewbox') viewbox?: string,
    @Query('lang') lang?: string,
  ) {
    return this.geocoding.search({ q, limit: Number(limit), countrycodes, viewbox, lang });
  }

  @Get('reverse')
  @Public()
  @ApiOperation({ summary: 'Address for a map point (OpenStreetMap, cached)' })
  @ApiQuery({ name: 'lat', required: true, type: Number })
  @ApiQuery({ name: 'lon', required: true, type: Number })
  @ApiQuery({ name: 'lang', required: false })
  reverse(@Query('lat') lat: string, @Query('lon') lon: string, @Query('lang') lang?: string) {
    return this.geocoding.reverse(parseFloat(lat), parseFloat(lon), lang);
  }
}
