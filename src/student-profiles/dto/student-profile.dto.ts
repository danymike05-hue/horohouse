import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsIn,
  Length,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { StudentVerificationStatus } from '../../users/schemas/user.schema';

// ─── Create / onboard ────────────────────────────────────────────────────────

export class CreateStudentProfileDto {
  @ApiProperty({ example: 'University of Buea', description: 'Full university name' })
  @IsString()
  @Length(2, 100)
  universityName: string;

  @ApiProperty({ example: 'Yaoundé', description: 'City where the campus is located' })
  @IsString()
  @Length(2, 50)
  campusCity: string;

  @ApiProperty({ example: 'University of Buea Main Campus', description: 'Specific campus name' })
  @IsString()
  @Length(2, 120)
  campusName: string;

  @ApiPropertyOptional({ example: 'Faculty of Engineering and Technology' })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  faculty?: string;

  @ApiPropertyOptional({ example: 'L3', description: 'Study level — L1, L2, L3, Master 1, Master 2, PhD' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  studyLevel?: string;

  @ApiPropertyOptional({ example: 2022 })
  @IsOptional()
  @IsNumber()
  @Min(2000)
  @Max(new Date().getFullYear())
  enrollmentYear?: number;

  @ApiPropertyOptional({ example: 4.0511, description: 'Latitude of the nearest campus gate' })
  @IsOptional()
  @IsNumber()
  campusLatitude?: number;

  @ApiPropertyOptional({ example: 9.7679, description: 'Longitude of the nearest campus gate' })
  @IsOptional()
  @IsNumber()
  campusLongitude?: number;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export class UpdateStudentProfileDto extends PartialType(CreateStudentProfileDto) {
  @ApiPropertyOptional({
    example: 'need_room',
    enum: ['have_room', 'need_room'],
    description: 'Whether student has a spare room or needs one',
  })
  @IsOptional()
  @IsIn(['have_room', 'need_room'])
  roommateMode?: 'have_room' | 'need_room';

  @ApiPropertyOptional({ example: true, description: 'Whether student is actively seeking a roommate' })
  @IsOptional()
  @IsBoolean()
  isSeekingRoommate?: boolean;
}

// ─── Admin: review a submitted student ID ────────────────────────────────────

export class ReviewStudentIdDto {
  @ApiProperty({
    enum: [StudentVerificationStatus.VERIFIED, StudentVerificationStatus.REJECTED],
    description: 'Approve or reject the submitted student ID',
  })
  @IsEnum([StudentVerificationStatus.VERIFIED, StudentVerificationStatus.REJECTED])
  decision: StudentVerificationStatus.VERIFIED | StudentVerificationStatus.REJECTED;

  @ApiPropertyOptional({
    example: 'ID appears expired. Please upload a valid document.',
    description: 'Required when decision is rejected — shown to the student',
  })
  @IsOptional()
  @IsString()
  @Length(5, 500)
  rejectionReason?: string;
}

// ─── Admin: grant ambassador status ──────────────────────────────────────────

export class GrantAmbassadorDto {
  @ApiProperty({ example: 'UB-PAUL-2025', description: 'Unique referral code for the ambassador' })
  @IsString()
  @Length(4, 30)
  ambassadorCode: string;
}

// ─── Query filters for admin list ─────────────────────────────────────────────

export class GetStudentProfilesQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: StudentVerificationStatus })
  @IsOptional()
  @IsEnum(StudentVerificationStatus)
  verificationStatus?: StudentVerificationStatus;

  @ApiPropertyOptional({ example: 'Buea' })
  @IsOptional()
  @IsString()
  campusCity?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isAmbassador?: boolean;
}