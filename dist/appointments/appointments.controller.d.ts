import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { ScheduleTourDto } from './dto/schedule-tour.dto';
import { FastifyRequest } from 'fastify';
import { User } from '../users/schemas/user.schema';
export declare class AppointmentsController {
    private readonly appointmentsService;
    constructor(appointmentsService: AppointmentsService);
    create(dto: CreateAppointmentDto, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/appointment.schema").Appointment>;
    scheduleTour(dto: ScheduleTourDto, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/appointment.schema").Appointment>;
    getStats(req: FastifyRequest & {
        user: User;
    }): Promise<any>;
    getMyTours(req: FastifyRequest & {
        user: User;
    }, limit?: string): Promise<import("./schemas/appointment.schema").Appointment[]>;
    findAll(req: FastifyRequest & {
        user: User;
    }, query: any): Promise<{
        appointments: import("./schemas/appointment.schema").Appointment[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    findOne(id: string, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/appointment.schema").Appointment>;
    update(id: string, dto: UpdateAppointmentDto, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/appointment.schema").Appointment>;
    addNote(id: string, content: string, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/appointment.schema").Appointment>;
    remove(id: string, req: FastifyRequest & {
        user: User;
    }): Promise<any>;
}
