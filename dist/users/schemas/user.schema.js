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
exports.UserSchema = exports.User = exports.StudentVerificationStatus = exports.PayoutMethod = exports.HostVerificationStatus = exports.OnboardingStatus = exports.UserRole = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "admin";
    UserRole["AGENT"] = "agent";
    UserRole["LANDLORD"] = "landlord";
    UserRole["HOST"] = "host";
    UserRole["REGISTERED_USER"] = "registered_user";
    UserRole["GUEST"] = "guest";
    UserRole["STUDENT"] = "student";
})(UserRole || (exports.UserRole = UserRole = {}));
var OnboardingStatus;
(function (OnboardingStatus) {
    OnboardingStatus["NOT_STARTED"] = "not_started";
    OnboardingStatus["ROLE_SELECTED"] = "role_selected";
    OnboardingStatus["PHONE_PROVIDED"] = "phone_provided";
    OnboardingStatus["COMPLETED"] = "completed";
})(OnboardingStatus || (exports.OnboardingStatus = OnboardingStatus = {}));
var HostVerificationStatus;
(function (HostVerificationStatus) {
    HostVerificationStatus["UNVERIFIED"] = "unverified";
    HostVerificationStatus["PENDING"] = "pending";
    HostVerificationStatus["VERIFIED"] = "verified";
    HostVerificationStatus["REJECTED"] = "rejected";
})(HostVerificationStatus || (exports.HostVerificationStatus = HostVerificationStatus = {}));
var PayoutMethod;
(function (PayoutMethod) {
    PayoutMethod["MOBILE_MONEY"] = "mobile_money";
    PayoutMethod["BANK_TRANSFER"] = "bank_transfer";
    PayoutMethod["PAYPAL"] = "paypal";
})(PayoutMethod || (exports.PayoutMethod = PayoutMethod = {}));
var StudentVerificationStatus;
(function (StudentVerificationStatus) {
    StudentVerificationStatus["UNVERIFIED"] = "unverified";
    StudentVerificationStatus["PENDING"] = "pending";
    StudentVerificationStatus["VERIFIED"] = "verified";
    StudentVerificationStatus["REJECTED"] = "rejected";
})(StudentVerificationStatus || (exports.StudentVerificationStatus = StudentVerificationStatus = {}));
let User = class User {
    name;
    email;
    phoneNumber;
    role;
    profilePicture;
    favorites;
    preferences;
    searchHistory;
    recentlyViewed;
    isActive;
    specialties;
    languages;
    serviceAreas;
    emailVerified;
    phoneVerified;
    googleId;
    password;
    averageRating;
    reviewCount;
    phoneVerificationCode;
    phoneVerificationExpires;
    emailVerificationToken;
    emailVerificationExpires;
    resetPasswordToken;
    resetPasswordExpires;
    twoFactorEnabled;
    twoFactorSecret;
    sessions;
    licenseNumber;
    agency;
    bio;
    website;
    propertiesListed;
    propertiesSold;
    tenants;
    totalRentalIncome;
    occupancyRate;
    hostProfile;
    studentProfile;
    emailNotifications;
    smsNotifications;
    pushNotifications;
    pushTokens;
    location;
    address;
    city;
    country;
    onboardingCompleted;
    onboardingStatus;
    agentPreferences;
    createdAt;
    updatedAt;
    _id;
};
exports.User = User;
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], User.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ unique: true, sparse: true, lowercase: true, trim: true }),
    __metadata("design:type", String)
], User.prototype, "email", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], User.prototype, "phoneNumber", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: Object.values(UserRole), default: UserRole.REGISTERED_USER }),
    __metadata("design:type", String)
], User.prototype, "role", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: null }),
    __metadata("design:type", String)
], User.prototype, "profilePicture", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{ type: mongoose_2.Types.ObjectId, ref: 'Property' }], default: [] }),
    __metadata("design:type", Array)
], User.prototype, "favorites", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, default: {} }),
    __metadata("design:type", Object)
], User.prototype, "preferences", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [Object], default: [] }),
    __metadata("design:type", Array)
], User.prototype, "searchHistory", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                propertyId: { type: mongoose_2.Types.ObjectId, ref: 'Property' },
                viewedAt: { type: Date, default: Date.now },
            },
        ],
        default: [],
    }),
    __metadata("design:type", Array)
], User.prototype, "recentlyViewed", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], User.prototype, "isActive", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], User.prototype, "specialties", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: ['English'] }),
    __metadata("design:type", Array)
], User.prototype, "languages", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], User.prototype, "serviceAreas", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "emailVerified", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "phoneVerified", void 0);
__decorate([
    (0, mongoose_1.Prop)({ unique: true, sparse: true }),
    __metadata("design:type", String)
], User.prototype, "googleId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "password", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], User.prototype, "averageRating", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], User.prototype, "reviewCount", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "phoneVerificationCode", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], User.prototype, "phoneVerificationExpires", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "emailVerificationToken", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], User.prototype, "emailVerificationExpires", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "resetPasswordToken", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], User.prototype, "resetPasswordExpires", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "twoFactorEnabled", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "twoFactorSecret", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                id: { type: String, required: true },
                refreshToken: { type: String, required: true },
                device: { type: String, required: true },
                ipAddress: { type: String, required: true },
                userAgent: { type: String, required: true },
                location: { type: String },
                isActive: { type: Boolean, default: true },
                lastActive: { type: Date, default: Date.now },
                createdAt: { type: Date, default: Date.now },
                expiresAt: { type: Date, required: true },
            },
        ],
        default: [],
    }),
    __metadata("design:type", Array)
], User.prototype, "sessions", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "licenseNumber", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "agency", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "bio", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "website", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], User.prototype, "propertiesListed", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], User.prototype, "propertiesSold", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                _id: { type: mongoose_2.Types.ObjectId, default: () => new mongoose_2.Types.ObjectId() },
                tenantName: { type: String, required: true },
                tenantEmail: { type: String },
                tenantPhone: { type: String },
                tenantUserId: { type: mongoose_2.Types.ObjectId, ref: 'User' },
                propertyId: { type: mongoose_2.Types.ObjectId, ref: 'Property', required: true },
                leaseStart: { type: Date, required: true },
                leaseEnd: { type: Date, required: true },
                monthlyRent: { type: Number, required: true },
                depositAmount: { type: Number },
                status: { type: String, enum: ['active', 'ended', 'pending'], default: 'active' },
                notes: { type: String },
            },
        ],
        default: [],
    }),
    __metadata("design:type", Array)
], User.prototype, "tenants", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], User.prototype, "totalRentalIncome", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], User.prototype, "occupancyRate", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            verificationStatus: {
                type: String,
                enum: Object.values(HostVerificationStatus),
                default: HostVerificationStatus.UNVERIFIED,
            },
            governmentIdUrl: { type: String },
            governmentIdPublicId: { type: String },
            verificationSubmittedAt: { type: Date },
            verificationReviewedAt: { type: Date },
            verificationRejectionReason: { type: String },
            isSuperhost: { type: Boolean, default: false },
            superhostSince: { type: Date },
            instantBookEnabled: { type: Boolean, default: false },
            minNightsDefault: { type: Number, default: 1 },
            maxNightsDefault: { type: Number, default: 0 },
            advanceNoticeHours: { type: Number, default: 24 },
            bookingWindowMonths: { type: Number, default: 12 },
            responseRate: { type: Number },
            responseTimeMinutes: { type: Number },
            totalEarnings: { type: Number, default: 0 },
            currentMonthEarnings: { type: Number, default: 0 },
            completedStays: { type: Number, default: 0 },
            commissionRate: { type: Number, default: 0.12 },
            payoutAccounts: {
                type: [
                    {
                        method: { type: String, enum: Object.values(PayoutMethod), required: true },
                        accountIdentifier: { type: String, required: true },
                        providerName: { type: String },
                        isDefault: { type: Boolean, default: false },
                        currency: { type: String, default: 'XAF' },
                    },
                ],
                default: [],
            },
            payoutHistory: {
                type: [
                    {
                        _id: { type: mongoose_2.Types.ObjectId, default: () => new mongoose_2.Types.ObjectId() },
                        amount: { type: Number, required: true },
                        currency: { type: String, required: true },
                        method: { type: String, enum: Object.values(PayoutMethod), required: true },
                        reference: { type: String },
                        status: {
                            type: String,
                            enum: ['pending', 'processing', 'paid', 'failed'],
                            default: 'pending',
                        },
                        initiatedAt: { type: Date, required: true },
                        completedAt: { type: Date },
                        failureReason: { type: String },
                    },
                ],
                default: [],
            },
            petsAllowedDefault: { type: Boolean, default: false },
            smokingAllowedDefault: { type: Boolean, default: false },
            eventsAllowedDefault: { type: Boolean, default: false },
            checkInTimeDefault: { type: String, default: '15:00' },
            checkOutTimeDefault: { type: String, default: '11:00' },
            coHostIds: { type: [{ type: mongoose_2.Types.ObjectId, ref: 'User' }], default: [] },
            hostBio: { type: String },
            hostLanguages: { type: [String], default: [] },
            operatingCity: { type: String },
        },
        default: null,
    }),
    __metadata("design:type", Object)
], User.prototype, "hostProfile", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            universityName: { type: String },
            faculty: { type: String },
            studyLevel: { type: String },
            enrollmentYear: { type: Number },
            studentIdUrl: { type: String },
            studentIdPublicId: { type: String },
            verificationStatus: {
                type: String,
                enum: Object.values(StudentVerificationStatus),
                default: StudentVerificationStatus.UNVERIFIED,
            },
            verificationSubmittedAt: { type: Date },
            verificationReviewedAt: { type: Date },
            verificationRejectionReason: { type: String },
            campusCity: { type: String },
            campusLatitude: { type: Number },
            campusLongitude: { type: Number },
            roommateProfileId: { type: mongoose_2.Types.ObjectId, ref: 'RoommateProfile' },
            ambassadorCode: { type: String },
            isAmbassador: { type: Boolean, default: false },
            ambassadorEarnings: { type: Number, default: 0 },
        },
        default: null,
    }),
    __metadata("design:type", Object)
], User.prototype, "studentProfile", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], User.prototype, "emailNotifications", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], User.prototype, "smsNotifications", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], User.prototype, "pushNotifications", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                token: { type: String, required: true },
                platform: { type: String, enum: ['ios', 'android'], required: true },
                deviceId: { type: String },
                updatedAt: { type: Date, default: Date.now },
            },
        ],
        default: [],
    }),
    __metadata("design:type", Array)
], User.prototype, "pushTokens", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
        },
        coordinates: {
            type: [Number],
            default: [0, 0],
        },
    }),
    __metadata("design:type", Object)
], User.prototype, "location", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "address", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "city", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "country", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "onboardingCompleted", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: Object.values(OnboardingStatus),
        default: OnboardingStatus.COMPLETED,
    }),
    __metadata("design:type", String)
], User.prototype, "onboardingStatus", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, default: null }),
    __metadata("design:type", Object)
], User.prototype, "agentPreferences", void 0);
exports.User = User = __decorate([
    (0, mongoose_1.Schema)({
        timestamps: true,
        autoIndex: true,
    })
], User);
exports.UserSchema = mongoose_1.SchemaFactory.createForClass(User);
exports.UserSchema.index({ location: '2dsphere' });
exports.UserSchema.index({ 'preferences.preferredLocation': '2dsphere' });
exports.UserSchema.index({ 'recentlyViewed.propertyId': 1 });
exports.UserSchema.index({ 'sessions.id': 1 });
exports.UserSchema.index({ 'sessions.refreshToken': 1 });
exports.UserSchema.index({ 'sessions.expiresAt': 1 });
exports.UserSchema.index({ 'sessions.isActive': 1 });
exports.UserSchema.index({ role: 1 });
exports.UserSchema.index({ city: 1 });
exports.UserSchema.index({ country: 1 });
exports.UserSchema.index({ isActive: 1 });
exports.UserSchema.index({ 'hostProfile.verificationStatus': 1 });
exports.UserSchema.index({ 'hostProfile.isSuperhost': 1 });
exports.UserSchema.index({ 'hostProfile.payoutHistory.status': 1 });
exports.UserSchema.index({ role: 1, 'hostProfile.operatingCity': 1 });
exports.UserSchema.index({ 'pushTokens.token': 1 });
exports.UserSchema.index({ 'studentProfile.verificationStatus': 1 });
exports.UserSchema.index({ 'studentProfile.ambassadorCode': 1 }, { sparse: true });
exports.UserSchema.index({ 'studentProfile.roommateProfileId': 1 }, { sparse: true });
exports.UserSchema.index({ role: 1, 'studentProfile.campusCity': 1 });
exports.UserSchema.virtual('id').get(function () {
    return this._id.toString();
});
exports.UserSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret) => {
        delete ret._id;
        delete ret.password;
        delete ret.phoneVerificationCode;
        delete ret.emailVerificationToken;
        delete ret.resetPasswordToken;
        if (ret.hostProfile?.governmentIdPublicId) {
            delete ret.hostProfile.governmentIdPublicId;
        }
        if (ret.studentProfile?.studentIdPublicId) {
            delete ret.studentProfile.studentIdPublicId;
        }
        if (ret.sessions && Array.isArray(ret.sessions)) {
            ret.sessions = ret.sessions.map((session) => {
                const { refreshToken, ...sessionWithoutToken } = session;
                return sessionWithoutToken;
            });
        }
        return ret;
    },
});
//# sourceMappingURL=user.schema.js.map