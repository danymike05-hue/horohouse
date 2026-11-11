import { Controller, Get, Module, Param, Req, UseGuards } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { CoHostsModule } from '../co-hosts/co-hosts.module';
import { PaymentsModule } from '../payments/payments.module';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Room, RoomSchema } from '../rooms/schemas/room.schema';
import { PriceSuggestionsService } from './price-suggestions.service';

@ApiTags('Price suggestions')
@ApiBearerAuth('JWT-auth')
@Controller('price-suggestions')
@UseGuards(JwtAuthGuard)
export class PriceSuggestionsController {
  constructor(private readonly suggestions: PriceSuggestionsService) {}

  @Get(':propertyId')
  @ApiOperation({ summary: 'A nightly price based on what similar listings ask (plans with smart pricing)' })
  forListing(@Param('propertyId') propertyId: string, @Req() req: any) {
    return this.suggestions.forListing(req.user, propertyId);
  }
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Property.name, schema: PropertySchema },
      { name: Room.name, schema: RoomSchema },
    ]),
    PaymentsModule,
    CoHostsModule,
  ],
  controllers: [PriceSuggestionsController],
  providers: [PriceSuggestionsService],
})
export class PriceSuggestionsModule {}
