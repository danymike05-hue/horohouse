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
exports.StudentPropertiesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const student_properties_service_1 = require("./student-properties.service");
const student_property_dto_1 = require("./dto/student-property.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const user_schema_1 = require("../users/schemas/user.schema");
let StudentPropertiesController = class StudentPropertiesController {
    studentPropertiesService;
    constructor(studentPropertiesService) {
        this.studentPropertiesService = studentPropertiesService;
    }
    async search(dto) {
        return this.studentPropertiesService.searchStudentProperties(dto);
    }
    async getStats() {
        return this.studentPropertiesService.getStudentPropertyStats();
    }
    async enrollProperty(propertyId, req, dto) {
        return this.studentPropertiesService.markAsStudentFriendly(propertyId, req.user, dto);
    }
    async updateEnrollment(propertyId, req, dto) {
        return this.studentPropertiesService.markAsStudentFriendly(propertyId, req.user, dto);
    }
    async removeEnrollment(propertyId, req) {
        return this.studentPropertiesService.removeStudentFriendly(propertyId, req.user);
    }
    async grantStudentApproved(propertyId, req) {
        return this.studentPropertiesService.grantStudentApproved(propertyId, req.user._id.toString());
    }
    async revokeStudentApproved(propertyId, req) {
        return this.studentPropertiesService.revokeStudentApproved(propertyId, req.user._id.toString());
    }
};
exports.StudentPropertiesController = StudentPropertiesController;
__decorate([
    (0, common_1.Get)('search'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Search student-friendly properties with campus-specific filters' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Paginated student property results' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [student_property_dto_1.StudentPropertySearchDto]),
    __metadata("design:returntype", Promise)
], StudentPropertiesController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Student housing stats — totals, cities, infrastructure breakdown' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Stats returned' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StudentPropertiesController.prototype, "getStats", null);
__decorate([
    (0, common_1.Post)(':propertyId/enroll'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Enroll a property in the student housing programme' }),
    (0, swagger_1.ApiParam)({ name: 'propertyId', description: 'Property ID' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Property enrolled — studentDetails saved' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Not your property' }),
    __param(0, (0, common_1.Param)('propertyId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, student_property_dto_1.MarkStudentFriendlyDto]),
    __metadata("design:returntype", Promise)
], StudentPropertiesController.prototype, "enrollProperty", null);
__decorate([
    (0, common_1.Patch)(':propertyId/enroll'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Update student details on an enrolled property' }),
    (0, swagger_1.ApiParam)({ name: 'propertyId', description: 'Property ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Student details updated' }),
    __param(0, (0, common_1.Param)('propertyId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, student_property_dto_1.MarkStudentFriendlyDto]),
    __metadata("design:returntype", Promise)
], StudentPropertiesController.prototype, "updateEnrollment", null);
__decorate([
    (0, common_1.Delete)(':propertyId/enroll'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Remove a property from the student housing programme' }),
    (0, swagger_1.ApiParam)({ name: 'propertyId', description: 'Property ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Property removed from student programme' }),
    __param(0, (0, common_1.Param)('propertyId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], StudentPropertiesController.prototype, "removeEnrollment", null);
__decorate([
    (0, common_1.Patch)('admin/:propertyId/approve'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Admin: grant Student-Approved badge to a property' }),
    (0, swagger_1.ApiParam)({ name: 'propertyId', description: 'Property ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Badge granted — property now ranks first in student search' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Property not enrolled in student programme' }),
    __param(0, (0, common_1.Param)('propertyId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], StudentPropertiesController.prototype, "grantStudentApproved", null);
__decorate([
    (0, common_1.Patch)('admin/:propertyId/revoke'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Admin: revoke Student-Approved badge' }),
    (0, swagger_1.ApiParam)({ name: 'propertyId', description: 'Property ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Badge revoked' }),
    __param(0, (0, common_1.Param)('propertyId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], StudentPropertiesController.prototype, "revokeStudentApproved", null);
exports.StudentPropertiesController = StudentPropertiesController = __decorate([
    (0, swagger_1.ApiTags)('Student Properties'),
    (0, common_1.Controller)('student-properties'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [student_properties_service_1.StudentPropertiesService])
], StudentPropertiesController);
//# sourceMappingURL=student-properties.controller.js.map