// Withdrawals the team sends by hand (CamerPay payouts aren't connected yet): see what's
// waiting and where it goes, then mark it sent or give it back to the host's balance.
import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.guard';
import { Roles, RolesGuard } from '../../auth/guards/roles.guard';
import { Area } from '../../auth/team-areas';
import { UserRole } from '../../users/schemas/user.schema';
import { WalletService } from '../services/wallet.service';

class MarkSentDto {
  /** The MTN / Orange / bank reference of the transfer */
  @IsOptional() @IsString() @MaxLength(120)
  providerReference?: string;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}

class GiveBackDto {
  /** Shown to the host */
  @IsOptional() @IsString() @MaxLength(300)
  reason?: string;
}

const adminId = (req: any): string => String(req.user?._id ?? req.user?.id ?? req.user?.userId ?? '');

@ApiTags('Admin withdrawals')
@ApiBearerAuth('JWT-auth')
@Controller('admin/withdrawals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Area('finance_view')
export class AdminWithdrawalsController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'Withdrawals waiting to be sent (status=pending) or done (success/failed) (Admin)' })
  list(@Query('status') status?: string) {
    const s = status === 'success' || status === 'failed' ? status : 'pending';
    return this.wallet.adminListWithdrawals(s);
  }

  @Post(':id/sent')
  @Area('finance_view', 'finance_refunds')
  @ApiOperation({ summary: 'The money was sent by hand: mark the withdrawal done (Admin)' })
  markSent(@Param('id') id: string, @Body() dto: MarkSentDto, @Req() req: any) {
    return this.wallet.adminMarkWithdrawalSent(id, adminId(req), dto.providerReference, dto.note);
  }

  @Post(':id/give-back')
  @Area('finance_view', 'finance_refunds')
  @ApiOperation({ summary: "The money couldn't be sent: back to the host's balance (Admin)" })
  giveBack(@Param('id') id: string, @Body() dto: GiveBackDto, @Req() req: any) {
    return this.wallet.adminRefundWithdrawal(id, adminId(req), dto.reason);
  }
}
