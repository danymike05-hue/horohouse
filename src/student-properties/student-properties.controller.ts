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
  ApiQuery,
} from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';

import { StudentPropertiesService } from './student-properties.service';
import {
  StudentPropertySearchDto,
  MarkStudentFriendlyDto,
} from './dto/student-property.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { Roles, RolesGuard, Public } from '../auth/guards/roles.guard';
import { User, UserRole } from '../users/schemas/user.schema';

@ApiTags('Student Properties')
@Controller('student-properties')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentPropertiesController {
  constructor(
    private readonly studentPropertiesService: StudentPropertiesService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC — search
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GET /student-properties/search
   * The main student housing search page endpoint.
   * Public — no auth required. Students can browse before signing up.
   * Sorted by campus proximity ascending by default.
   */
  @Get('search')
  @Public()
  @ApiOperation({ summary: 'Search student-friendly properties with campus-specific filters' })
  @ApiResponse({ status: 200, description: 'Paginated student property results' })
  async search(@Query() dto: StudentPropertySearchDto) {
    return this.studentPropertiesService.searchStudentProperties(dto);
  }

  /**
   * GET /student-properties/stats
   * Public stats for the student housing landing page
   * (total listings, cities covered, bed availability).
   */
  @Get('stats')
  @Public()
  @ApiOperation({ summary: 'Student housing stats — totals, cities, infrastructure breakdown' })
  @ApiResponse({ status: 200, description: 'Stats returned' })
  async getStats() {
    return this.studentPropertiesService.getStudentPropertyStats();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LANDLORD / AGENT — opt a listing into the student programme
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * POST /student-properties/:propertyId/enroll
   * Landlord or agent fills in studentDetails and opts their listing
   * into the student housing pool. Sets isStudentFriendly = true.
   */
  @Post(':propertyId/enroll')
  @ApiBearerAuth('JWT-auth')
  @Roles(UserRole.LANDLORD, UserRole.AGENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Enroll a property in the student housing programme' })
  @ApiParam({ name: 'propertyId', description: 'Property ID' })
  @ApiResponse({ status: 201, description: 'Property enrolled — studentDetails saved' })
  @ApiResponse({ status: 403, description: 'Not your property' })
  async enrollProperty(
    @Param('propertyId') propertyId: string,
    @Req() req: FastifyRequest & { user: User },
    @Body() dto: MarkStudentFriendlyDto,
  ) {
    return this.studentPropertiesService.markAsStudentFriendly(
      propertyId,
      req.user,
      dto,
    );
  }

  /**
   * PATCH /student-properties/:propertyId/enroll
   * Update the studentDetails on an already-enrolled property.
   * Same permission rules as POST.
   */
  @Patch(':propertyId/enroll')
  @ApiBearerAuth('JWT-auth')
  @Roles(UserRole.LANDLORD, UserRole.AGENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update student details on an enrolled property' })
  @ApiParam({ name: 'propertyId', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Student details updated' })
  async updateEnrollment(
    @Param('propertyId') propertyId: string,
    @Req() req: FastifyRequest & { user: User },
    @Body() dto: MarkStudentFriendlyDto,
  ) {
    return this.studentPropertiesService.markAsStudentFriendly(
      propertyId,
      req.user,
      dto,
    );
  }

  /**
   * DELETE /student-properties/:propertyId/enroll
   * Remove a listing from the student programme.
   * Clears isStudentFriendly and studentDetails.
   */
  @Delete(':propertyId/enroll')
  @ApiBearerAuth('JWT-auth')
  @Roles(UserRole.LANDLORD, UserRole.AGENT, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a property from the student housing programme' })
  @ApiParam({ name: 'propertyId', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Property removed from student programme' })
  async removeEnrollment(
    @Param('propertyId') propertyId: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.studentPropertiesService.removeStudentFriendly(
      propertyId,
      req.user,
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ADMIN — Student-Approved badge
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * PATCH /student-properties/admin/:propertyId/approve
   * Grant the Student-Approved badge after the physical verification agent
   * has visited and confirmed the property meets the programme criteria.
   */
  @Patch('admin/:propertyId/approve')
  @ApiBearerAuth('JWT-auth')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: grant Student-Approved badge to a property' })
  @ApiParam({ name: 'propertyId', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Badge granted — property now ranks first in student search' })
  @ApiResponse({ status: 400, description: 'Property not enrolled in student programme' })
  async grantStudentApproved(
    @Param('propertyId') propertyId: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.studentPropertiesService.grantStudentApproved(
      propertyId,
      req.user._id.toString(),
    );
  }

  /**
   * PATCH /student-properties/admin/:propertyId/revoke
   * Revoke the Student-Approved badge (e.g. after complaints or failed re-inspection).
   */
  @Patch('admin/:propertyId/revoke')
  @ApiBearerAuth('JWT-auth')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: revoke Student-Approved badge' })
  @ApiParam({ name: 'propertyId', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Badge revoked' })
  async revokeStudentApproved(
    @Param('propertyId') propertyId: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.studentPropertiesService.revokeStudentApproved(
      propertyId,
      req.user._id.toString(),
    );
  }
}