import { AppointmentType, AppointmentStatus } from '../schemas/appointment.schema';
export declare class CreateAppointmentDto {
    title: string;
    property?: string;
    propertyId?: string;
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
    clientId?: string;
    type: AppointmentType;
    location?: string;
    description?: string;
    date: string;
    duration?: number;
    status?: AppointmentStatus;
}
