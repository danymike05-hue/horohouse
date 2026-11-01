import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { StudentVerificationStatus, UserRole } from '../../users/schemas/user.schema';
import {
  StudentProfile,
  StudentProfileDocument,
} from '../schemas/student-profile.schema';

/**
 * IsVerifiedStudentGuard
 *
 * Gates any route that requires a fully verified student identity.
 * Use this on:
 *  - Roommate pool access (browse + create roommate profile)
 *  - Student-only chat initiation
 *  - Student-Approved landlord contact requests
 *
 * Admins always pass through.
 *
 * IMPORTANT: This guard queries the StudentProfile collection directly rather
 * than trusting the JWT payload. This ensures that a student who was just
 * verified sees the correct status immediately without needing to re-login
 * and get a new token.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, IsVerifiedStudentGuard)
 *   @Get('roommates')
 *   async getRoommates() { ... }
 */
@Injectable()
export class IsVerifiedStudentGuard implements CanActivate {
  constructor(
    @InjectModel(StudentProfile.name)
    private studentProfileModel: Model<StudentProfileDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    // Admins bypass student verification checks
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // Must have the STUDENT role
    if (user.role !== UserRole.STUDENT) {
      throw new ForbiddenException(
        'This feature is only available to registered students. ' +
        'Switch to Student mode in your profile settings.',
      );
    }

    // ── Live DB check ─────────────────────────────────────────────────────
    // Do NOT trust user.studentProfile.verificationStatus from the JWT —
    // the token may have been issued before the admin approved the ID.
    // Query the StudentProfile collection for the current status.

    const studentProfile = await this.studentProfileModel
      .findOne({ userId: new Types.ObjectId(user._id ?? user.id) })
      .select('verificationStatus')
      .lean()
      .exec();

    const verificationStatus = studentProfile?.verificationStatus;

    if (verificationStatus !== StudentVerificationStatus.VERIFIED) {
      const messages: Record<string, string> = {
        [StudentVerificationStatus.UNVERIFIED]:
          'Please upload your university ID to access this feature.',
        [StudentVerificationStatus.PENDING]:
          'Your student ID is under review. You will be notified once approved (usually within 24h).',
        [StudentVerificationStatus.REJECTED]:
          'Your student ID was rejected. Please upload a valid document and resubmit.',
      };

      throw new ForbiddenException(
        messages[verificationStatus ?? StudentVerificationStatus.UNVERIFIED] ??
        'Student verification required to access this feature.',
      );
    }

    return true;
  }
}