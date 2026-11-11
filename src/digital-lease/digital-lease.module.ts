import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';

import { DigitalLeaseService } from './digital-lease.service';
import { DigitalLeaseController } from './digital-lease.controller';
import { DigitalLease, DigitalLeaseSchema } from './schemas/digital-lease.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Inquiry, InquirySchema } from '../properties/schemas/inquiry.schema';
import { Appointment, AppointmentSchema } from '../appointments/schemas/appointment.schema';
import { LeaseTenantsService } from './lease-tenants.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { SplitPaymentsModule } from '../split-payments/split-payments.module';
import { StudentProfilesModule } from '../student-profiles/student-profiles.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DigitalLease.name, schema: DigitalLeaseSchema },
      { name: User.name, schema: UserSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Inquiry.name, schema: InquirySchema },
      { name: Appointment.name, schema: AppointmentSchema },
    ]),
    ConfigModule,
    NotificationsModule,
    // SplitPaymentsService.createCycle() called on lease activation
    SplitPaymentsModule,
    // Ambassador rewards when a referred tenant's lease becomes active
    StudentProfilesModule,
  ],
  controllers: [DigitalLeaseController],
  providers: [DigitalLeaseService, LeaseTenantsService],
  exports: [DigitalLeaseService],
})
export class DigitalLeaseModule {}