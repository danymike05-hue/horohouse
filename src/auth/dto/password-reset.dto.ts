import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PASSWORD_MAX, PASSWORD_MIN } from './auth.dto';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email address to send password reset link'
  })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(254)
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    example: 'abc123token456',
    description: 'Password reset token from email'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  token: string;

  @ApiProperty({
    example: 'newPassword123',
    description: 'New password (8 to 72 characters)'
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(PASSWORD_MIN, { message: `Password must be at least ${PASSWORD_MIN} characters long` })
  @MaxLength(PASSWORD_MAX, { message: `Password must be at most ${PASSWORD_MAX} characters long` })
  newPassword: string;
}

export class ValidateResetTokenDto {
  @ApiProperty({
    example: 'abc123token456',
    description: 'Password reset token to validate'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  token: string;
}
