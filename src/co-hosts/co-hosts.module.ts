import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsModule } from '../notifications/notifications.module';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { CoHostsController } from './co-hosts.controller';
import { CoHostsService } from './co-hosts.service';
import { CoHost, CoHostSchema } from './schemas/co-host.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CoHost.name, schema: CoHostSchema },
      { name: Property.name, schema: PropertySchema },
      { name: User.name, schema: UserSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [CoHostsController],
  providers: [CoHostsService],
  exports: [CoHostsService],
})
export class CoHostsModule {}
