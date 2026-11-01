import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';

import { StudentProfilesService } from './student-profiles.service';
import { StudentProfilesController } from './student-profiles.controller';
import { IsVerifiedStudentGuard } from './guards/is-verified-student.guard';
import { StudentProfile, StudentProfileSchema } from './schemas/student-profile.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StudentProfile.name, schema: StudentProfileSchema },
      // User model needed to mirror studentProfile subdocument and flip roles
      { name: User.name, schema: UserSchema },
    ]),
    ConfigModule,
    NotificationsModule,
  ],
  controllers: [StudentProfilesController],
  providers: [StudentProfilesService, IsVerifiedStudentGuard],
  exports: [
    StudentProfilesService,
    IsVerifiedStudentGuard,
    // Export MongooseModule so RoommateMatchingModule can inject StudentProfile model
    MongooseModule,
  ],
})
export class StudentProfilesModule {}