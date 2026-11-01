import { IsString, IsEmail, IsOptional, IsEnum, IsNumber, IsArray } from 'class-validator';
import { LeadSource, LeadStatus, LeadPriority } from '../schemas/lead.schema';

export class CreateLeadDto {
    @IsString()
    name: string;

    @IsEmail()
    @IsOptional()
    email?: string;

    @IsString()
    @IsOptional()
    phone?: string;

    @IsString()
    @IsOptional()
    interest?: string;

    @IsEnum(LeadSource)
    @IsOptional()
    source?: LeadSource;

    @IsEnum(LeadStatus)
    @IsOptional()
    status?: LeadStatus;

    @IsString()
    @IsOptional()
    location?: string;

    @IsNumber()
    @IsOptional()
    budget?: number;

    @IsString()
    @IsOptional()
    propertyType?: string;

    @IsEnum(LeadPriority)
    @IsOptional()
    priority?: LeadPriority;

    @IsString()
    @IsOptional()
    assignedAgent?: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    tags?: string[];
}
