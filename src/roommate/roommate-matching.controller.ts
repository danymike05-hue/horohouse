import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';

import { RoommateMatchingService } from './roommate-matching.service';
import {
  CreateRoommateProfileDto,
  UpdateRoommateProfileDto,
  SearchRoommatesDto,
} from './dto/roommate.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { IsVerifiedStudentGuard } from '../student-profiles/guards/is-verified-student.guard';
import { User } from '../users/schemas/user.schema';

@ApiTags('Roommate Matching')
@ApiBearerAuth('JWT-auth')
@Controller('roommate-matching')
@UseGuards(JwtAuthGuard, RolesGuard)
// ↑ IsVerifiedStudentGuard removed from class level — applied per-route below
// so that read-your-own-data endpoints (/profile/me, /matches) are accessible
// to any authenticated student regardless of verification status.
export class RoommateMatchingController {
  constructor(private readonly roommateMatchingService: RoommateMatchingService) {}

  // ══════════════════════════════════════════════════════════════════════════
  // PROFILE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * POST /roommate-matching/profile
   * Create the calling student's roommate profile.
   * Gated by IsVerifiedStudentGuard — 403 if ID not yet approved.
   */
  @Post('profile')
  @UseGuards(IsVerifiedStudentGuard)
  @ApiOperation({ summary: 'Create your roommate profile (verified students only)' })
  @ApiResponse({ status: 201, description: 'Profile created and added to the roommate pool' })
  @ApiResponse({ status: 403, description: 'Student ID not verified' })
  @ApiResponse({ status: 409, description: 'Profile already exists — use PATCH to update' })
  async createProfile(
    @Req() req: FastifyRequest & { user: User },
    @Body() dto: CreateRoommateProfileDto,
  ) {
    return this.roommateMatchingService.createProfile(
      req.user._id.toString(),
      dto,
    );
  }

  /**
   * GET /roommate-matching/profile/me
   * Returns the calling student's own roommate profile.
   * No verification guard — any authenticated student can check their own profile
   * (e.g. to show "you don't have a profile yet" UI state).
   *
   * IMPORTANT: this route MUST be declared before GET /profile/:id so that
   * the literal string "me" is not matched as a MongoDB ObjectId param.
   */
  @Get('profile/me')
  @ApiOperation({ summary: 'Get your roommate profile' })
  @ApiResponse({ status: 200, description: 'Roommate profile returned' })
  @ApiResponse({ status: 404, description: 'No profile found — create one first' })
  async getMyProfile(@Req() req: FastifyRequest & { user: User }) {
    return this.roommateMatchingService.findMyProfile(req.user._id.toString());
  }

  /**
   * PATCH /roommate-matching/profile/me
   * Update lifestyle preferences, budget, move-in date, etc.
   * No verification guard — students can update even while pending verification.
   */
  @Patch('profile/me')
  @ApiOperation({ summary: 'Update your roommate profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  async updateMyProfile(
    @Req() req: FastifyRequest & { user: User },
    @Body() dto: UpdateRoommateProfileDto,
  ) {
    return this.roommateMatchingService.updateProfile(
      req.user._id.toString(),
      dto,
    );
  }

  /**
   * DELETE /roommate-matching/profile/me
   * Soft-deactivates the profile — pauses visibility without deleting match history.
   */
  @Delete('profile/me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause your roommate profile (soft deactivate)' })
  @ApiResponse({ status: 200, description: 'Profile paused' })
  async deactivateMyProfile(@Req() req: FastifyRequest & { user: User }) {
    return this.roommateMatchingService.deactivateProfile(req.user._id.toString());
  }

  /**
   * PATCH /roommate-matching/profile/me/reactivate
   * Re-enables a previously paused profile.
   * Must be declared before /profile/:id to avoid "me" being treated as an id param.
   */
  @Patch('profile/me/reactivate')
  @ApiOperation({ summary: 'Reactivate your paused roommate profile' })
  @ApiResponse({ status: 200, description: 'Profile reactivated' })
  async reactivateMyProfile(@Req() req: FastifyRequest & { user: User }) {
    return this.roommateMatchingService.reactivateProfile(req.user._id.toString());
  }

