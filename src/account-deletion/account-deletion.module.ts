import { Body, Controller, Get, HttpCode, HttpStatus, Module, Post, Req, UseGuards } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { AllowIncompleteOnboarding } from '../auth/guards/onboarding.guard';
import { EmailModule } from '../email/email.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AccountDeletionService } from './account-deletion.service';

class DeleteAccountDto {
  /** Required when the account has a password */
  @IsOptional() @IsString() @Length(1, 200) password?: string;
  /** Accounts that only use Google or Apple */
  @IsOptional() @IsBoolean() confirm?: boolean;
}

@ApiTags('Account')
@ApiBearerAuth()
@Controller('account/deletion')
@UseGuards(JwtAuthGuard)
@AllowIncompleteOnboarding()
export class AccountDeletionController {
  constructor(private readonly service: AccountDeletionService) {}

  @Get()
  @ApiOperation({ summary: 'Can my account be deleted now, and what has to be settled first?' })
  check(@Req() req: any) {
    return this.service.check(String(req.user.userId));
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Delete my account and personal data for good' })
  remove(@Body() dto: DeleteAccountDto, @Req() req: any) {
    return this.service.remove(String(req.user.userId), dto);
  }
}

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]), AuthModule, EmailModule],
  controllers: [AccountDeletionController],
  providers: [AccountDeletionService],
})
export class AccountDeletionModule {}
