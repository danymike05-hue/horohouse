import { Module } from '@nestjs/common';
import { GeocodingController } from './geocoding.controller';
import { GeocodingService } from './geocoding.service';
import { NearbyService } from './nearby.service';

@Module({
  controllers: [GeocodingController],
  providers: [GeocodingService, NearbyService],
  exports: [GeocodingService, NearbyService],
})
export class GeocodingModule {}