  /**
   * GET /roommate-matching/profile/:id
   * View another student's public roommate profile.
   * Requires verification — only verified students can view the pool.
   * Declared AFTER /profile/me so "me" is never matched here.
   */
  @Get('profile/:id')
  @UseGuards(IsVerifiedStudentGuard)
  @ApiOperation({ summary: "View another student's roommate profile" })
  @ApiParam({ name: 'id', description: 'RoommateProfile document ID' })
  @ApiResponse({ status: 200, description: 'Roommate profile returned' })
  @ApiResponse({ status: 404, description: 'Profile not found or inactive' })
  async getProfileById(@Param('id') id: string) {
    return this.roommateMatchingService.findProfileById(id);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BROWSE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GET /roommate-matching/search
   * Browse the roommate pool. Results exclude already-interacted profiles
   * and are sorted by compatibility score desc.
   * Requires verification — pool is only visible to verified students.
   */
  @Get('search')
  @UseGuards(IsVerifiedStudentGuard)
  @ApiOperation({ summary: 'Browse the roommate pool sorted by compatibility' })
  @ApiResponse({ status: 200, description: 'Paginated roommate profiles with compatibility scores' })
  async search(
    @Req() req: FastifyRequest & { user: User },
    @Query() dto: SearchRoommatesDto,
  ) {
    return this.roommateMatchingService.searchProfiles(
      req.user._id.toString(),
      dto,
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MATCH FLOW
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * POST /roommate-matching/interest/:receiverUserId
   * Express interest in another student.
   * If they already liked you → auto-match + chat room created.
   * Requires verification.
   */
  @Post('interest/:receiverUserId')
  @UseGuards(IsVerifiedStudentGuard)
  @ApiOperation({ summary: 'Express interest in a potential roommate' })
  @ApiParam({ name: 'receiverUserId', description: 'Target student User ID' })
  @ApiResponse({ status: 201, description: 'Interest sent (PENDING) or auto-matched (MATCHED)' })
  @ApiResponse({ status: 400, description: 'Cannot match with yourself, or profile inactive' })
  async expressInterest(
    @Req() req: FastifyRequest & { user: User },
    @Param('receiverUserId') receiverUserId: string,
  ) {
    return this.roommateMatchingService.expressInterest(
      req.user._id.toString(),
      receiverUserId,
    );
  }

  /**
   * PATCH /roommate-matching/matches/:matchId/accept
   * Accept a pending match request — creates a chat room.
   * Requires verification.
   */
  @Patch('matches/:matchId/accept')
  @UseGuards(IsVerifiedStudentGuard)
  @ApiOperation({ summary: 'Accept a roommate match request' })
  @ApiParam({ name: 'matchId', description: 'RoommateMatch document ID' })
  @ApiResponse({ status: 200, description: 'Matched — chatRoomId returned' })
  @ApiResponse({ status: 404, description: 'Pending match not found' })
  async acceptMatch(
    @Req() req: FastifyRequest & { user: User },
    @Param('matchId') matchId: string,
  ) {
    return this.roommateMatchingService.acceptMatch(
      req.user._id.toString(),
      matchId,
    );
  }

  /**
   * PATCH /roommate-matching/matches/:matchId/reject
   * Decline a pending match request.
   * Requires verification.
   */
  @Patch('matches/:matchId/reject')
  @UseGuards(IsVerifiedStudentGuard)
  @ApiOperation({ summary: 'Decline a roommate match request' })
  @ApiParam({ name: 'matchId', description: 'RoommateMatch document ID' })
  @ApiResponse({ status: 200, description: 'Match declined' })
  @ApiResponse({ status: 404, description: 'Pending match not found' })
  async rejectMatch(
    @Req() req: FastifyRequest & { user: User },
    @Param('matchId') matchId: string,
  ) {
    return this.roommateMatchingService.rejectMatch(
      req.user._id.toString(),
      matchId,
    );
  }

  /**
   * GET /roommate-matching/matches
   * Returns all pending and confirmed matches for the calling student.
   * Requires verification — only verified students participate in the pool.
   */
  @Get('matches')
  @UseGuards(IsVerifiedStudentGuard)
  @ApiOperation({ summary: 'Get all your roommate matches (pending and confirmed)' })
  @ApiResponse({ status: 200, description: '{ pending: [...], matched: [...] }' })
  async getMyMatches(@Req() req: FastifyRequest & { user: User }) {
    return this.roommateMatchingService.getMyMatches(req.user._id.toString());
  }
}