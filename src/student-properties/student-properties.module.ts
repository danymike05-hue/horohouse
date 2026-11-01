import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { StudentPropertiesService } from './student-properties.service';
import { StudentPropertiesController } from './student-properties.controller';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Property.name, schema: PropertySchema },
      { name: User.name, schema: UserSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [StudentPropertiesController],
  providers: [StudentPropertiesService],
  exports: [StudentPropertiesService],
})
export class StudentPropertiesModule {}