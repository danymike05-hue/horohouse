import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Appointment, AppointmentDocument, AppointmentStatus } from './schemas/appointment.schema';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { ScheduleTourDto } from './dto/schedule-tour.dto';
import { User, UserRole } from '../users/schemas/user.schema';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';

export interface AppointmentFilters {
    status?: AppointmentStatus;
    type?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    agentId?: string;   // admin-only: view another agent's appointments
    page?: number;
    limit?: number;
}

@Injectable()
export class AppointmentsService {
    constructor(
        @InjectModel(Appointment.name) private appointmentModel: Model<AppointmentDocument>,
        @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
    ) { }

    // ─── Create ───────────────────────────────────────────────────────────────

    async create(dto: CreateAppointmentDto, agent: User): Promise<Appointment> {
        // Conflict detection: same agent, overlapping time window
        const start = new Date(dto.date);
        const end = new Date(start.getTime() + (dto.duration ?? 60) * 60_000);

        const conflict = await this.appointmentModel.findOne({
            agentId: agent._id,
            status: { $in: [AppointmentStatus.SCHEDULED, AppointmentStatus.RESCHEDULED] },
            $and: [
                { date: { $lt: end } },
                {
                    $expr: {
                        $gt: [
                            { $add: ['$date', { $multiply: [{ $ifNull: ['$duration', 60] }, 60_000] }] },
                            start,
                        ],
                    },
                },
            ],
        });

        if (conflict) {
            throw new BadRequestException(
                `Scheduling conflict: you already have "${conflict.title}" overlapping this time.`,
            );
        }

        const created = new this.appointmentModel({
            ...dto,
            agentId: agent._id,
            propertyId: dto.propertyId ? new Types.ObjectId(dto.propertyId) : undefined,
            clientId: dto.clientId ? new Types.ObjectId(dto.clientId) : undefined,
        });
        return created.save();
    }

    async scheduleTour(dto: ScheduleTourDto, user: User): Promise<Appointment> {
        // Parse the combined date and time
        const [hours, minutes] = dto.viewingTime.split(':').map(Number);
        const startDate = new Date(dto.viewingDate);
        startDate.setHours(hours, minutes, 0, 0);

        const duration = 60; // Default tour duration
        const endDate = new Date(startDate.getTime() + duration * 60_000);

        // Conflict detection for the agent (only if an agent is assigned)
        if (dto.agentId) {
            const conflict = await this.appointmentModel.findOne({
                agentId: new Types.ObjectId(dto.agentId),
                status: { $in: [AppointmentStatus.SCHEDULED, AppointmentStatus.RESCHEDULED] },
                $and: [
                    { date: { $lt: endDate } },
                    {
                        $expr: {
                            $gt: [
                                { $add: ['$date', { $multiply: [{ $ifNull: ['$duration', 60] }, 60_000] }] },
                                startDate,
                            ],
                        },
                    },
                ],
            });

            if (conflict) {
                throw new BadRequestException(
                    'The selected time slot is no longer available. Please choose another time.',
                );
            }
        }

        // We require agentId in the DB schema currently, so if there is no agent
        // we might assign it to an admin or leave it null if schema permits.
        // Wait, looking at the schema: agentId is required. So we must provide one.
        // If agentId is missing from frontend, we have a schema level validation error.
        const created = new this.appointmentModel({
            title: `Property Tour: ${dto.name}`,
            propertyId: new Types.ObjectId(dto.propertyId),
            agentId: dto.agentId ? new Types.ObjectId(dto.agentId) : user._id, // Assign to the scheduling user temporarily if no agent
            clientId: user._id,
            clientName: dto.name,
            clientEmail: dto.email,
            clientPhone: dto.phone,
            type: dto.tourType,
            description: dto.message || undefined,
            date: startDate,
            duration,
            status: AppointmentStatus.SCHEDULED,
        });

        return created.save();
    }

    // ─── Find user's own tours (by clientId) ─────────────────────────────────

    async findMyTours(user: User, limit = 10): Promise<Appointment[]> {
        return this.appointmentModel
            .find({ clientId: user._id })
            .sort({ date: 1 })
            .limit(limit)
            .populate('propertyId', 'title city address price type listingType images')
            .lean()
            .exec() as Promise<Appointment[]>;
    }

    // ─── Find (scoped to agent, with filters + pagination) ───────────────────

