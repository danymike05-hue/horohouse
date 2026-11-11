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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentProfileSchema = exports.StudentProfile = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const user_schema_1 = require("../../users/schemas/user.schema");
let StudentProfile = class StudentProfile {
    userId;
    universityName;
    faculty;
    studyLevel;
    enrollmentYear;
    studentIdUrl;
    studentIdPublicId;
    verificationStatus;
    verificationSubmittedAt;
    verificationReviewedAt;
    verificationRejectionReason;
    verificationReviewedBy;
    campusCity;
    campusName;
    campusLatitude;
    campusLongitude;
    isSeekingRoommate;
    roommateMode;
    roommateProfileId;
    isAmbassador;
    ambassadorCode;
    ambassadorEarnings;
    referralCount;
    landlordReferralCount;
    createdAt;
    updatedAt;
};
exports.StudentProfile = StudentProfile;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, unique: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], StudentProfile.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], StudentProfile.prototype, "universityName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], StudentProfile.prototype, "faculty", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], StudentProfile.prototype, "studyLevel", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], StudentProfile.prototype, "enrollmentYear", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], StudentProfile.prototype, "studentIdUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], StudentProfile.prototype, "studentIdPublicId", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: Object.values(user_schema_1.StudentVerificationStatus),
        default: user_schema_1.StudentVerificationStatus.UNVERIFIED,
        index: true,
    }),
    __metadata("design:type", String)
], StudentProfile.prototype, "verificationStatus", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], StudentProfile.prototype, "verificationSubmittedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], StudentProfile.prototype, "verificationReviewedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], StudentProfile.prototype, "verificationRejectionReason", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], StudentProfile.prototype, "verificationReviewedBy", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true, index: true }),
    __metadata("design:type", String)
], StudentProfile.prototype, "campusCity", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], StudentProfile.prototype, "campusName", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], StudentProfile.prototype, "campusLatitude", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], StudentProfile.prototype, "campusLongitude", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false, index: true }),
    __metadata("design:type", Boolean)
], StudentProfile.prototype, "isSeekingRoommate", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: ['have_room', 'need_room'],
        default: null,
    }),
    __metadata("design:type", Object)
], StudentProfile.prototype, "roommateMode", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'RoommateProfile', index: true, sparse: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], StudentProfile.prototype, "roommateProfileId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], StudentProfile.prototype, "isAmbassador", void 0);
__decorate([
    (0, mongoose_1.Prop)({ unique: true, sparse: true, uppercase: true, trim: true }),
    __metadata("design:type", String)
], StudentProfile.prototype, "ambassadorCode", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0, min: 0 }),
    __metadata("design:type", Number)
], StudentProfile.prototype, "ambassadorEarnings", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], StudentProfile.prototype, "referralCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], StudentProfile.prototype, "landlordReferralCount", void 0);
exports.StudentProfile = StudentProfile = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], StudentProfile);
exports.StudentProfileSchema = mongoose_1.SchemaFactory.createForClass(StudentProfile);
exports.StudentProfileSchema.index({ campusCity: 1, verificationStatus: 1 });
exports.StudentProfileSchema.index({ campusCity: 1, isSeekingRoommate: 1 });
exports.StudentProfileSchema.index({ isAmbassador: 1, campusCity: 1 });
//# sourceMappingURL=student-profile.schema.js.map