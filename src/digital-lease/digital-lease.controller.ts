import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';

import { DigitalLeaseService } from './digital-lease.service';
import {
  CreateDigitalLeaseDto,
  SignLeaseDto,
  AddConditionLogDto,
  TerminateLeaseDto,
} from './dto/digital-lease.dto';
import { LeaseStatus } from './schemas/digital-lease.schema';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { User, UserRole } from '../users/schemas/user.schema';

@ApiTags('Digital Leases')
@ApiBearerAuth('JWT-auth')
@Controller('digital-leases')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DigitalLeaseController {
  constructor(private readonly digitalLeaseService: DigitalLeaseService) {}

  // ── Landlord — create ─────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.LANDLORD, UserRole.AGENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a lease draft (landlord/agent)' })
  @ApiResponse({ status: 201, description: 'Lease draft created with standard HoroHouse clauses' })
  create(
    @Req() req: FastifyRequest & { user: User },
    @Body() dto: CreateDigitalLeaseDto,
  ) {
    return this.digitalLeaseService.create(req.user._id.toString(), dto);
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  @Get('mine/landlord')
  @Roles(UserRole.LANDLORD, UserRole.AGENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all leases where I am the landlord' })
  @ApiQuery({ name: 'status', enum: LeaseStatus, required: false })
  getLandlordLeases(
    @Req() req: FastifyRequest & { user: User },
    @Query('status') status?: LeaseStatus,
  ) {
    return this.digitalLeaseService.findByLandlord(
      req.user._id.toString(),
      status,
    );
  }

  @Get('mine/tenant')
  @ApiOperation({ summary: 'Get all leases where I am a tenant' })
  getTenantLeases(@Req() req: FastifyRequest & { user: User }) {
    return this.digitalLeaseService.findByTenant(req.user._id.toString());
  }

  @Get(':leaseId')
  @ApiOperation({ summary: 'Get a lease by ID' })
  @ApiParam({ name: 'leaseId' })
  findOne(@Param('leaseId') leaseId: string) {
    return this.digitalLeaseService.findById(leaseId);
  }

  // ── E-signature ───────────────────────────────────────────────────────────

  @Patch(':leaseId/sign')
  @ApiOperation({ summary: 'Sign the lease (landlord or tenant) — uploads signature to Cloudinary' })
  @ApiParam({ name: 'leaseId' })
  @ApiResponse({ status: 200, description: 'Signed. If all parties signed, lease becomes ACTIVE and first billing cycle is created.' })
  sign(
    @Param('leaseId') leaseId: string,
    @Req() req: FastifyRequest & { user: User },
    @Body() dto: SignLeaseDto,
  ) {
    return this.digitalLeaseService.sign(
      leaseId,
      req.user._id.toString(),
      dto,
    );
  }

  // ── Condition log ─────────────────────────────────────────────────────────

  @Post(':leaseId/condition-log')
  @ApiOperation({ summary: 'Add a move-in or move-out condition log' })
  @ApiParam({ name: 'leaseId' })
  @ApiResponse({ status: 201, description: 'Log recorded. Add photos separately via /condition-photos.' })
  addConditionLog(
    @Param('leaseId') leaseId: string,
    @Req() req: FastifyRequest & { user: User },
    @Body() dto: AddConditionLogDto,
  ) {
    return this.digitalLeaseService.addConditionLog(
      leaseId,
      req.user._id.toString(),
      dto,
    );
  }

  @Post(':leaseId/condition-photos')
  @ApiOperation({ summary: 'Upload condition log photos for a specific item' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'leaseId' })
  @ApiQuery({ name: 'logType', enum: ['move_in', 'move_out'] })
  @ApiQuery({ name: 'itemLabel', description: 'Must match an existing item label in the log' })
  @ApiResponse({ status: 201, description: 'Photos uploaded and attached to condition log item' })
  async uploadConditionPhotos(
    @Param('leaseId') leaseId: string,
    @Query('logType') logType: 'move_in' | 'move_out',
    @Query('itemLabel') itemLabel: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    if (!logType || !itemLabel) {
      throw new BadRequestException('logType and itemLabel query params are required.');
    }

    const files: Array<{ buffer: Buffer }> = [];
    const parts = (req as any).parts();

    for await (const part of parts) {
      if (part.type === 'file') {
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(Buffer.from(chunk));
        }
        files.push({ buffer: Buffer.concat(chunks) });
      }
    }

    if (files.length === 0) {
      throw new BadRequestException('No files uploaded.');
    }

    return this.digitalLeaseService.uploadConditionPhotos(
      leaseId,
      logType,
      itemLabel,
      files,
      req.user._id.toString(),
    );
  }

  // ── Termination ───────────────────────────────────────────────────────────

  @Patch(':leaseId/terminate')
  @ApiOperation({ summary: 'Terminate a lease early (any party)' })
  @ApiParam({ name: 'leaseId' })
  @ApiResponse({ status: 200, description: 'Lease terminated — other party notified' })
  terminate(
    @Param('leaseId') leaseId: string,
    @Req() req: FastifyRequest & { user: User },
    @Body() dto: TerminateLeaseDto,
  ) {
    return this.digitalLeaseService.terminate(
      leaseId,
      req.user._id.toString(),
      dto,
    );
  }
}