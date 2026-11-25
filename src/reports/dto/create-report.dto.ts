import { IsString, IsNotEmpty, IsOptional, MaxLength, IsMongoId } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReportDto {
    @ApiProperty({
        description: 'The reason for reporting the property',
        example: 'Fraudulent / scam',
    })
    @IsString()
    @IsNotEmpty()
    reason: string;

    @ApiPropertyOptional({
        description: 'Additional details about the report',
        example: 'The host asked for payment outside the platform.',
    })
    @IsString()
    @IsOptional()
    @MaxLength(1000)
    details?: string;
}

export class CreateUserReportDto extends CreateReportDto {
    /** Reported from this chat: its last messages go with the report */
    @IsOptional()
    @IsMongoId()
    conversationId?: string;

    /** The message that was reported, if one was chosen */
    @IsOptional()
    @IsMongoId()
    messageId?: string;
}
