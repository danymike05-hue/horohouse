import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ 
    example: 'john.doe@example.com',
    description: 'Email address to send password reset link'
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ 
    example: 'abc123token456',
    description: 'Password reset token from email'
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ 
    example: 'newPassword123',
    description: 'New password (minimum 8 characters)'
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  newPassword: string;
}

export class ValidateResetTokenDto {
  @ApiProperty({ 
    example: 'abc123token456',
    description: 'Password reset token to validate'
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}