    async findAll(agent: User, filters: AppointmentFilters = {}): Promise<{
        appointments: Appointment[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const isAdmin = agent.role === UserRole.ADMIN;
        const { page = 1, limit = 20, status, type, startDate, endDate, search, agentId } = filters;
        const skip = (page - 1) * limit;

        const conditions: any[] = [];

        // Scope: admin can view all or a specific agent; agents see only their own (or appointments for their properties)
        if (!isAdmin) {
            // Find all properties owned by this user
            const userProperties = await this.propertyModel.find({ ownerId: agent._id }).select('_id').lean();
            const propertyIds = userProperties.map(p => p._id);

            conditions.push({
                $or: [
                    { agentId: agent._id },
                    { propertyId: { $in: propertyIds } }
                ]
            });
        } else if (agentId) {
            conditions.push({ agentId: new Types.ObjectId(agentId) });
        }

        if (status) conditions.push({ status });
        if (type) conditions.push({ type });

        if (startDate || endDate) {
            const dateQuery: any = {};
            if (startDate) dateQuery.$gte = startDate;
            if (endDate) dateQuery.$lte = endDate;
            conditions.push({ date: dateQuery });
        }

        if (search) {
            conditions.push({
                $or: [
                    { title: { $regex: search, $options: 'i' } },
                    { clientName: { $regex: search, $options: 'i' } },
                    { property: { $regex: search, $options: 'i' } },
                    { clientEmail: { $regex: search, $options: 'i' } },
                ]
            });
        }

        const finalQuery = conditions.length > 0 ? { $and: conditions } : {};

        const [appointments, total] = await Promise.all([
            this.appointmentModel
                .find(finalQuery)
                .populate('propertyId', 'title city address images price type listingType')
                .populate('agentId', 'name email profilePicture')
                .populate('clientId', 'name email phoneNumber')
                .sort({ date: 1 })
                .skip(skip)
                .limit(limit)
                .exec(),
            this.appointmentModel.countDocuments(finalQuery),
        ]);

        return { appointments, total, page, totalPages: Math.ceil(total / limit) };
    }

    // ─── Find one (with ownership check) ─────────────────────────────────────

    async findOne(id: string, user: User): Promise<Appointment> {
        if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid appointment ID');

        const appointment = await this.appointmentModel
            .findById(id)
            .populate('propertyId', 'title city address images price type listingType ownerId') // ensure ownerId is populated
            .populate('agentId', 'name email profilePicture')
            .populate('clientId', 'name email phoneNumber')
            .exec();

        if (!appointment) throw new NotFoundException(`Appointment #${id} not found`);

        const isAdmin = user.role === UserRole.ADMIN;
        // Check if user is the agent OR the owner of the property
        const isAgent = appointment.agentId && appointment.agentId._id ? appointment.agentId._id.toString() === user._id.toString() : appointment.agentId?.toString() === user._id.toString();
        const isOwner = appointment.propertyId && (appointment.propertyId as any).ownerId ? (appointment.propertyId as any).ownerId.toString() === user._id.toString() : false;

        if (!isAdmin && !isAgent && !isOwner) {
            throw new ForbiddenException('You can only view your own appointments');
        }

        return appointment;
    }

    // ─── Update (with reschedule tracking) ────────────────────────────────────

    async update(id: string, dto: UpdateAppointmentDto, user: User): Promise<Appointment> {
        const appointment = await this.appointmentModel
            .findById(id)
            .populate('propertyId', 'ownerId')
            .exec();

        if (!appointment) throw new NotFoundException(`Appointment #${id} not found`);

        const isAdmin = user.role === UserRole.ADMIN;
        const isAgent = appointment.agentId && (appointment.agentId as any)._id ? (appointment.agentId as any)._id.toString() === user._id.toString() : appointment.agentId?.toString() === user._id.toString();
        const isOwner = appointment.propertyId && (appointment.propertyId as any).ownerId ? (appointment.propertyId as any).ownerId.toString() === user._id.toString() : false;

        if (!isAdmin && !isAgent && !isOwner) {
            throw new ForbiddenException('You can only update your own appointments');
        }

        const updateData: any = { ...dto };

        // If date is changing → record reschedule history + set RESCHEDULED status
        if (dto.date) {
            const newDate = new Date(dto.date);
            const oldDate = new Date(appointment.date);

            if (newDate.getTime() !== oldDate.getTime()) {
                // Conflict check for new slot
                const end = new Date(newDate.getTime() + (dto.duration ?? appointment.duration ?? 60) * 60_000);
                const conflict = await this.appointmentModel.findOne({
                    _id: { $ne: appointment._id },
                    agentId: appointment.agentId,
                    status: { $in: [AppointmentStatus.SCHEDULED, AppointmentStatus.RESCHEDULED] },
                    $and: [
                        { date: { $lt: end } },
                        {
                            $expr: {
                                $gt: [
                                    { $add: ['$date', { $multiply: [{ $ifNull: ['$duration', 60] }, 60_000] }] },
                                    newDate,
                                ],
                            },
                        },
                    ],
                });
                if (conflict) {
                    throw new BadRequestException(
                        `Scheduling conflict: "${conflict.title}" overlaps the new time.`,
                    );
                }

                updateData.$push = {
                    rescheduleHistory: {
                        from: oldDate,
                        to: newDate,
                        reason: dto.description ?? 'Rescheduled',
                    },
                };

                if (!dto.status) {
                    updateData.status = AppointmentStatus.RESCHEDULED;
                }
            }
        }

        const updated = await this.appointmentModel
            .findByIdAndUpdate(id, updateData, { new: true })
            .populate('propertyId', 'title city address images price type listingType')
            .populate('agentId', 'name email profilePicture')
            .populate('clientId', 'name email phoneNumber')
            .exec();

        if (!updated) throw new NotFoundException(`Appointment #${id} not found after update`);
        return updated;
    }

    // ─── Delete ───────────────────────────────────────────────────────────────

    async remove(id: string, user: User): Promise<any> {
        const appointment = await this.appointmentModel
            .findById(id)
            .populate('propertyId', 'ownerId')
            .exec();

        if (!appointment) throw new NotFoundException(`Appointment #${id} not found`);

        const isAdmin = user.role === UserRole.ADMIN;
        const isAgent = appointment.agentId && (appointment.agentId as any)._id ? (appointment.agentId as any)._id.toString() === user._id.toString() : appointment.agentId?.toString() === user._id.toString();
        const isOwner = appointment.propertyId && (appointment.propertyId as any).ownerId ? (appointment.propertyId as any).ownerId.toString() === user._id.toString() : false;

        if (!isAdmin && !isAgent && !isOwner) {
            throw new ForbiddenException('You can only delete your own appointments');
        }

        return this.appointmentModel.findByIdAndDelete(id).exec();
    }

    // ─── Add note ─────────────────────────────────────────────────────────────

    async addNote(id: string, content: string, user: User): Promise<Appointment> {
        const appointment = await this.appointmentModel
            .findById(id)
            .populate('propertyId', 'ownerId')
            .exec();

        if (!appointment) throw new NotFoundException(`Appointment #${id} not found`);

        const isAdmin = user.role === UserRole.ADMIN;
        const isAgent = appointment.agentId && (appointment.agentId as any)._id ? (appointment.agentId as any)._id.toString() === user._id.toString() : appointment.agentId?.toString() === user._id.toString();
        const isOwner = appointment.propertyId && (appointment.propertyId as any).ownerId ? (appointment.propertyId as any).ownerId.toString() === user._id.toString() : false;

        if (!isAdmin && !isAgent && !isOwner) {
            throw new ForbiddenException('You can only add notes to your own appointments');
        }

        const updated = await this.appointmentModel.findByIdAndUpdate(
            id,
            { $push: { notes: { content, createdAt: new Date() } } },
            { new: true },
        ).exec();

        if (!updated) throw new NotFoundException(`Appointment #${id} not found`);
        return updated;
    }

    // ─── Mark reminder sent ───────────────────────────────────────────────────

    async markReminderSent(id: string): Promise<void> {
        await this.appointmentModel.findByIdAndUpdate(id, { reminderSent: true }).exec();
    }

    // ─── Stats (scoped to agent or global for admin) ──────────────────────────

    async getStats(user: User): Promise<any> {
        const now = new Date();
        const isAdmin = user.role === UserRole.ADMIN;
        let scope: any = {};

        if (!isAdmin) {
            const userProperties = await this.propertyModel.find({ ownerId: user._id }).select('_id').lean();
            const propertyIds = userProperties.map(p => p._id);
            scope = {
                $or: [
                    { agentId: user._id },
                    { propertyId: { $in: propertyIds } }
                ]
            };
        }

        const [total, scheduled, rescheduled, completed, cancelled, noShow, upcoming] =
            await Promise.all([
                this.appointmentModel.countDocuments(scope),
                this.appointmentModel.countDocuments({ ...scope, status: 'scheduled' }),
                this.appointmentModel.countDocuments({ ...scope, status: 'rescheduled' }),
                this.appointmentModel.countDocuments({ ...scope, status: 'completed' }),
                this.appointmentModel.countDocuments({ ...scope, status: 'cancelled' }),
                this.appointmentModel.countDocuments({ ...scope, status: 'no-show' }),
                this.appointmentModel.countDocuments({ ...scope, status: 'scheduled', date: { $gte: now } }),
            ]);

        return {
            total,
            scheduled,
            rescheduled,
            completed,
            cancelled,
            noShow,
            upcoming,
            completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        };
    }
}
