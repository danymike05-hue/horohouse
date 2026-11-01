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
exports.BookingSchema = exports.Booking = exports.CancelledBy = exports.CancellationPolicy = exports.PaymentStatus = exports.BookingStatus = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var BookingStatus;
(function (BookingStatus) {
    BookingStatus["PENDING"] = "pending";
    BookingStatus["CONFIRMED"] = "confirmed";
    BookingStatus["CANCELLED"] = "cancelled";
    BookingStatus["COMPLETED"] = "completed";
    BookingStatus["REJECTED"] = "rejected";
    BookingStatus["NO_SHOW"] = "no_show";
})(BookingStatus || (exports.BookingStatus = BookingStatus = {}));
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["UNPAID"] = "unpaid";
    PaymentStatus["PAID"] = "paid";
    PaymentStatus["REFUNDED"] = "refunded";
    PaymentStatus["PARTIAL"] = "partial";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
var CancellationPolicy;
(function (CancellationPolicy) {
    CancellationPolicy["FLEXIBLE"] = "flexible";
    CancellationPolicy["MODERATE"] = "moderate";
    CancellationPolicy["STRICT"] = "strict";
    CancellationPolicy["NO_REFUND"] = "no_refund";
})(CancellationPolicy || (exports.CancellationPolicy = CancellationPolicy = {}));
var CancelledBy;
(function (CancelledBy) {
    CancelledBy["GUEST"] = "guest";
    CancelledBy["HOST"] = "host";
    CancelledBy["ADMIN"] = "admin";
    CancelledBy["SYSTEM"] = "system";
})(CancelledBy || (exports.CancelledBy = CancelledBy = {}));
let Booking = class Booking {
    _id;
    propertyId;
    roomId;
    guestId;
    hostId;
    checkIn;
    checkOut;
    nights;
    guests;
    priceBreakdown;
    currency;
    status;
    paymentStatus;
    paymentReference;
    paymentMethod;
    paidAt;
    guestNote;
    hostNote;
    isInstantBook;
    confirmedAt;
    expiresAt;
    cancellation;
    actualCheckIn;
    actualCheckOut;
    guestReviewLeft;
    hostReviewLeft;
    createdAt;
    updatedAt;
};
exports.Booking = Booking;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Property', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Booking.prototype, "propertyId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Room', index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Booking.prototype, "roomId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Booking.prototype, "guestId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Booking.prototype, "hostId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Date)
], Booking.prototype, "checkIn", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Date)
], Booking.prototype, "checkOut", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 1 }),
    __metadata("design:type", Number)
], Booking.prototype, "nights", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            adults: { type: Number, required: true, min: 1, default: 1 },
            children: { type: Number, default: 0 },
            infants: { type: Number, default: 0 },
        },
        required: true,
    }),
    __metadata("design:type", Object)
], Booking.prototype, "guests", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            pricePerNight: { type: Number, required: true },
            nights: { type: Number, required: true },
            subtotal: { type: Number, required: true },
            cleaningFee: { type: Number, default: 0 },
            serviceFee: { type: Number, default: 0 },
            taxAmount: { type: Number, default: 0 },
            discountAmount: { type: Number, default: 0 },
            totalAmount: { type: Number, required: true },
        },
        required: true,
    }),
    __metadata("design:type", Object)
], Booking.prototype, "priceBreakdown", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'XAF' }),
    __metadata("design:type", String)
], Booking.prototype, "currency", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: Object.values(BookingStatus),
        default: BookingStatus.PENDING,
        index: true,
    }),
    __metadata("design:type", String)
], Booking.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: Object.values(PaymentStatus),
        default: PaymentStatus.UNPAID,
    }),
    __metadata("design:type", String)
], Booking.prototype, "paymentStatus", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Booking.prototype, "paymentReference", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Booking.prototype, "paymentMethod", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Booking.prototype, "paidAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true, maxlength: 1000 }),
    __metadata("design:type", String)
], Booking.prototype, "guestNote", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true, maxlength: 1000 }),
    __metadata("design:type", String)
], Booking.prototype, "hostNote", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], Booking.prototype, "isInstantBook", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Booking.prototype, "confirmedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Booking.prototype, "expiresAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            cancelledBy: { type: String, enum: Object.values(CancelledBy) },
            cancelledAt: { type: Date },
            reason: { type: String },
            refundAmount: { type: Number },
            refundStatus: { type: String, enum: ['pending', 'processed', 'failed'] },
        },
        default: null,
    }),
    __metadata("design:type", Object)
], Booking.prototype, "cancellation", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Booking.prototype, "actualCheckIn", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Booking.prototype, "actualCheckOut", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], Booking.prototype, "guestReviewLeft", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], Booking.prototype, "hostReviewLeft", void 0);
exports.Booking = Booking = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Booking);
exports.BookingSchema = mongoose_1.SchemaFactory.createForClass(Booking);
exports.BookingSchema.index({ propertyId: 1, checkIn: 1, checkOut: 1 });
exports.BookingSchema.index({ roomId: 1, status: 1, checkIn: 1, checkOut: 1 });
exports.BookingSchema.index({ guestId: 1, status: 1, createdAt: -1 });
exports.BookingSchema.index({ hostId: 1, status: 1, createdAt: -1 });
exports.BookingSchema.index({ status: 1, paymentStatus: 1, createdAt: 1 });
exports.BookingSchema.index({ status: 1, expiresAt: 1 });
//# sourceMappingURL=booking.schema.js.map