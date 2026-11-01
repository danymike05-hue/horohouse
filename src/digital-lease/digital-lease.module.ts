import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';

import { DigitalLeaseService } from './digital-lease.service';
import { DigitalLeaseController } from './digital-lease.controller';
import { DigitalLease, DigitalLeaseSchema } from './schemas/digital-lease.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { SplitPaymentsModule } from '../split-payments/split-payments.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DigitalLease.name, schema: DigitalLeaseSchema },
      { name: User.name, schema: UserSchema },
      { name: Property.name, schema: PropertySchema },
    ]),
    ConfigModule,
    NotificationsModule,
    // SplitPaymentsService.createCycle() called on lease activation
    SplitPaymentsModule,
  ],
  controllers: [DigitalLeaseController],
  providers: [DigitalLeaseService],
  exports: [DigitalLeaseService],
})
export class DigitalLeaseModule {}