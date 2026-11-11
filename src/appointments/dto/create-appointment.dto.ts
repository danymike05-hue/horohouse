import { IsString, IsOptional, IsEnum, IsDateString, IsEmail, IsNumber, IsMongoId } from 'class-validator';
import { AppointmentType, AppointmentStatus } from '../schemas/appointment.schema';

export class CreateAppointmentDto {
    @IsString()
    title: string;

    @IsString()
    @IsOptional()
    property?: string;

    @IsMongoId()
    @IsOptional()
    propertyId?: string;

    @IsString()
    clientName: string;

    @IsEmail()
    @IsOptional()
    clientEmail?: string;

    @IsString()
    @IsOptional()
    clientPhone?: string;

    @IsMongoId()
    @IsOptional()
    clientId?: string;

    @IsEnum(AppointmentType)
    type: AppointmentType;

    @IsString()
    @IsOptional()
    location?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsDateString()
    date: string;

    @IsNumber()
    @IsOptional()
    duration?: number;

    @IsEnum(AppointmentStatus)
    @IsOptional()
    status?: AppointmentStatus;
}
