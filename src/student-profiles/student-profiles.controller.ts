import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';

import { StudentProfilesService } from './student-profiles.service';
import {
  CreateStudentProfileDto,
  UpdateStudentProfileDto,
  ReviewStudentIdDto,
  GrantAmbassadorDto,
  GetStudentProfilesQueryDto,
} from './dto/student-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { IsVerifiedStudentGuard } from './guards/is-verified-student.guard';
import { User, UserRole } from '../users/schemas/user.schema';

@ApiTags('Student Profiles')
@ApiBearerAuth('JWT-auth')
@Controller('student-profiles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentProfilesController {
  constructor(private readonly studentProfilesService: StudentProfilesService) {}

  // ══════════════════════════════════════════════════════════════════════════
  // STUDENT — own profile
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * POST /student-profiles
   * First-time onboarding. Creates a StudentProfile and flips the user's role
   * to STUDENT. Returns 409 if a profile already exists.
   */
  @Post()
  @ApiOperation({ summary: 'Onboard as a student — create your student profile' })
  @ApiResponse({ status: 201, description: 'Student profile created successfully' })
  @ApiResponse({ status: 409, description: 'Profile already exists' })
  async create(
    @Req() req: FastifyRequest & { user: User },
    @Body() dto: CreateStudentProfileDto,
  ) {
    return this.studentProfilesService.create(req.user._id.toString(), dto);
  }

  /**
   * GET /student-profiles/me
   * Returns the calling student's full profile.
   */
  @Get('me')
  @ApiOperation({ summary: 'Get your student profile' })
  @ApiResponse({ status: 200, description: 'Student profile returned' })
  @ApiResponse({ status: 404, description: 'No profile found — complete onboarding first' })
  async getMyProfile(@Req() req: FastifyRequest & { user: User }) {
    return this.studentProfilesService.findMyProfile(req.user._id.toString());
  }

  /**
   * PATCH /student-profiles/me
   * Update university, campus, roommate mode, etc.
   */
  @Patch('me')
  @ApiOperation({ summary: 'Update your student profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  async updateMyProfile(
    @Req() req: FastifyRequest & { user: User },
    @Body() dto: UpdateStudentProfileDto,
  ) {
    return this.studentProfilesService.update(req.user._id.toString(), dto);
  }

  /**
   * POST /student-profiles/me/student-id
   * Upload or replace the university ID photo.
   * Accepts multipart/form-data with a single image file in the "file" field.
   * Sets verificationStatus to PENDING automatically.
   */
  @Post('me/student-id')
  @ApiOperation({ summary: 'Upload your university ID for verification' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'ID uploaded — status set to PENDING' })
  @ApiResponse({ status: 400, description: 'No file provided or unsupported format' })
  async uploadStudentId(@Req() req: FastifyRequest & { user: User }) {
    const data = await (req as any).file();

    if (!data) {
      throw new BadRequestException('No file uploaded');
    }

    const allowedMimetypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!allowedMimetypes.includes(data.mimetype)) {
      throw new BadRequestException(
        'Unsupported file type. Please upload a JPEG, PNG, WebP, or HEIC image.',
      );
    }

    const buffer = await data.toBuffer();

    return this.studentProfilesService.uploadStudentId(req.user._id.toString(), {
      buffer,
      mimetype: data.mimetype,
    });
  }

  /**
   * GET /student-profiles/me/verification-status
   * Lightweight endpoint — returns just the verification status and reason.
   * Useful for polling from the frontend after upload.
   */
  @Get('me/verification-status')
  @ApiOperation({ summary: 'Check your current ID verification status' })
  @ApiResponse({ status: 200, description: 'Verification status returned' })
  async getVerificationStatus(@Req() req: FastifyRequest & { user: User }) {
    const profile = await this.studentProfilesService.findMyProfile(
      req.user._id.toString(),
    );

    return {
      verificationStatus: profile.verificationStatus,
      verificationSubmittedAt: profile.verificationSubmittedAt,
      verificationReviewedAt: profile.verificationReviewedAt,
      rejectionReason: profile.verificationRejectionReason ?? null,
    };
  }

  /**
   * GET /student-profiles/me/ambassador-stats
   * Returns ambassador earnings and referral counts for the dashboard.
   * Only meaningful when isAmbassador === true, but safe to call regardless.
   */
  @Get('me/ambassador-stats')
  @ApiOperation({ summary: 'Get your ambassador earnings and referral stats' })
  @ApiResponse({ status: 200, description: 'Ambassador stats returned' })
  async getAmbassadorStats(@Req() req: FastifyRequest & { user: User }) {
    const profile = await this.studentProfilesService.findMyProfile(
      req.user._id.toString(),
    );

    return {
      isAmbassador: profile.isAmbassador,
      ambassadorCode: profile.ambassadorCode ?? null,
      ambassadorEarnings: profile.ambassadorEarnings,
      referralCount: profile.referralCount,
      landlordReferralCount: profile.landlordReferralCount,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VERIFIED STUDENT — protected by IsVerifiedStudentGuard
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GET /student-profiles/verified-check
   * Dummy endpoint the frontend can hit to confirm the student passes the guard.
   * Returns 200 if verified, 403 with a human-readable message otherwise.
   */
  @Get('verified-check')
  @UseGuards(IsVerifiedStudentGuard)
  @ApiOperation({ summary: 'Check if the current user passes student verification' })
  @ApiResponse({ status: 200, description: 'User is a verified student' })
  @ApiResponse({ status: 403, description: 'Not verified — message explains why' })
  @HttpCode(HttpStatus.OK)
  verifiedCheck() {
    return { verified: true, message: 'You have full student access.' };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC — ambassador code resolution
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GET /student-profiles/ambassador/:code
   * Public endpoint used during signup — validates a referral code.
   * Returns 404 if the code is invalid or not an active ambassador.
   */
  @Get('ambassador/:code')
  @ApiOperation({ summary: 'Validate an ambassador referral code' })
  @ApiParam({ name: 'code', description: 'Ambassador referral code (case-insensitive)' })
  @ApiResponse({ status: 200, description: 'Valid ambassador code' })
  @ApiResponse({ status: 404, description: 'Invalid or inactive ambassador code' })
  async resolveAmbassadorCode(@Param('code') code: string) {
    const result = await this.studentProfilesService.resolveAmbassadorCode(code);

    if (!result) {
      // Return a generic 404 — don't expose whether the code exists at all
      throw new BadRequestException(
        'Invalid referral code. Please check and try again.',
      );
    }

    return { valid: true, message: 'Referral code accepted.' };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ADMIN — verification queue and ambassador management
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GET /student-profiles/admin/all
   * Paginated list of student profiles with filters.
   * Default: returns PENDING profiles first for the review queue.
   */
  @Get('admin/all')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: list all student profiles with filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of student profiles' })
  async adminFindAll(@Query() query: GetStudentProfilesQueryDto) {
    return this.studentProfilesService.findAll(query);
  }

  /**
   * GET /student-profiles/admin/stats
   * Dashboard stats: totals by verification status, city, ambassador count.
   */
  @Get('admin/stats')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: student profile stats for the dashboard' })
  @ApiResponse({ status: 200, description: 'Stats returned' })
  async adminGetStats() {
    return this.studentProfilesService.getStats();
  }

  /**
   * GET /student-profiles/admin/:id
   * Full details of a single student profile for the review UI.
   */
  @Get('admin/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: get a student profile by ID' })
  @ApiParam({ name: 'id', description: 'StudentProfile document ID' })
  @ApiResponse({ status: 200, description: 'Profile returned' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async adminFindOne(@Param('id') id: string) {
    return this.studentProfilesService.findById(id);
  }

  /**
   * PATCH /student-profiles/admin/:id/review
   * Approve or reject a student's submitted ID.
   * Triggers a notification to the student automatically.
   */
  @Patch('admin/:id/review')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: approve or reject a student ID' })
  @ApiParam({ name: 'id', description: 'StudentProfile document ID' })
  @ApiResponse({ status: 200, description: 'Review decision saved and student notified' })
  @ApiResponse({ status: 400, description: 'Profile not in PENDING state, or missing rejection reason' })
  async reviewStudentId(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: User },
    @Body() dto: ReviewStudentIdDto,
  ) {
    return this.studentProfilesService.reviewStudentId(
      id,
      req.user._id.toString(),
      dto,
    );
  }

  /**
   * PATCH /student-profiles/admin/:id/ambassador
   * Grant ambassador status and assign a unique referral code.
   * Only verified students can be appointed.
   */
  @Patch('admin/:id/ambassador')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: grant campus ambassador status' })
  @ApiParam({ name: 'id', description: 'StudentProfile document ID' })
  @ApiResponse({ status: 200, description: 'Ambassador status granted' })
  @ApiResponse({ status: 403, description: 'Student not yet verified' })
  @ApiResponse({ status: 409, description: 'Ambassador code already in use' })
  async grantAmbassador(
    @Param('id') id: string,
    @Body() dto: GrantAmbassadorDto,
  ) {
    return this.studentProfilesService.grantAmbassador(id, dto);
  }
}