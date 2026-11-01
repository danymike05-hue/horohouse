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
exports.RoomSchema = exports.Room = exports.BedType = exports.RoomType = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var RoomType;
(function (RoomType) {
    RoomType["SINGLE"] = "single";
    RoomType["DOUBLE"] = "double";
    RoomType["TWIN"] = "twin";
    RoomType["SUITE"] = "suite";
    RoomType["DORMITORY"] = "dormitory";
    RoomType["DELUXE"] = "deluxe";
    RoomType["FAMILY"] = "family";
    RoomType["PENTHOUSE"] = "penthouse";
    RoomType["STUDIO"] = "studio";
})(RoomType || (exports.RoomType = RoomType = {}));
var BedType;
(function (BedType) {
    BedType["SINGLE"] = "single";
    BedType["DOUBLE"] = "double";
    BedType["QUEEN"] = "queen";
    BedType["KING"] = "king";
    BedType["BUNK"] = "bunk";
    BedType["SOFA"] = "sofa_bed";
})(BedType || (exports.BedType = BedType = {}));
let Room = class Room {
    _id;
    propertyId;
    name;
    roomNumber;
    roomType;
    maxGuests;
    bedCount;
    bedType;
    price;
    cleaningFee;
    amenities;
    images;
    unavailableDates;
    icalUrl;
    icalLastSyncedAt;
    icalSyncedRangesCount;
    isActive;
    bookingsCount;
    createdAt;
    updatedAt;
};
exports.Room = Room;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Property', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Room.prototype, "propertyId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], Room.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], Room.prototype, "roomNumber", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: Object.values(RoomType),
        required: true,
    }),
    __metadata("design:type", String)
], Room.prototype, "roomType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 1, default: 2 }),
    __metadata("design:type", Number)
], Room.prototype, "maxGuests", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 1, min: 1 }),
    __metadata("design:type", Number)
], Room.prototype, "bedCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: Object.values(BedType),
        default: BedType.DOUBLE,
    }),
    __metadata("design:type", String)
], Room.prototype, "bedType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ min: 0 }),
    __metadata("design:type", Number)
], Room.prototype, "price", void 0);
__decorate([
    (0, mongoose_1.Prop)({ min: 0 }),
    __metadata("design:type", Number)
], Room.prototype, "cleaningFee", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, default: {} }),
    __metadata("design:type", Object)
], Room.prototype, "amenities", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [Object], default: [] }),
    __metadata("design:type", Array)
], Room.prototype, "images", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                from: { type: Date, required: true },
                to: { type: Date, required: true },
                reason: { type: String },
                source: { type: String, default: 'manual' },
            },
        ],
        default: [],
    }),
    __metadata("design:type", Array)
], Room.prototype, "unavailableDates", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], Room.prototype, "icalUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Room.prototype, "icalLastSyncedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Room.prototype, "icalSyncedRangesCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], Room.prototype, "isActive", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Room.prototype, "bookingsCount", void 0);
exports.Room = Room = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Room);
exports.RoomSchema = mongoose_1.SchemaFactory.createForClass(Room);
exports.RoomSchema.index({ propertyId: 1, isActive: 1 });
exports.RoomSchema.index({ propertyId: 1, roomType: 1 });
exports.RoomSchema.index({ 'unavailableDates.from': 1, 'unavailableDates.to': 1 });
exports.RoomSchema.index({ icalUrl: 1 }, { sparse: true });
//# sourceMappingURL=room.schema.js.map