import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { RoommateMatchingService } from './roommate-matching.service';
import { RoommateMatchingController } from './roommate-matching.controller';
import { RoommateProfile, RoommateProfileSchema } from './schemas/roommate-profile.schema';
import { RoommateMatch, RoommateMatchSchema } from './schemas/roommate-match.schema';

import { StudentProfilesModule } from '../student-profiles/student-profiles.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatModule } from '../chat/chat.module';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RoommateProfile.name, schema: RoommateProfileSchema },
      { name: RoommateMatch.name, schema: RoommateMatchSchema },
      // User model needed to mirror studentProfile.roommateProfileId
      { name: User.name, schema: UserSchema },
    ]),
    // Imports StudentProfile model + exports IsVerifiedStudentGuard
    StudentProfilesModule,
    NotificationsModule,
    // ChatService.createRoom() is called when a match is confirmed
    ChatModule,
  ],
  controllers: [RoommateMatchingController],
  providers: [RoommateMatchingService],
  exports: [RoommateMatchingService],
})
export class RoommateMatchingModule {}