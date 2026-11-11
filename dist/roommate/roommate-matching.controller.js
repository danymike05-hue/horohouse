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
exports.RoommateMatchingController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roommate_matching_service_1 = require("./roommate-matching.service");
const roommate_dto_1 = require("./dto/roommate.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const is_verified_student_guard_1 = require("../student-profiles/guards/is-verified-student.guard");
let RoommateMatchingController = class RoommateMatchingController {
    roommateMatchingService;
    constructor(roommateMatchingService) {
        this.roommateMatchingService = roommateMatchingService;
    }
    async createProfile(req, dto) {
        return this.roommateMatchingService.createProfile(req.user._id.toString(), dto);
    }
    async getMyProfile(req) {
        return this.roommateMatchingService.findMyProfile(req.user._id.toString());
    }
    async updateMyProfile(req, dto) {
        return this.roommateMatchingService.updateProfile(req.user._id.toString(), dto);
    }
    async deactivateMyProfile(req) {
        return this.roommateMatchingService.deactivateProfile(req.user._id.toString());
    }
    async reactivateMyProfile(req) {
        return this.roommateMatchingService.reactivateProfile(req.user._id.toString());
    }
    async getProfileById(id) {
        return this.roommateMatchingService.findProfileById(id);
    }
    async search(req, dto) {
        return this.roommateMatchingService.searchProfiles(req.user._id.toString(), dto);
    }
    async expressInterest(req, receiverUserId) {
        return this.roommateMatchingService.expressInterest(req.user._id.toString(), receiverUserId);
    }
    async acceptMatch(req, matchId) {
        return this.roommateMatchingService.acceptMatch(req.user._id.toString(), matchId);
    }
    async rejectMatch(req, matchId) {
        return this.roommateMatchingService.rejectMatch(req.user._id.toString(), matchId);
    }
    async getMyMatches(req) {
        return this.roommateMatchingService.getMyMatches(req.user._id.toString());
    }
};
exports.RoommateMatchingController = RoommateMatchingController;
__decorate([
    (0, common_1.Post)('profile'),
    (0, common_1.UseGuards)(is_verified_student_guard_1.IsVerifiedStudentGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Create your roommate profile (verified students only)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Profile created and added to the roommate pool' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Student ID not verified' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Profile already exists — use PATCH to update' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, roommate_dto_1.CreateRoommateProfileDto]),
    __metadata("design:returntype", Promise)
], RoommateMatchingController.prototype, "createProfile", null);
__decorate([
    (0, common_1.Get)('profile/me'),
    (0, swagger_1.ApiOperation)({ summary: 'Get your roommate profile' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Roommate profile returned' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'No profile found — create one first' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RoommateMatchingController.prototype, "getMyProfile", null);
__decorate([
    (0, common_1.Patch)('profile/me'),
    (0, swagger_1.ApiOperation)({ summary: 'Update your roommate profile' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Profile updated' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, roommate_dto_1.UpdateRoommateProfileDto]),
    __metadata("design:returntype", Promise)
], RoommateMatchingController.prototype, "updateMyProfile", null);
__decorate([
    (0, common_1.Delete)('profile/me'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Pause your roommate profile (soft deactivate)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Profile paused' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RoommateMatchingController.prototype, "deactivateMyProfile", null);
__decorate([
    (0, common_1.Patch)('profile/me/reactivate'),
    (0, swagger_1.ApiOperation)({ summary: 'Reactivate your paused roommate profile' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Profile reactivated' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RoommateMatchingController.prototype, "reactivateMyProfile", null);
__decorate([
    (0, common_1.Get)('profile/:id'),
    (0, common_1.UseGuards)(is_verified_student_guard_1.IsVerifiedStudentGuard),
    (0, swagger_1.ApiOperation)({ summary: "View another student's roommate profile" }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'RoommateProfile document ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Roommate profile returned' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Profile not found or inactive' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RoommateMatchingController.prototype, "getProfileById", null);
__decorate([
    (0, common_1.Get)('search'),
    (0, common_1.UseGuards)(is_verified_student_guard_1.IsVerifiedStudentGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Browse the roommate pool sorted by compatibility' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Paginated roommate profiles with compatibility scores' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, roommate_dto_1.SearchRoommatesDto]),
    __metadata("design:returntype", Promise)
], RoommateMatchingController.prototype, "search", null);
__decorate([
    (0, common_1.Post)('interest/:receiverUserId'),
    (0, common_1.UseGuards)(is_verified_student_guard_1.IsVerifiedStudentGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Express interest in a potential roommate' }),
    (0, swagger_1.ApiParam)({ name: 'receiverUserId', description: 'Target student User ID' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Interest sent (PENDING) or auto-matched (MATCHED)' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Cannot match with yourself, or profile inactive' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('receiverUserId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], RoommateMatchingController.prototype, "expressInterest", null);
__decorate([
    (0, common_1.Patch)('matches/:matchId/accept'),
    (0, common_1.UseGuards)(is_verified_student_guard_1.IsVerifiedStudentGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Accept a roommate match request' }),
    (0, swagger_1.ApiParam)({ name: 'matchId', description: 'RoommateMatch document ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Matched — chatRoomId returned' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Pending match not found' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('matchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], RoommateMatchingController.prototype, "acceptMatch", null);
__decorate([
    (0, common_1.Patch)('matches/:matchId/reject'),
    (0, common_1.UseGuards)(is_verified_student_guard_1.IsVerifiedStudentGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Decline a roommate match request' }),
    (0, swagger_1.ApiParam)({ name: 'matchId', description: 'RoommateMatch document ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Match declined' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Pending match not found' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('matchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], RoommateMatchingController.prototype, "rejectMatch", null);
__decorate([
    (0, common_1.Get)('matches'),
    (0, common_1.UseGuards)(is_verified_student_guard_1.IsVerifiedStudentGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Get all your roommate matches (pending and confirmed)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '{ pending: [...], matched: [...] }' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RoommateMatchingController.prototype, "getMyMatches", null);
exports.RoommateMatchingController = RoommateMatchingController = __decorate([
    (0, swagger_1.ApiTags)('Roommate Matching'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.Controller)('roommate-matching'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [roommate_matching_service_1.RoommateMatchingService])
], RoommateMatchingController);
//# sourceMappingURL=roommate-matching.controller.js.map