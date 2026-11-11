import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
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
