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
exports.IsVerifiedStudentGuard = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const user_schema_1 = require("../../users/schemas/user.schema");
const student_profile_schema_1 = require("../schemas/student-profile.schema");
let IsVerifiedStudentGuard = class IsVerifiedStudentGuard {
    studentProfileModel;
    constructor(studentProfileModel) {
        this.studentProfileModel = studentProfileModel;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user) {
            throw new common_1.UnauthorizedException('Authentication required');
        }
        if (user.role === user_schema_1.UserRole.ADMIN) {
            return true;
        }
        if (user.role !== user_schema_1.UserRole.STUDENT) {
            throw new common_1.ForbiddenException('This feature is only available to registered students. ' +
                'Switch to Student mode in your profile settings.');
        }
        const studentProfile = await this.studentProfileModel
            .findOne({ userId: new mongoose_2.Types.ObjectId(user._id ?? user.id) })
            .select('verificationStatus')
            .lean()
            .exec();
        const verificationStatus = studentProfile?.verificationStatus;
        if (verificationStatus !== user_schema_1.StudentVerificationStatus.VERIFIED) {
            const messages = {
                [user_schema_1.StudentVerificationStatus.UNVERIFIED]: 'Please upload your university ID to access this feature.',
                [user_schema_1.StudentVerificationStatus.PENDING]: 'Your student ID is under review. You will be notified once approved (usually within 24h).',
                [user_schema_1.StudentVerificationStatus.REJECTED]: 'Your student ID was rejected. Please upload a valid document and resubmit.',
            };
            throw new common_1.ForbiddenException(messages[verificationStatus ?? user_schema_1.StudentVerificationStatus.UNVERIFIED] ??
                'Student verification required to access this feature.');
        }
        return true;
    }
};
exports.IsVerifiedStudentGuard = IsVerifiedStudentGuard;
exports.IsVerifiedStudentGuard = IsVerifiedStudentGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(student_profile_schema_1.StudentProfile.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], IsVerifiedStudentGuard);
//# sourceMappingURL=is-verified-student.guard.js.map