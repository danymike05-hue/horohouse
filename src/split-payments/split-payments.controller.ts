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

import { SplitPaymentsService } from './split-payments.service';
import {
  CreateSplitPaymentDto,
  RecordTenantPaymentDto,
  InitiateTenantChargeDto,
  SplitRentCalculatorDto,
} from './dto/split-payment.dto';
import { SplitPaymentStatus } from './schemas/split-payment.schema';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { User, UserRole } from '../users/schemas/user.schema';

@ApiTags('Split Payments')
@ApiBearerAuth('JWT-auth')
@Controller('split-payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SplitPaymentsController {
  constructor(private readonly splitPaymentsService: SplitPaymentsService) {}

  // ── Calculator (no auth required — used by the frontend widget) ──────────

  @Post('calculate')
  @ApiOperation({ summary: 'Stateless rent split calculator — returns per-tenant breakdown' })
  @ApiResponse({ status: 201, description: 'Calculated split returned' })
  calculate(@Body() dto: SplitRentCalculatorDto) {
    return this.splitPaymentsService.calculateSplit(dto);
  }

  // ── Landlord — create and manage cycles ──────────────────────────────────

  @Post('cycles')
  @Roles(UserRole.LANDLORD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a billing cycle ledger for a lease' })
  @ApiResponse({ status: 201, description: 'Cycle created — tenants notified' })
  createCycle(
    @Req() req: FastifyRequest & { user: User },
    @Body() dto: CreateSplitPaymentDto,
  ) {
    return this.splitPaymentsService.createCycle(req.user._id.toString(), dto);
  }

  @Get('cycles/landlord')
  @Roles(UserRole.LANDLORD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all cycles for the calling landlord' })
  @ApiQuery({ name: 'status', enum: SplitPaymentStatus, required: false })
  getLandlordCycles(
    @Req() req: FastifyRequest & { user: User },
    @Query('status') status?: SplitPaymentStatus,
  ) {
    return this.splitPaymentsService.findByLandlord(
      req.user._id.toString(),
      status,
    );
  }

  @Get('cycles/lease/:leaseId')
  @Roles(UserRole.LANDLORD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all cycles for a specific lease' })
  @ApiParam({ name: 'leaseId' })
  getCyclesByLease(@Param('leaseId') leaseId: string) {
    return this.splitPaymentsService.findByLease(leaseId);
  }

  @Post('cycles/:cycleId/charge')
  @Roles(UserRole.LANDLORD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Send a MoMo payment request to a specific tenant' })
  @ApiParam({ name: 'cycleId' })
  @ApiResponse({ status: 201, description: 'MoMo prompt sent — reference returned' })
  initiateCharge(
    @Param('cycleId') cycleId: string,
    @Req() req: FastifyRequest & { user: User },
    @Body() dto: InitiateTenantChargeDto,
  ) {
    return this.splitPaymentsService.initiateCharge(
      cycleId,
      dto,
      req.user._id.toString(),
    );
  }

  @Patch('cycles/:cycleId/payment')
  @Roles(UserRole.LANDLORD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Record a tenant payment (manual or webhook-triggered)' })
  @ApiParam({ name: 'cycleId' })
  recordPayment(
    @Param('cycleId') cycleId: string,
    @Req() req: FastifyRequest & { user: User },
    @Body() dto: RecordTenantPaymentDto,
  ) {
    return this.splitPaymentsService.recordPayment(
      cycleId,
      dto,
      req.user._id.toString(),
    );
  }

  // ── Tenant — view own payments ────────────────────────────────────────────

  @Get('cycles/mine')
  @ApiOperation({ summary: 'Get all payment cycles where I am a tenant' })
  getMyPayments(@Req() req: FastifyRequest & { user: User }) {
    return this.splitPaymentsService.findMyPayments(req.user._id.toString());
  }

  @Get('cycles/:cycleId')
  @ApiOperation({ summary: 'Get a single payment cycle by ID' })
  @ApiParam({ name: 'cycleId' })
  getCycle(@Param('cycleId') cycleId: string) {
    return this.splitPaymentsService.findById(cycleId);
  }

  // ── Admin — disbursement ──────────────────────────────────────────────────

  @Patch('cycles/:cycleId/disburse')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: mark a complete cycle as disbursed to landlord' })
  @ApiParam({ name: 'cycleId' })
  markDisbursed(
    @Param('cycleId') cycleId: string,
    @Req() req: FastifyRequest & { user: User },
    @Body() body: { disbursementTransactionId?: string },
  ) {
    return this.splitPaymentsService.markDisbursed(
      cycleId,
      req.user._id.toString(),
      body.disbursementTransactionId,
    );
  }
}