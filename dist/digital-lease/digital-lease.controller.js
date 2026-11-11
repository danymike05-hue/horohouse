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
exports.DigitalLeaseController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const digital_lease_service_1 = require("./digital-lease.service");
const digital_lease_dto_1 = require("./dto/digital-lease.dto");
const digital_lease_schema_1 = require("./schemas/digital-lease.schema");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const user_schema_1 = require("../users/schemas/user.schema");
let DigitalLeaseController = class DigitalLeaseController {
    digitalLeaseService;
    constructor(digitalLeaseService) {
        this.digitalLeaseService = digitalLeaseService;
    }
    create(req, dto) {
        return this.digitalLeaseService.create(req.user._id.toString(), dto);
    }
    getLandlordLeases(req, status) {
        return this.digitalLeaseService.findByLandlord(req.user._id.toString(), status);
    }
    getTenantLeases(req) {
        return this.digitalLeaseService.findByTenant(req.user._id.toString());
    }
    findOne(leaseId) {
        return this.digitalLeaseService.findById(leaseId);
    }
    sign(leaseId, req, dto) {
        return this.digitalLeaseService.sign(leaseId, req.user._id.toString(), dto);
    }
    addConditionLog(leaseId, req, dto) {
        return this.digitalLeaseService.addConditionLog(leaseId, req.user._id.toString(), dto);
    }
    async uploadConditionPhotos(leaseId, logType, itemLabel, req) {
        if (!logType || !itemLabel) {
            throw new common_1.BadRequestException('logType and itemLabel query params are required.');
        }
        const files = [];
        const parts = req.parts();
        for await (const part of parts) {
            if (part.type === 'file') {
                const chunks = [];
                for await (const chunk of part.file) {
                    chunks.push(Buffer.from(chunk));
                }
                files.push({ buffer: Buffer.concat(chunks) });
            }
        }
        if (files.length === 0) {
            throw new common_1.BadRequestException('No files uploaded.');
        }
        return this.digitalLeaseService.uploadConditionPhotos(leaseId, logType, itemLabel, files, req.user._id.toString());
    }
    terminate(leaseId, req, dto) {
        return this.digitalLeaseService.terminate(leaseId, req.user._id.toString(), dto);
    }
};
exports.DigitalLeaseController = DigitalLeaseController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Create a lease draft (landlord/agent)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Lease draft created with standard HoroHouse clauses' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, digital_lease_dto_1.CreateDigitalLeaseDto]),
    __metadata("design:returntype", void 0)
], DigitalLeaseController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('mine/landlord'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get all leases where I am the landlord' }),
    (0, swagger_1.ApiQuery)({ name: 'status', enum: digital_lease_schema_1.LeaseStatus, required: false }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], DigitalLeaseController.prototype, "getLandlordLeases", null);
__decorate([
    (0, common_1.Get)('mine/tenant'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all leases where I am a tenant' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DigitalLeaseController.prototype, "getTenantLeases", null);
__decorate([
    (0, common_1.Get)(':leaseId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a lease by ID' }),
    (0, swagger_1.ApiParam)({ name: 'leaseId' }),
    __param(0, (0, common_1.Param)('leaseId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DigitalLeaseController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':leaseId/sign'),
    (0, swagger_1.ApiOperation)({ summary: 'Sign the lease (landlord or tenant) — uploads signature to Cloudinary' }),
    (0, swagger_1.ApiParam)({ name: 'leaseId' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Signed. If all parties signed, lease becomes ACTIVE and first billing cycle is created.' }),
    __param(0, (0, common_1.Param)('leaseId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, digital_lease_dto_1.SignLeaseDto]),
    __metadata("design:returntype", void 0)
], DigitalLeaseController.prototype, "sign", null);
__decorate([
    (0, common_1.Post)(':leaseId/condition-log'),
    (0, swagger_1.ApiOperation)({ summary: 'Add a move-in or move-out condition log' }),
    (0, swagger_1.ApiParam)({ name: 'leaseId' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Log recorded. Add photos separately via /condition-photos.' }),
    __param(0, (0, common_1.Param)('leaseId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, digital_lease_dto_1.AddConditionLogDto]),
    __metadata("design:returntype", void 0)
], DigitalLeaseController.prototype, "addConditionLog", null);
__decorate([
    (0, common_1.Post)(':leaseId/condition-photos'),
    (0, swagger_1.ApiOperation)({ summary: 'Upload condition log photos for a specific item' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiParam)({ name: 'leaseId' }),
    (0, swagger_1.ApiQuery)({ name: 'logType', enum: ['move_in', 'move_out'] }),
    (0, swagger_1.ApiQuery)({ name: 'itemLabel', description: 'Must match an existing item label in the log' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Photos uploaded and attached to condition log item' }),
    __param(0, (0, common_1.Param)('leaseId')),
    __param(1, (0, common_1.Query)('logType')),
    __param(2, (0, common_1.Query)('itemLabel')),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], DigitalLeaseController.prototype, "uploadConditionPhotos", null);
__decorate([
    (0, common_1.Patch)(':leaseId/terminate'),
    (0, swagger_1.ApiOperation)({ summary: 'Terminate a lease early (any party)' }),
    (0, swagger_1.ApiParam)({ name: 'leaseId' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Lease terminated — other party notified' }),
    __param(0, (0, common_1.Param)('leaseId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, digital_lease_dto_1.TerminateLeaseDto]),
    __metadata("design:returntype", void 0)
], DigitalLeaseController.prototype, "terminate", null);
exports.DigitalLeaseController = DigitalLeaseController = __decorate([
    (0, swagger_1.ApiTags)('Digital Leases'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.Controller)('digital-leases'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [digital_lease_service_1.DigitalLeaseService])
], DigitalLeaseController);
//# sourceMappingURL=digital-lease.controller.js.map