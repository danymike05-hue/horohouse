import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateReportStatusDto {
    @ApiProperty({
        description: 'The new status of the report',
        enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
    })
    @IsString()
    @IsEnum(['pending', 'reviewed', 'resolved', 'dismissed'])
    status: string;

    @ApiPropertyOptional({
        description: 'Optional admin notes about the status update',
    })
    @IsString()
    @IsOptional()
    adminNotes?: string;
}
