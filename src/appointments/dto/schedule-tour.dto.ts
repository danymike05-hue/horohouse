import { IsString, IsOptional, IsEnum, IsDateString, IsEmail, IsMongoId, Length, Matches } from 'class-validator';
import { AppointmentType } from '../schemas/appointment.schema';

/** A client asking to visit a home to rent or buy. */
export class ScheduleTourDto {
    @IsMongoId()
    propertyId: string;

    /** Ignored: the listing decides who shows it. Kept so older clients still validate. */
    @IsMongoId()
    @IsOptional()
    agentId?: string;

    /** The exact start time (ISO, with its time zone). The app sends this. */
    @IsDateString()
    @IsOptional()
    startsAt?: string;

    /** Or a day and a time, read as Cameroon time (the website sends these) */
    @IsDateString()
    @IsOptional()
    viewingDate?: string;

    @IsString()
    @Matches(/^\d{1,2}:\d{2}$/)
    @IsOptional()
    viewingTime?: string;

    @IsEnum(AppointmentType)
    tourType: AppointmentType;

    @IsString()
    @Length(1, 120)
    name: string;

    @IsEmail()
    @IsOptional()
    email?: string;

    @IsString()
    @IsOptional()
    @Length(0, 30)
    phone?: string;

    @IsString()
    @IsOptional()
    @Length(0, 1000)
    message?: string;
}
