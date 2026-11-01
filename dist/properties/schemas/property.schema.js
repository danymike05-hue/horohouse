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
exports.PropertySchema = exports.Property = exports.GenderRestriction = exports.FurnishingStatus = exports.ElectricityBackup = exports.WaterSource = exports.CancellationPolicy = exports.PricingUnit = exports.ListingType = exports.ApprovalStatus = exports.PropertyStatus = exports.PropertyType = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var PropertyType;
(function (PropertyType) {
    PropertyType["APARTMENT"] = "apartment";
    PropertyType["HOUSE"] = "house";
    PropertyType["VILLA"] = "villa";
    PropertyType["STUDIO"] = "studio";
    PropertyType["DUPLEX"] = "duplex";
    PropertyType["BUNGALOW"] = "bungalow";
    PropertyType["PENTHOUSE"] = "penthouse";
    PropertyType["LAND"] = "land";
    PropertyType["COMMERCIAL"] = "commercial";
    PropertyType["OFFICE"] = "office";
    PropertyType["SHOP"] = "shop";
    PropertyType["WAREHOUSE"] = "warehouse";
    PropertyType["HOTEL"] = "hotel";
    PropertyType["MOTEL"] = "motel";
    PropertyType["VACATION_RENTAL"] = "vacation_rental";
    PropertyType["GUESTHOUSE"] = "guesthouse";
    PropertyType["HOSTEL"] = "hostel";
    PropertyType["RESORT"] = "resort";
    PropertyType["SERVICED_APARTMENT"] = "serviced_apartment";
})(PropertyType || (exports.PropertyType = PropertyType = {}));
var PropertyStatus;
(function (PropertyStatus) {
    PropertyStatus["ACTIVE"] = "active";
    PropertyStatus["SOLD"] = "sold";
    PropertyStatus["RENTED"] = "rented";
    PropertyStatus["PENDING"] = "pending";
    PropertyStatus["DRAFT"] = "draft";
})(PropertyStatus || (exports.PropertyStatus = PropertyStatus = {}));
var ApprovalStatus;
(function (ApprovalStatus) {
    ApprovalStatus["PENDING"] = "pending";
    ApprovalStatus["APPROVED"] = "approved";
    ApprovalStatus["REJECTED"] = "rejected";
})(ApprovalStatus || (exports.ApprovalStatus = ApprovalStatus = {}));
var ListingType;
(function (ListingType) {
    ListingType["SALE"] = "sale";
    ListingType["RENT"] = "rent";
    ListingType["SHORT_TERM"] = "short_term";
})(ListingType || (exports.ListingType = ListingType = {}));
var PricingUnit;
(function (PricingUnit) {
    PricingUnit["NIGHTLY"] = "nightly";
    PricingUnit["WEEKLY"] = "weekly";
    PricingUnit["MONTHLY"] = "monthly";
})(PricingUnit || (exports.PricingUnit = PricingUnit = {}));
var CancellationPolicy;
(function (CancellationPolicy) {
    CancellationPolicy["FLEXIBLE"] = "flexible";
    CancellationPolicy["MODERATE"] = "moderate";
    CancellationPolicy["STRICT"] = "strict";
    CancellationPolicy["NO_REFUND"] = "no_refund";
})(CancellationPolicy || (exports.CancellationPolicy = CancellationPolicy = {}));
var WaterSource;
(function (WaterSource) {
    WaterSource["CAMWATER"] = "camwater";
    WaterSource["BOREHOLE"] = "borehole";
    WaterSource["WELL"] = "well";
    WaterSource["TANKER"] = "tanker";
    WaterSource["CAMWATER_AND_BOREHOLE"] = "camwater_and_borehole";
})(WaterSource || (exports.WaterSource = WaterSource = {}));
var ElectricityBackup;
(function (ElectricityBackup) {
    ElectricityBackup["NONE"] = "none";
    ElectricityBackup["SOLAR"] = "solar";
    ElectricityBackup["GENERATOR"] = "generator";
    ElectricityBackup["SOLAR_AND_GENERATOR"] = "solar_and_generator";
})(ElectricityBackup || (exports.ElectricityBackup = ElectricityBackup = {}));
var FurnishingStatus;
(function (FurnishingStatus) {
    FurnishingStatus["UNFURNISHED"] = "unfurnished";
    FurnishingStatus["SEMI_FURNISHED"] = "semi_furnished";
    FurnishingStatus["FURNISHED"] = "furnished";
})(FurnishingStatus || (exports.FurnishingStatus = FurnishingStatus = {}));
var GenderRestriction;
(function (GenderRestriction) {
    GenderRestriction["NONE"] = "none";
    GenderRestriction["WOMEN_ONLY"] = "women_only";
    GenderRestriction["MEN_ONLY"] = "men_only";
})(GenderRestriction || (exports.GenderRestriction = GenderRestriction = {}));
let Property = class Property {
    _id;
    title;
    price;
    originalPrice;
    currency;
    type;
    listingType;
    description;
    city;
    address;
    state;
    neighborhood;
    country;
    location;
    latitude;
    longitude;
    images;
    videos;
    amenities;
    pricingUnit;
    minNights;
    maxNights;
    cleaningFee;
    serviceFee;
    weeklyDiscountPercent;
    monthlyDiscountPercent;
    customDiscountNights;
    customDiscountPercent;
    unavailableDates;
    weekendPrice;
    priceOverrides;
    noticeDays;
    windowMonths;
    externalCalendars;
    shortTermAmenities;
    isInstantBookable;
    cancellationPolicy;
    advanceNoticeDays;
    bookingWindowDays;
    isStudentFriendly;
    studentDetails;
    ownerId;
    agentId;
    area;
    yearBuilt;
    floorNumber;
    totalFloors;
    pricePerSqm;
    depositAmount;
    maintenanceFee;
    contactPhone;
    contactWhatsApp;
    contactEmail;
    keywords;
    slug;
    nearbyAmenities;
    transportAccess;
    viewsCount;
    inquiriesCount;
    favoritesCount;
    sharesCount;
    availability;
    approvalStatus;
    rejectionReason;
    isVerified;
    isFeatured;
    isActive;
    averageRating;
    reviewCount;
    starRating;
    virtualTourUrl;
    videoUrl;
    tourType;
    tourThumbnail;
    tourViews;
    createdAt;
    updatedAt;
};
exports.Property = Property;
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], Property.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Number)
], Property.prototype, "price", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: null }),
    __metadata("design:type", Object)
], Property.prototype, "originalPrice", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'XAF' }),
    __metadata("design:type", String)
], Property.prototype, "currency", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: Object.values(PropertyType), required: true }),
    __metadata("design:type", String)
], Property.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: Object.values(ListingType), required: true }),
    __metadata("design:type", String)
], Property.prototype, "listingType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Property.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Property.prototype, "city", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Property.prototype, "address", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Property.prototype, "state", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Property.prototype, "neighborhood", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Property.prototype, "country", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
        },
        coordinates: {
            type: [Number],
            default: undefined,
        },
    }),
    __metadata("design:type", Object)
], Property.prototype, "location", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], Property.prototype, "latitude", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], Property.prototype, "longitude", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [Object], default: [] }),
    __metadata("design:type", Array)
], Property.prototype, "images", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [Object], default: [] }),
    __metadata("design:type", Array)
], Property.prototype, "videos", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, default: {} }),
    __metadata("design:type", Object)
], Property.prototype, "amenities", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: Object.values(PricingUnit),
        default: PricingUnit.NIGHTLY,
    }),
    __metadata("design:type", String)
], Property.prototype, "pricingUnit", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 1, min: 1 }),
    __metadata("design:type", Number)
], Property.prototype, "minNights", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 365, min: 1 }),
    __metadata("design:type", Number)
], Property.prototype, "maxNights", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0, min: 0 }),
    __metadata("design:type", Number)
], Property.prototype, "cleaningFee", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0, min: 0 }),
    __metadata("design:type", Number)
], Property.prototype, "serviceFee", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 10, min: 0, max: 100 }),
    __metadata("design:type", Number)
], Property.prototype, "weeklyDiscountPercent", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 15, min: 0, max: 100 }),
    __metadata("design:type", Number)
], Property.prototype, "monthlyDiscountPercent", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: null }),
    __metadata("design:type", Object)
], Property.prototype, "customDiscountNights", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: null }),
    __metadata("design:type", Object)
], Property.prototype, "customDiscountPercent", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                from: { type: Date, required: true },
                to: { type: Date, required: true },
                reason: { type: String },
            },
        ],
        default: [],
    }),
    __metadata("design:type", Array)
], Property.prototype, "unavailableDates", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: null }),
    __metadata("design:type", Object)
], Property.prototype, "weekendPrice", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, default: {} }),
    __metadata("design:type", Object)
], Property.prototype, "priceOverrides", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0, min: 0 }),
    __metadata("design:type", Number)
], Property.prototype, "noticeDays", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 12 }),
    __metadata("design:type", Object)
], Property.prototype, "windowMonths", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                id: { type: String, required: true },
                name: { type: String, required: true },
                url: { type: String, required: true },
                lastSyncedAt: { type: Date, default: null },
            },
        ],
        default: [],
    }),
    __metadata("design:type", Array)
], Property.prototype, "externalCalendars", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, default: {} }),
    __metadata("design:type", Object)
], Property.prototype, "shortTermAmenities", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], Property.prototype, "isInstantBookable", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: Object.values(CancellationPolicy),
        default: CancellationPolicy.FLEXIBLE,
    }),
    __metadata("design:type", String)
], Property.prototype, "cancellationPolicy", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0, min: 0 }),
    __metadata("design:type", Number)
], Property.prototype, "advanceNoticeDays", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 365, min: 1 }),
    __metadata("design:type", Number)
], Property.prototype, "bookingWindowDays", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false, index: true }),
    __metadata("design:type", Boolean)
], Property.prototype, "isStudentFriendly", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            campusProximityMeters: { type: Number },
            nearestCampus: { type: String },
            walkingMinutes: { type: Number },
            taxiMinutes: { type: Number },
            waterSource: { type: String, enum: Object.values(WaterSource) },
            electricityBackup: { type: String, enum: Object.values(ElectricityBackup) },
            furnishingStatus: { type: String, enum: Object.values(FurnishingStatus) },
            genderRestriction: {
                type: String,
                enum: Object.values(GenderRestriction),
                default: GenderRestriction.NONE,
            },
            curfewTime: { type: String },
            visitorsAllowed: { type: Boolean },
            cookingAllowed: { type: Boolean },
            hasGatedCompound: { type: Boolean },
            hasNightWatchman: { type: Boolean },
            hasFence: { type: Boolean },
            isStudentApproved: { type: Boolean, default: false },
            maxAdvanceMonths: { type: Number },
            acceptsRentAdvanceScheme: { type: Boolean, default: false },
            availableBeds: { type: Number },
            totalBeds: { type: Number },
            pricePerPersonMonthly: { type: Number },
        },
        default: null,
    }),
    __metadata("design:type", Object)
], Property.prototype, "studentDetails", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Property.prototype, "ownerId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Property.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], Property.prototype, "area", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], Property.prototype, "yearBuilt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], Property.prototype, "floorNumber", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], Property.prototype, "totalFloors", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], Property.prototype, "pricePerSqm", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], Property.prototype, "depositAmount", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], Property.prototype, "maintenanceFee", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Property.prototype, "contactPhone", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Property.prototype, "contactWhatsApp", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Property.prototype, "contactEmail", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], Property.prototype, "keywords", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Property.prototype, "slug", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], Property.prototype, "nearbyAmenities", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], Property.prototype, "transportAccess", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Property.prototype, "viewsCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Property.prototype, "inquiriesCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Property.prototype, "favoritesCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Property.prototype, "sharesCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: Object.values(PropertyStatus), default: PropertyStatus.ACTIVE }),
    __metadata("design:type", String)
], Property.prototype, "availability", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: Object.values(ApprovalStatus), default: ApprovalStatus.PENDING }),
    __metadata("design:type", String)
], Property.prototype, "approvalStatus", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Property.prototype, "rejectionReason", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], Property.prototype, "isVerified", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], Property.prototype, "isFeatured", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], Property.prototype, "isActive", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Property.prototype, "averageRating", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Property.prototype, "reviewCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ min: 1, max: 5 }),
    __metadata("design:type", Number)
], Property.prototype, "starRating", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Property.prototype, "virtualTourUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Property.prototype, "videoUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: ['kuula', 'youtube', 'images', 'none'],
        default: 'none',
    }),
    __metadata("design:type", String)
], Property.prototype, "tourType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: null }),
    __metadata("design:type", String)
], Property.prototype, "tourThumbnail", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Property.prototype, "tourViews", void 0);
exports.Property = Property = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Property);
exports.PropertySchema = mongoose_1.SchemaFactory.createForClass(Property);
exports.PropertySchema.index({ location: '2dsphere' });
exports.PropertySchema.index({ location: '2dsphere', type: 1, availability: 1 });
exports.PropertySchema.index({
    title: 'text',
    description: 'text',
    city: 'text',
    neighborhood: 'text',
    keywords: 'text',
});
exports.PropertySchema.index({ city: 1, type: 1, listingType: 1 });
exports.PropertySchema.index({ price: 1, city: 1 });
exports.PropertySchema.index({ availability: 1, isActive: 1 });
exports.PropertySchema.index({ ownerId: 1, createdAt: -1 });
exports.PropertySchema.index({ viewsCount: -1 });
exports.PropertySchema.index({ createdAt: -1 });
exports.PropertySchema.index({ listingType: 1, isInstantBookable: 1, isActive: 1 });
exports.PropertySchema.index({ listingType: 1, cancellationPolicy: 1 });
exports.PropertySchema.index({ 'unavailableDates.from': 1, 'unavailableDates.to': 1 });
exports.PropertySchema.index({ isStudentFriendly: 1, city: 1, isActive: 1, approvalStatus: 1 });
exports.PropertySchema.index({ isStudentFriendly: 1, 'studentDetails.campusProximityMeters': 1 });
exports.PropertySchema.index({ isStudentFriendly: 1, 'studentDetails.isStudentApproved': 1 });
exports.PropertySchema.index({ 'studentDetails.waterSource': 1 });
exports.PropertySchema.index({ 'studentDetails.electricityBackup': 1 });
exports.PropertySchema.index({ isStudentFriendly: 1, 'studentDetails.availableBeds': 1 });
exports.PropertySchema.index({ isStudentFriendly: 1, 'studentDetails.pricePerPersonMonthly': 1 });
exports.PropertySchema.index({ tourType: 1, isActive: 1 });
//# sourceMappingURL=property.schema.js.map