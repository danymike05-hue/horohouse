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
exports.StudentProfilesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const student_profiles_service_1 = require("./student-profiles.service");
const student_profile_dto_1 = require("./dto/student-profile.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const is_verified_student_guard_1 = require("./guards/is-verified-student.guard");
const user_schema_1 = require("../users/schemas/user.schema");
let StudentProfilesController = class StudentProfilesController {
    studentProfilesService;
    constructor(studentProfilesService) {
        this.studentProfilesService = studentProfilesService;
    }
    async create(req, dto) {
        return this.studentProfilesService.create(req.user._id.toString(), dto);
    }
    async getMyProfile(req) {
        return this.studentProfilesService.findMyProfile(req.user._id.toString());
    }
    async updateMyProfile(req, dto) {
        return this.studentProfilesService.update(req.user._id.toString(), dto);
    }
    async uploadStudentId(req) {
        const data = await req.file();
        if (!data) {
            throw new common_1.BadRequestException('No file uploaded');
        }
        const allowedMimetypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
        if (!allowedMimetypes.includes(data.mimetype)) {
            throw new common_1.BadRequestException('Unsupported file type. Please upload a JPEG, PNG, WebP, or HEIC image.');
        }
        const buffer = await data.toBuffer();
        return this.studentProfilesService.uploadStudentId(req.user._id.toString(), {
            buffer,
            mimetype: data.mimetype,
        });
    }
    async getVerificationStatus(req) {
        const profile = await this.studentProfilesService.findMyProfile(req.user._id.toString());
        return {
            verificationStatus: profile.verificationStatus,
            verificationSubmittedAt: profile.verificationSubmittedAt,
            verificationReviewedAt: profile.verificationReviewedAt,
            rejectionReason: profile.verificationRejectionReason ?? null,
        };
    }
    async getAmbassadorStats(req) {
        const profile = await this.studentProfilesService.findMyProfile(req.user._id.toString());
        return {
            isAmbassador: profile.isAmbassador,
            ambassadorCode: profile.ambassadorCode ?? null,
            ambassadorEarnings: profile.ambassadorEarnings,
            referralCount: profile.referralCount,
            landlordReferralCount: profile.landlordReferralCount,
        };
    }
    verifiedCheck() {
        return { verified: true, message: 'You have full student access.' };
    }
    async resolveAmbassadorCode(code) {
        const result = await this.studentProfilesService.resolveAmbassadorCode(code);
        if (!result) {
            throw new common_1.BadRequestException('Invalid referral code. Please check and try again.');
        }
        return { valid: true, message: 'Referral code accepted.' };
    }
    async adminFindAll(query) {
        return this.studentProfilesService.findAll(query);
    }
    async adminGetStats() {
        return this.studentProfilesService.getStats();
    }
    async adminFindOne(id) {
        return this.studentProfilesService.findById(id);
    }
    async reviewStudentId(id, req, dto) {
        return this.studentProfilesService.reviewStudentId(id, req.user._id.toString(), dto);
    }
    async grantAmbassador(id, dto) {
        return this.studentProfilesService.grantAmbassador(id, dto);
    }
};
exports.StudentProfilesController = StudentProfilesController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Onboard as a student — create your student profile' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Student profile created successfully' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Profile already exists' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, student_profile_dto_1.CreateStudentProfileDto]),
    __metadata("design:returntype", Promise)
], StudentProfilesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiOperation)({ summary: 'Get your student profile' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Student profile returned' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'No profile found — complete onboarding first' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StudentProfilesController.prototype, "getMyProfile", null);
__decorate([
    (0, common_1.Patch)('me'),
    (0, swagger_1.ApiOperation)({ summary: 'Update your student profile' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Profile updated' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, student_profile_dto_1.UpdateStudentProfileDto]),
    __metadata("design:returntype", Promise)
], StudentProfilesController.prototype, "updateMyProfile", null);
__decorate([
    (0, common_1.Post)('me/student-id'),
    (0, swagger_1.ApiOperation)({ summary: 'Upload your university ID for verification' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'ID uploaded — status set to PENDING' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'No file provided or unsupported format' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StudentProfilesController.prototype, "uploadStudentId", null);
__decorate([
    (0, common_1.Get)('me/verification-status'),
    (0, swagger_1.ApiOperation)({ summary: 'Check your current ID verification status' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Verification status returned' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StudentProfilesController.prototype, "getVerificationStatus", null);
__decorate([
    (0, common_1.Get)('me/ambassador-stats'),
    (0, swagger_1.ApiOperation)({ summary: 'Get your ambassador earnings and referral stats' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Ambassador stats returned' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StudentProfilesController.prototype, "getAmbassadorStats", null);
__decorate([
    (0, common_1.Get)('verified-check'),
    (0, common_1.UseGuards)(is_verified_student_guard_1.IsVerifiedStudentGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Check if the current user passes student verification' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User is a verified student' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Not verified — message explains why' }),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StudentProfilesController.prototype, "verifiedCheck", null);
__decorate([
    (0, common_1.Get)('ambassador/:code'),
    (0, swagger_1.ApiOperation)({ summary: 'Validate an ambassador referral code' }),
    (0, swagger_1.ApiParam)({ name: 'code', description: 'Ambassador referral code (case-insensitive)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Valid ambassador code' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Invalid or inactive ambassador code' }),
    __param(0, (0, common_1.Param)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StudentProfilesController.prototype, "resolveAmbassadorCode", null);
__decorate([
    (0, common_1.Get)('admin/all'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Admin: list all student profiles with filters' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Paginated list of student profiles' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [student_profile_dto_1.GetStudentProfilesQueryDto]),
    __metadata("design:returntype", Promise)
], StudentProfilesController.prototype, "adminFindAll", null);
__decorate([
    (0, common_1.Get)('admin/stats'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Admin: student profile stats for the dashboard' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Stats returned' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StudentProfilesController.prototype, "adminGetStats", null);
__decorate([
    (0, common_1.Get)('admin/:id'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Admin: get a student profile by ID' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'StudentProfile document ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Profile returned' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Profile not found' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StudentProfilesController.prototype, "adminFindOne", null);
__decorate([
    (0, common_1.Patch)('admin/:id/review'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Admin: approve or reject a student ID' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'StudentProfile document ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Review decision saved and student notified' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Profile not in PENDING state, or missing rejection reason' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, student_profile_dto_1.ReviewStudentIdDto]),
    __metadata("design:returntype", Promise)
], StudentProfilesController.prototype, "reviewStudentId", null);
__decorate([
    (0, common_1.Patch)('admin/:id/ambassador'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Admin: grant campus ambassador status' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'StudentProfile document ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Ambassador status granted' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Student not yet verified' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Ambassador code already in use' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, student_profile_dto_1.GrantAmbassadorDto]),
    __metadata("design:returntype", Promise)
], StudentProfilesController.prototype, "grantAmbassador", null);
exports.StudentProfilesController = StudentProfilesController = __decorate([
    (0, swagger_1.ApiTags)('Student Profiles'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.Controller)('student-profiles'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [student_profiles_service_1.StudentProfilesService])
], StudentProfilesController);
//# sourceMappingURL=student-profiles.controller.js.map