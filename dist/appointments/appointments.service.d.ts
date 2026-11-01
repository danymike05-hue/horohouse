import { Model } from 'mongoose';
import { Appointment, AppointmentDocument, AppointmentStatus } from './schemas/appointment.schema';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { ScheduleTourDto } from './dto/schedule-tour.dto';
import { User } from '../users/schemas/user.schema';
import { PropertyDocument } from '../properties/schemas/property.schema';
export interface AppointmentFilters {
    status?: AppointmentStatus;
    type?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    agentId?: string;
    page?: number;
    limit?: number;
}
export declare class AppointmentsService {
    private appointmentModel;
    private propertyModel;
    constructor(appointmentModel: Model<AppointmentDocument>, propertyModel: Model<PropertyDocument>);
    create(dto: CreateAppointmentDto, agent: User): Promise<Appointment>;
    scheduleTour(dto: ScheduleTourDto, user: User): Promise<Appointment>;
    findMyTours(user: User, limit?: number): Promise<Appointment[]>;
    findAll(agent: User, filters?: AppointmentFilters): Promise<{
        appointments: Appointment[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    findOne(id: string, user: User): Promise<Appointment>;
    update(id: string, dto: UpdateAppointmentDto, user: User): Promise<Appointment>;
    remove(id: string, user: User): Promise<any>;
    addNote(id: string, content: string, user: User): Promise<Appointment>;
    markReminderSent(id: string): Promise<void>;
    getStats(user: User): Promise<any>;
}
