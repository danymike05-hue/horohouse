"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const appointment_schema_1 = require("./schemas/appointment.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const property_schema_1 = require("../properties/schemas/property.schema");
let AppointmentsService = class AppointmentsService {
    appointmentModel;
    propertyModel;
    constructor(appointmentModel, propertyModel) {
        this.appointmentModel = appointmentModel;
        this.propertyModel = propertyModel;
    }
    async create(dto, agent) {
        const start = new Date(dto.date);
        const end = new Date(start.getTime() + (dto.duration ?? 60) * 60_000);
        const conflict = await this.appointmentModel.findOne({
            agentId: agent._id,
            status: { $in: [appointment_schema_1.AppointmentStatus.SCHEDULED, appointment_schema_1.AppointmentStatus.RESCHEDULED] },
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
            throw new common_1.BadRequestException(`Scheduling conflict: you already have "${conflict.title}" overlapping this time.`);
        }
        const created = new this.appointmentModel({
            ...dto,
            agentId: agent._id,
            propertyId: dto.propertyId ? new mongoose_2.Types.ObjectId(dto.propertyId) : undefined,
            clientId: dto.clientId ? new mongoose_2.Types.ObjectId(dto.clientId) : undefined,
        });
        return created.save();
    }
    async scheduleTour(dto, user) {
        const [hours, minutes] = dto.viewingTime.split(':').map(Number);
        const startDate = new Date(dto.viewingDate);
        startDate.setHours(hours, minutes, 0, 0);
        const duration = 60;
        const endDate = new Date(startDate.getTime() + duration * 60_000);
        if (dto.agentId) {
            const conflict = await this.appointmentModel.findOne({
                agentId: new mongoose_2.Types.ObjectId(dto.agentId),
                status: { $in: [appointment_schema_1.AppointmentStatus.SCHEDULED, appointment_schema_1.AppointmentStatus.RESCHEDULED] },
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
                throw new common_1.BadRequestException('The selected time slot is no longer available. Please choose another time.');
            }
        }
        const created = new this.appointmentModel({
            title: `Property Tour: ${dto.name}`,
            propertyId: new mongoose_2.Types.ObjectId(dto.propertyId),
            agentId: dto.agentId ? new mongoose_2.Types.ObjectId(dto.agentId) : user._id,
            clientId: user._id,
            clientName: dto.name,
            clientEmail: dto.email,
            clientPhone: dto.phone,
            type: dto.tourType,
            description: dto.message || undefined,
            date: startDate,
            duration,
            status: appointment_schema_1.AppointmentStatus.SCHEDULED,
        });
        return created.save();
    }
    async findMyTours(user, limit = 10) {
        return this.appointmentModel
            .find({ clientId: user._id })
            .sort({ date: 1 })
            .limit(limit)
            .populate('propertyId', 'title city address price type listingType images')
            .lean()
            .exec();
    }
    async findAll(agent, filters = {}) {
        const isAdmin = agent.role === user_schema_1.UserRole.ADMIN;
        const { page = 1, limit = 20, status, type, startDate, endDate, search, agentId } = filters;
        const skip = (page - 1) * limit;
        const conditions = [];
        if (!isAdmin) {
            const userProperties = await this.propertyModel.find({ ownerId: agent._id }).select('_id').lean();
            const propertyIds = userProperties.map(p => p._id);
            conditions.push({
                $or: [
                    { agentId: agent._id },
                    { propertyId: { $in: propertyIds } }
                ]
            });
        }
        else if (agentId) {
            conditions.push({ agentId: new mongoose_2.Types.ObjectId(agentId) });
        }
        if (status)
            conditions.push({ status });
        if (type)
            conditions.push({ type });
        if (startDate || endDate) {
            const dateQuery = {};
            if (startDate)
                dateQuery.$gte = startDate;
            if (endDate)
                dateQuery.$lte = endDate;
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
    async findOne(id, user) {
        if (!mongoose_2.Types.ObjectId.isValid(id))
            throw new common_1.BadRequestException('Invalid appointment ID');
        const appointment = await this.appointmentModel
            .findById(id)
            .populate('propertyId', 'title city address images price type listingType ownerId')
            .populate('agentId', 'name email profilePicture')
            .populate('clientId', 'name email phoneNumber')
            .exec();
        if (!appointment)
            throw new common_1.NotFoundException(`Appointment #${id} not found`);
        const isAdmin = user.role === user_schema_1.UserRole.ADMIN;
        const isAgent = appointment.agentId && appointment.agentId._id ? appointment.agentId._id.toString() === user._id.toString() : appointment.agentId?.toString() === user._id.toString();
        const isOwner = appointment.propertyId && appointment.propertyId.ownerId ? appointment.propertyId.ownerId.toString() === user._id.toString() : false;
        if (!isAdmin && !isAgent && !isOwner) {
            throw new common_1.ForbiddenException('You can only view your own appointments');
        }
        return appointment;
    }
    async update(id, dto, user) {
        const appointment = await this.appointmentModel
            .findById(id)
            .populate('propertyId', 'ownerId')
            .exec();
        if (!appointment)
            throw new common_1.NotFoundException(`Appointment #${id} not found`);
        const isAdmin = user.role === user_schema_1.UserRole.ADMIN;
        const isAgent = appointment.agentId && appointment.agentId._id ? appointment.agentId._id.toString() === user._id.toString() : appointment.agentId?.toString() === user._id.toString();
        const isOwner = appointment.propertyId && appointment.propertyId.ownerId ? appointment.propertyId.ownerId.toString() === user._id.toString() : false;
        if (!isAdmin && !isAgent && !isOwner) {
            throw new common_1.ForbiddenException('You can only update your own appointments');
        }
        const updateData = { ...dto };
        if (dto.date) {
            const newDate = new Date(dto.date);
            const oldDate = new Date(appointment.date);
            if (newDate.getTime() !== oldDate.getTime()) {
                const end = new Date(newDate.getTime() + (dto.duration ?? appointment.duration ?? 60) * 60_000);
                const conflict = await this.appointmentModel.findOne({
                    _id: { $ne: appointment._id },
                    agentId: appointment.agentId,
                    status: { $in: [appointment_schema_1.AppointmentStatus.SCHEDULED, appointment_schema_1.AppointmentStatus.RESCHEDULED] },
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
                    throw new common_1.BadRequestException(`Scheduling conflict: "${conflict.title}" overlaps the new time.`);
                }
                updateData.$push = {
                    rescheduleHistory: {
                        from: oldDate,
                        to: newDate,
                        reason: dto.description ?? 'Rescheduled',
                    },
                };
                if (!dto.status) {
                    updateData.status = appointment_schema_1.AppointmentStatus.RESCHEDULED;
                }
            }
        }
        const updated = await this.appointmentModel
            .findByIdAndUpdate(id, updateData, { new: true })
            .populate('propertyId', 'title city address images price type listingType')
            .populate('agentId', 'name email profilePicture')
            .populate('clientId', 'name email phoneNumber')
            .exec();
        if (!updated)
            throw new common_1.NotFoundException(`Appointment #${id} not found after update`);
        return updated;
    }
    async remove(id, user) {
        const appointment = await this.appointmentModel
            .findById(id)
            .populate('propertyId', 'ownerId')
            .exec();
        if (!appointment)
            throw new common_1.NotFoundException(`Appointment #${id} not found`);
        const isAdmin = user.role === user_schema_1.UserRole.ADMIN;
        const isAgent = appointment.agentId && appointment.agentId._id ? appointment.agentId._id.toString() === user._id.toString() : appointment.agentId?.toString() === user._id.toString();
        const isOwner = appointment.propertyId && appointment.propertyId.ownerId ? appointment.propertyId.ownerId.toString() === user._id.toString() : false;
        if (!isAdmin && !isAgent && !isOwner) {
            throw new common_1.ForbiddenException('You can only delete your own appointments');
        }
        return this.appointmentModel.findByIdAndDelete(id).exec();
    }
    async addNote(id, content, user) {
        const appointment = await this.appointmentModel
            .findById(id)
            .populate('propertyId', 'ownerId')
            .exec();
        if (!appointment)
            throw new common_1.NotFoundException(`Appointment #${id} not found`);
        const isAdmin = user.role === user_schema_1.UserRole.ADMIN;
        const isAgent = appointment.agentId && appointment.agentId._id ? appointment.agentId._id.toString() === user._id.toString() : appointment.agentId?.toString() === user._id.toString();
        const isOwner = appointment.propertyId && appointment.propertyId.ownerId ? appointment.propertyId.ownerId.toString() === user._id.toString() : false;
        if (!isAdmin && !isAgent && !isOwner) {
            throw new common_1.ForbiddenException('You can only add notes to your own appointments');
        }
        const updated = await this.appointmentModel.findByIdAndUpdate(id, { $push: { notes: { content, createdAt: new Date() } } }, { new: true }).exec();
        if (!updated)
            throw new common_1.NotFoundException(`Appointment #${id} not found`);
        return updated;
    }
    async markReminderSent(id) {
        await this.appointmentModel.findByIdAndUpdate(id, { reminderSent: true }).exec();
    }
    async getStats(user) {
        const now = new Date();
        const isAdmin = user.role === user_schema_1.UserRole.ADMIN;
        let scope = {};
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
        const [total, scheduled, rescheduled, completed, cancelled, noShow, upcoming] = await Promise.all([
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
};
exports.AppointmentsService = AppointmentsService;
exports.AppointmentsService = AppointmentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(appointment_schema_1.Appointment.name)),
    __param(1, (0, mongoose_1.InjectModel)(property_schema_1.Property.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], AppointmentsService);
//# sourceMappingURL=appointments.service.js.map