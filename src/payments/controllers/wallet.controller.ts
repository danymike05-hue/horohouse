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
import { WalletService } from '../services/wallet.service';
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.guard';
import { Roles } from '../../auth/guards/roles.guard';
import { UserRole } from '../../users/schemas/user.schema';
import { WithdrawFundsDto } from '../dto/payment.dto';

class CreditDebitDto {
  amount: number;
  description: string;
  reference?: string;
}

class BankDetailsDto {
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
}

class MobileMoneyDto {
  phoneNumber: string;
  provider: 'MTN' | 'ORANGE';
}

class AutoWithdrawDto {
  threshold: number;
}

@ApiTags('Wallet')
@ApiBearerAuth('JWT-auth')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

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
    // Expect admin to pass a target user id in metadata or reference; fallback to self
    const targetUserId = (dto as any).userId || req.user.id;
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
    const targetUserId = (dto as any).userId || req.user.id;
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
  @ApiOperation({ summary: 'Enable auto-withdrawal with threshold' })
  @ApiResponse({ status: 200, description: 'Auto-withdrawal enabled' })
  async enableAutoWithdrawal(@Body() dto: AutoWithdrawDto, @Req() req: any) {
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
    const l = limit ? parseInt(limit, 10) : undefined;
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
