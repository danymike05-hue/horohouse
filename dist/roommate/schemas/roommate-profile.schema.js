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
exports.RoommateProfileSchema = exports.RoommateProfile = exports.MatchStatus = exports.RoommateMode = exports.StudyHabit = exports.SocialHabit = exports.CleanlinessLevel = exports.SleepSchedule = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var SleepSchedule;
(function (SleepSchedule) {
    SleepSchedule["EARLY_BIRD"] = "early_bird";
    SleepSchedule["NIGHT_OWL"] = "night_owl";
    SleepSchedule["FLEXIBLE"] = "flexible";
})(SleepSchedule || (exports.SleepSchedule = SleepSchedule = {}));
var CleanlinessLevel;
(function (CleanlinessLevel) {
    CleanlinessLevel["VERY_NEAT"] = "very_neat";
    CleanlinessLevel["NEAT"] = "neat";
    CleanlinessLevel["RELAXED"] = "relaxed";
})(CleanlinessLevel || (exports.CleanlinessLevel = CleanlinessLevel = {}));
var SocialHabit;
(function (SocialHabit) {
    SocialHabit["INTROVERTED"] = "introverted";
    SocialHabit["BALANCED"] = "balanced";
    SocialHabit["SOCIAL"] = "social";
})(SocialHabit || (exports.SocialHabit = SocialHabit = {}));
var StudyHabit;
(function (StudyHabit) {
    StudyHabit["HOME_STUDIER"] = "home_studier";
    StudyHabit["LIBRARY_GOER"] = "library_goer";
    StudyHabit["MIXED"] = "mixed";
})(StudyHabit || (exports.StudyHabit = StudyHabit = {}));
var RoommateMode;
(function (RoommateMode) {
    RoommateMode["HAVE_ROOM"] = "have_room";
    RoommateMode["NEED_ROOM"] = "need_room";
})(RoommateMode || (exports.RoommateMode = RoommateMode = {}));
var MatchStatus;
(function (MatchStatus) {
    MatchStatus["PENDING"] = "pending";
    MatchStatus["MATCHED"] = "matched";
    MatchStatus["REJECTED"] = "rejected";
    MatchStatus["EXPIRED"] = "expired";
})(MatchStatus || (exports.MatchStatus = MatchStatus = {}));
let RoommateProfile = class RoommateProfile {
    userId;
    studentProfileId;
    mode;
    propertyId;
    campusCity;
    preferredNeighborhood;
    budgetPerPersonMax;
    budgetPerPersonMin;
    moveInDate;
    moveInFlexibilityDays;
    sleepSchedule;
    cleanlinessLevel;
    socialHabit;
    studyHabit;
    isSmoker;
    acceptsSmoker;
    hasPet;
    acceptsPet;
    preferredRoommateGender;
    bio;
    isActive;
    createdAt;
    updatedAt;
};
exports.RoommateProfile = RoommateProfile;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, unique: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], RoommateProfile.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'StudentProfile', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], RoommateProfile.prototype, "studentProfileId", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: Object.values(RoommateMode),
        required: true,
        index: true,
    }),
    __metadata("design:type", String)
], RoommateProfile.prototype, "mode", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Property', index: true, sparse: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], RoommateProfile.prototype, "propertyId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true, index: true }),
    __metadata("design:type", String)
], RoommateProfile.prototype, "campusCity", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], RoommateProfile.prototype, "preferredNeighborhood", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 0 }),
    __metadata("design:type", Number)
], RoommateProfile.prototype, "budgetPerPersonMax", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0, min: 0 }),
    __metadata("design:type", Number)
], RoommateProfile.prototype, "budgetPerPersonMin", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Date)
], RoommateProfile.prototype, "moveInDate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 14, min: 0 }),
    __metadata("design:type", Number)
], RoommateProfile.prototype, "moveInFlexibilityDays", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: Object.values(SleepSchedule), required: true }),
    __metadata("design:type", String)
], RoommateProfile.prototype, "sleepSchedule", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: Object.values(CleanlinessLevel), required: true }),
    __metadata("design:type", String)
], RoommateProfile.prototype, "cleanlinessLevel", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: Object.values(SocialHabit), required: true }),
    __metadata("design:type", String)
], RoommateProfile.prototype, "socialHabit", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: Object.values(StudyHabit), required: true }),
    __metadata("design:type", String)
], RoommateProfile.prototype, "studyHabit", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], RoommateProfile.prototype, "isSmoker", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], RoommateProfile.prototype, "acceptsSmoker", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], RoommateProfile.prototype, "hasPet", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], RoommateProfile.prototype, "acceptsPet", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: ['male', 'female', 'any'],
        default: 'any',
    }),
    __metadata("design:type", String)
], RoommateProfile.prototype, "preferredRoommateGender", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true, maxlength: 300 }),
    __metadata("design:type", String)
], RoommateProfile.prototype, "bio", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true, index: true }),
    __metadata("design:type", Boolean)
], RoommateProfile.prototype, "isActive", void 0);
exports.RoommateProfile = RoommateProfile = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], RoommateProfile);
exports.RoommateProfileSchema = mongoose_1.SchemaFactory.createForClass(RoommateProfile);
exports.RoommateProfileSchema.index({ campusCity: 1, mode: 1, isActive: 1 });
exports.RoommateProfileSchema.index({ campusCity: 1, budgetPerPersonMax: 1, isActive: 1 });
exports.RoommateProfileSchema.index({ campusCity: 1, moveInDate: 1, isActive: 1 });
exports.RoommateProfileSchema.index({ campusCity: 1, sleepSchedule: 1, cleanlinessLevel: 1, isActive: 1 });
//# sourceMappingURL=roommate-profile.schema.js.map