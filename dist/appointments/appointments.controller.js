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
exports.AppointmentsController = void 0;
const common_1 = require("@nestjs/common");
const appointments_service_1 = require("./appointments.service");
const create_appointment_dto_1 = require("./dto/create-appointment.dto");
const update_appointment_dto_1 = require("./dto/update-appointment.dto");
const schedule_tour_dto_1 = require("./dto/schedule-tour.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const swagger_1 = require("@nestjs/swagger");
const user_schema_1 = require("../users/schemas/user.schema");
const appointment_schema_1 = require("./schemas/appointment.schema");
let AppointmentsController = class AppointmentsController {
    appointmentsService;
    constructor(appointmentsService) {
        this.appointmentsService = appointmentsService;
    }
    create(dto, req) {
        return this.appointmentsService.create(dto, req.user);
    }
    scheduleTour(dto, req) {
        return this.appointmentsService.scheduleTour(dto, req.user);
    }
    getStats(req) {
        return this.appointmentsService.getStats(req.user);
    }
    getMyTours(req, limit) {
        return this.appointmentsService.findMyTours(req.user, limit ? parseInt(limit) : 10);
    }
    findAll(req, query) {
        const filters = {
            page: query.page ? parseInt(query.page) : 1,
            limit: query.limit ? parseInt(query.limit) : 50,
            status: query.status,
            type: query.type,
            startDate: query.startDate ? new Date(query.startDate) : undefined,
            endDate: query.endDate ? new Date(query.endDate) : undefined,
            search: query.search,
            agentId: query.agentId,
        };
        return this.appointmentsService.findAll(req.user, filters);
    }
    findOne(id, req) {
        return this.appointmentsService.findOne(id, req.user);
    }
    update(id, dto, req) {
        return this.appointmentsService.update(id, dto, req.user);
    }
    addNote(id, content, req) {
        return this.appointmentsService.addNote(id, content, req.user);
    }
    remove(id, req) {
        return this.appointmentsService.remove(id, req.user);
    }
};
exports.AppointmentsController = AppointmentsController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new appointment (agents & admins only)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Appointment created' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Scheduling conflict or validation error' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_appointment_dto_1.CreateAppointmentDto, Object]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('schedule'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.REGISTERED_USER, user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Schedule a property tour (all authenticated users)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Tour scheduled successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Scheduling conflict or validation error' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [schedule_tour_dto_1.ScheduleTourDto, Object]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "scheduleTour", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get appointment statistics (scoped to current user)' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('my-tours'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.REGISTERED_USER, user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get tours scheduled by the current user (as client)' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "getMyTours", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get appointments (scoped to agent; admin can view all)' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'status', required: false, enum: appointment_schema_1.AppointmentStatus }),
    (0, swagger_1.ApiQuery)({ name: 'type', required: false, enum: appointment_schema_1.AppointmentType }),
    (0, swagger_1.ApiQuery)({ name: 'startDate', required: false, type: String, description: 'ISO date string' }),
    (0, swagger_1.ApiQuery)({ name: 'endDate', required: false, type: String, description: 'ISO date string' }),
    (0, swagger_1.ApiQuery)({ name: 'search', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'agentId', required: false, type: String, description: 'Admin only: filter by agent' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get a single appointment (owner or admin only)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Update an appointment (owner or admin only)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_appointment_dto_1.UpdateAppointmentDto, Object]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/notes'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Add a note to an appointment' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('content')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "addNote", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Delete an appointment (owner or admin only)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "remove", null);
exports.AppointmentsController = AppointmentsController = __decorate([
    (0, swagger_1.ApiTags)('appointments'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('appointments'),
    __metadata("design:paramtypes", [appointments_service_1.AppointmentsService])
], AppointmentsController);
//# sourceMappingURL=appointments.controller.js.map