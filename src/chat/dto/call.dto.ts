import { IsEnum, IsNotEmpty, IsOptional, IsString, IsObject, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CallEndReason, CallType } from '../schemas/call.schema';

export class InitiateCallDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  conversationId: string;

  @ApiProperty({ enum: CallType })
  @IsEnum(CallType)
  type: CallType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  sdpOffer?: any;
}

export class AnswerCallDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  callId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  sdpAnswer?: any;
}

export class DeclineCallDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  callId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class EndCallDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  callId: string;

  @ApiPropertyOptional({ enum: CallEndReason })
  @IsOptional()
  @IsEnum(CallEndReason)
  reason?: CallEndReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  duration?: number;
}

export class IceCandidateDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  callId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsObject()
  candidate: any;
}

export class UpdateCallQualityDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  callId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  audioQuality?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  videoQuality?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  networkIssues?: number;
}