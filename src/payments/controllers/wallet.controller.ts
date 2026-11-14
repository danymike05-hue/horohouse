import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsMongoId, IsNumber, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';
import { WalletService } from '../services/wallet.service';
import { HostPayoutsService } from '../services/host-payouts.service';
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.guard';
import { Roles, RolesGuard } from '../../auth/guards/roles.guard';
import { UserRole } from '../../users/schemas/user.schema';
import { WithdrawFundsDto } from '../dto/payment.dto';

// The global ValidationPipe (whitelist + forbidNonWhitelisted) rejects any field without a
// class-validator decorator. These DTOs had none, so saving bank / Mobile Money details
// and the auto-withdraw setting always failed with 400 "property … should not exist".
class CreditDebitDto {
  @IsNumber() @Min(1) @Max(100_000_000) amount: number;
  @IsString() @Length(1, 200) description: string;
  @IsOptional() @IsString() @Length(1, 100) reference?: string;
  /** Admin: the user to credit / debit */
  @IsOptional() @IsMongoId() userId?: string;
}

class BankDetailsDto {
  @IsString() @Length(2, 100) accountName: string;
  @IsString() @Length(4, 40) accountNumber: string;
  @IsString() @Length(2, 100) bankName: string;
  @IsString() @Length(1, 20) bankCode: string;
}

class MobileMoneyDto {
  /** Cameroon mobile number: 6XXXXXXXX, optionally with +237 / 237 */
  @IsString() @Matches(/^(\+?237)?6\d{8}$/, { message: 'Enter a Cameroon mobile number (6XX XX XX XX)' })
  phoneNumber: string;
  @IsIn(['MTN', 'ORANGE']) provider: 'MTN' | 'ORANGE';
}

class AutoWithdrawDto {
  @IsNumber() @Min(0) threshold: number;
  /** false turns automatic withdrawals off (the threshold is kept for next time) */
  @IsOptional() @IsBoolean() enabled?: boolean;
}

@ApiTags('Wallet')
@ApiBearerAuth('JWT-auth')
@Controller('wallet')
// RolesGuard is what enforces @Roles(...). Without it, @Roles(UserRole.ADMIN) on credit/debit
// did nothing: any logged-in user could credit their own wallet and withdraw real money.
@UseGuards(JwtAuthGuard, RolesGuard)
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly hostPayouts: HostPayoutsService,
  ) {}

  @Get('held-payouts')
  @ApiOperation({ summary: 'Booking income not withdrawable yet, and when it will be' })
  async getHeldPayouts(@Req() req: any) {
    return this.hostPayouts.listHeld(String(req.user._id ?? req.user.id));
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get or create wallet for current user' })
  @ApiResponse({ status: 200, description: 'Wallet returned' })
  async getWallet(@Req() req: any) {
    return this.walletService.getOrCreateWallet(req.user.id);
  }

  @Post('credit')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Credit a user wallet (admin)' })
  @ApiResponse({ status: 200, description: 'Wallet credited' })
  async creditWallet(@Body() dto: CreditDebitDto, @Req() req: any) {
    if (!dto || !dto.amount || !dto.description) {
      throw new BadRequestException('amount and description are required');
    }
    const targetUserId = dto.userId || req.user.id;
    return this.walletService.creditWallet(
      targetUserId,
      dto.amount,
      dto.description,
      dto.reference,
    );
  }

  @Post('debit')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Debit a user wallet (admin)' })
  @ApiResponse({ status: 200, description: 'Wallet debited' })
  async debitWallet(@Body() dto: CreditDebitDto, @Req() req: any) {
    if (!dto || !dto.amount || !dto.description) {
      throw new BadRequestException('amount and description are required');
    }
    const targetUserId = dto.userId || req.user.id;
    return this.walletService.debitWallet(targetUserId, dto.amount, dto.description, dto.reference);
  }

  @Post('withdraw')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Request a wallet withdrawal' })
  @ApiResponse({ status: 200, description: 'Withdrawal requested' })
  async requestWithdrawal(@Body() dto: WithdrawFundsDto, @Req() req: any) {
    const accountDetails: any = {};
    if (dto.withdrawalMethod === 'bank_transfer') {
      accountDetails.accountNumber = dto.accountNumber;
      accountDetails.accountName = dto.accountName;
      accountDetails.bankCode = dto.bankCode;
    } else {
      // For mobile money, `accountNumber` is treated as phone number
      accountDetails.phoneNumber = dto.accountNumber;
    }

    return this.walletService.requestWithdrawal(req.user.id, dto.amount, dto.withdrawalMethod as any, accountDetails);
  }

  @Post('bank')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Update user's bank account details" })
  @ApiResponse({ status: 200, description: 'Bank account updated' })
  async updateBankAccount(@Body() dto: BankDetailsDto, @Req() req: any) {
    return this.walletService.updateBankAccount(req.user.id, dto);
  }

  @Post('mobile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Update user's mobile money details" })
  @ApiResponse({ status: 200, description: 'Mobile money account updated' })
  async updateMobileMoneyAccount(@Body() dto: MobileMoneyDto, @Req() req: any) {
    return this.walletService.updateMobileMoneyAccount(req.user.id, dto);
  }

  @Post('auto-withdraw')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Turn auto-withdrawal on (with a threshold) or off ({ enabled: false })' })
  @ApiResponse({ status: 200, description: 'Auto-withdrawal updated' })
  async enableAutoWithdrawal(@Body() dto: AutoWithdrawDto, @Req() req: any) {
    if (dto?.enabled === false) return this.walletService.disableAutoWithdrawal(req.user.id);
    if (!dto || typeof dto.threshold !== 'number') {
      throw new BadRequestException('threshold is required');
    }
    return this.walletService.enableAutoWithdrawal(req.user.id, dto.threshold);
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get wallet transactions' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Transactions retrieved' })
  async getTransactions(@Req() req: any, @Query('limit') limit?: string) {
    const n = limit ? parseInt(limit, 10) : NaN;
    const l = Number.isFinite(n) ? Math.min(Math.max(n, 1), 200) : undefined;
    return this.walletService.getTransactions(req.user.id, l);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get wallet statistics' })
  @ApiResponse({ status: 200, description: 'Wallet stats' })
  async getWalletStats(@Req() req: any) {
    return this.walletService.getWalletStats(req.user.id);
  }
}
