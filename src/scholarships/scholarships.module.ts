import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScholarshipsController } from './scholarships.controller';
import { ScholarshipsService } from './scholarships.service';
import { SavedScholarship, SavedScholarshipSchema, Scholarship, ScholarshipSchema } from './schemas/scholarship.schema';
import { StudentProfile, StudentProfileSchema } from '../student-profiles/schemas/student-profile.schema';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Scholarship.name, schema: ScholarshipSchema },
      { name: SavedScholarship.name, schema: SavedScholarshipSchema },
      // Read-only: level and faculty for "matched for you"
      { name: StudentProfile.name, schema: StudentProfileSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [ScholarshipsController],
  providers: [ScholarshipsService],
})
export class ScholarshipsModule {}
