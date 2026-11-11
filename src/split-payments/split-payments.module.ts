import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { SplitPaymentsService } from './split-payments.service';
import { SplitPaymentsController } from './split-payments.controller';
import { SplitPayment, SplitPaymentSchema } from './schemas/split-payment.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { NotificationsModule } from '../notifications/notifications.module';
// FlutterwaveService lives in PaymentsModule — import the module to access it
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SplitPayment.name, schema: SplitPaymentSchema },
      { name: User.name, schema: UserSchema },
    ]),
    NotificationsModule,
    // Gives us FlutterwaveService via PaymentsModule exports
    PaymentsModule,
  ],
  controllers: [SplitPaymentsController],
  providers: [SplitPaymentsService],
  exports: [SplitPaymentsService],
})
export class SplitPaymentsModule {}