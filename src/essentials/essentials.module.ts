import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsModule } from '../notifications/notifications.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { DigitalLease, DigitalLeaseSchema } from '../digital-lease/schemas/digital-lease.schema';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { EssentialsAdminService } from './essentials-admin.service';
import { EssentialsController } from './essentials.controller';
import { EssentialsJobs } from './essentials.jobs';
import { EssentialsService } from './essentials.service';
import { PartnerService } from './partner.service';
import {
  EssCart,
  EssCartSchema,
  EssInterest,
  EssInterestSchema,
  EssItemOffer,
  EssItemOfferSchema,
  EssItemType,
  EssItemTypeSchema,
  EssKitOffer,
  EssKitOfferSchema,
  EssKitTemplate,
  EssKitTemplateSchema,
  EssMarket,
  EssMarketSchema,
  EssOrder,
  EssOrderSchema,
  EssPayout,
  EssPayoutSchema,
  EssShop,
  EssShopSchema,
} from './schemas/essentials.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EssMarket.name, schema: EssMarketSchema },
      { name: EssItemType.name, schema: EssItemTypeSchema },
      { name: EssKitTemplate.name, schema: EssKitTemplateSchema },
      { name: EssShop.name, schema: EssShopSchema },
      { name: EssKitOffer.name, schema: EssKitOfferSchema },
      { name: EssItemOffer.name, schema: EssItemOfferSchema },
      { name: EssCart.name, schema: EssCartSchema },
      { name: EssOrder.name, schema: EssOrderSchema },
      { name: EssPayout.name, schema: EssPayoutSchema },
      { name: EssInterest.name, schema: EssInterestSchema },
      // Read-only: names and phones, the student's lease for the delivery address
      { name: User.name, schema: UserSchema },
      { name: DigitalLease.name, schema: DigitalLeaseSchema },
      { name: Property.name, schema: PropertySchema },
    ]),
    NotificationsModule,
  ],
  controllers: [EssentialsController],
  providers: [EssentialsService, PartnerService, EssentialsAdminService, EssentialsJobs],
  exports: [EssentialsService],
})
export class EssentialsModule {}
