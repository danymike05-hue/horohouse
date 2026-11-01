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
exports.SplitPaymentsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const split_payments_service_1 = require("./split-payments.service");
const split_payment_dto_1 = require("./dto/split-payment.dto");
const split_payment_schema_1 = require("./schemas/split-payment.schema");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const user_schema_1 = require("../users/schemas/user.schema");
let SplitPaymentsController = class SplitPaymentsController {
    splitPaymentsService;
    constructor(splitPaymentsService) {
        this.splitPaymentsService = splitPaymentsService;
    }
    calculate(dto) {
        return this.splitPaymentsService.calculateSplit(dto);
    }
    createCycle(req, dto) {
        return this.splitPaymentsService.createCycle(req.user._id.toString(), dto);
    }
    getLandlordCycles(req, status) {
        return this.splitPaymentsService.findByLandlord(req.user._id.toString(), status);
    }
    getCyclesByLease(leaseId) {
        return this.splitPaymentsService.findByLease(leaseId);
    }
    initiateCharge(cycleId, req, dto) {
        return this.splitPaymentsService.initiateCharge(cycleId, dto, req.user._id.toString());
    }
    recordPayment(cycleId, req, dto) {
        return this.splitPaymentsService.recordPayment(cycleId, dto, req.user._id.toString());
    }
    getMyPayments(req) {
        return this.splitPaymentsService.findMyPayments(req.user._id.toString());
    }
    getCycle(cycleId) {
        return this.splitPaymentsService.findById(cycleId);
    }
    markDisbursed(cycleId, req, body) {
        return this.splitPaymentsService.markDisbursed(cycleId, req.user._id.toString(), body.disbursementTransactionId);
    }
};
exports.SplitPaymentsController = SplitPaymentsController;
__decorate([
    (0, common_1.Post)('calculate'),
    (0, swagger_1.ApiOperation)({ summary: 'Stateless rent split calculator — returns per-tenant breakdown' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Calculated split returned' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [split_payment_dto_1.SplitRentCalculatorDto]),
    __metadata("design:returntype", void 0)
], SplitPaymentsController.prototype, "calculate", null);
__decorate([
    (0, common_1.Post)('cycles'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Create a billing cycle ledger for a lease' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Cycle created — tenants notified' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, split_payment_dto_1.CreateSplitPaymentDto]),
    __metadata("design:returntype", void 0)
], SplitPaymentsController.prototype, "createCycle", null);
__decorate([
    (0, common_1.Get)('cycles/landlord'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get all cycles for the calling landlord' }),
    (0, swagger_1.ApiQuery)({ name: 'status', enum: split_payment_schema_1.SplitPaymentStatus, required: false }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SplitPaymentsController.prototype, "getLandlordCycles", null);
__decorate([
    (0, common_1.Get)('cycles/lease/:leaseId'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get all cycles for a specific lease' }),
    (0, swagger_1.ApiParam)({ name: 'leaseId' }),
    __param(0, (0, common_1.Param)('leaseId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SplitPaymentsController.prototype, "getCyclesByLease", null);
__decorate([
    (0, common_1.Post)('cycles/:cycleId/charge'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Send a MoMo payment request to a specific tenant' }),
    (0, swagger_1.ApiParam)({ name: 'cycleId' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'MoMo prompt sent — reference returned' }),
    __param(0, (0, common_1.Param)('cycleId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, split_payment_dto_1.InitiateTenantChargeDto]),
    __metadata("design:returntype", void 0)
], SplitPaymentsController.prototype, "initiateCharge", null);
__decorate([
    (0, common_1.Patch)('cycles/:cycleId/payment'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Record a tenant payment (manual or webhook-triggered)' }),
    (0, swagger_1.ApiParam)({ name: 'cycleId' }),
    __param(0, (0, common_1.Param)('cycleId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, split_payment_dto_1.RecordTenantPaymentDto]),
    __metadata("design:returntype", void 0)
], SplitPaymentsController.prototype, "recordPayment", null);
__decorate([
    (0, common_1.Get)('cycles/mine'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all payment cycles where I am a tenant' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SplitPaymentsController.prototype, "getMyPayments", null);
__decorate([
    (0, common_1.Get)('cycles/:cycleId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a single payment cycle by ID' }),
    (0, swagger_1.ApiParam)({ name: 'cycleId' }),
    __param(0, (0, common_1.Param)('cycleId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SplitPaymentsController.prototype, "getCycle", null);
__decorate([
    (0, common_1.Patch)('cycles/:cycleId/disburse'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Admin: mark a complete cycle as disbursed to landlord' }),
    (0, swagger_1.ApiParam)({ name: 'cycleId' }),
    __param(0, (0, common_1.Param)('cycleId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], SplitPaymentsController.prototype, "markDisbursed", null);
exports.SplitPaymentsController = SplitPaymentsController = __decorate([
    (0, swagger_1.ApiTags)('Split Payments'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.Controller)('split-payments'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [split_payments_service_1.SplitPaymentsService])
], SplitPaymentsController);
//# sourceMappingURL=split-payments.controller.js.map