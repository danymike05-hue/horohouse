import { IsString, IsOptional, IsEnum, IsDateString, IsEmail, IsMongoId } from 'class-validator';
import { AppointmentType } from '../schemas/appointment.schema';

export class ScheduleTourDto {
    @IsMongoId()
    propertyId: string;

    @IsMongoId()
    @IsOptional()
    agentId?: string;

    @IsDateString()
    viewingDate: string;

    @IsString()
    viewingTime: string;

    @IsEnum(AppointmentType)
    tourType: AppointmentType;

    @IsString()
    name: string;

    @IsEmail()
    email: string;

    @IsString()
    phone: string;

    @IsString()
    @IsOptional()
    message?: string;
}
