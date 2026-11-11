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
exports.AppointmentSchema = exports.Appointment = exports.AppointmentNoteSchema = exports.AppointmentNote = exports.AppointmentType = exports.AppointmentStatus = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var AppointmentStatus;
(function (AppointmentStatus) {
    AppointmentStatus["SCHEDULED"] = "scheduled";
    AppointmentStatus["RESCHEDULED"] = "rescheduled";
    AppointmentStatus["COMPLETED"] = "completed";
    AppointmentStatus["CANCELLED"] = "cancelled";
    AppointmentStatus["NO_SHOW"] = "no-show";
})(AppointmentStatus || (exports.AppointmentStatus = AppointmentStatus = {}));
var AppointmentType;
(function (AppointmentType) {
    AppointmentType["IN_PERSON"] = "in-person";
    AppointmentType["VIRTUAL"] = "virtual";
    AppointmentType["PHONE_CALL"] = "phone-call";
})(AppointmentType || (exports.AppointmentType = AppointmentType = {}));
let AppointmentNote = class AppointmentNote {
    _id;
    content;
    createdAt;
};
exports.AppointmentNote = AppointmentNote;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, default: () => new mongoose_2.Types.ObjectId() }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], AppointmentNote.prototype, "_id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], AppointmentNote.prototype, "content", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, default: Date.now }),
    __metadata("design:type", Date)
], AppointmentNote.prototype, "createdAt", void 0);
exports.AppointmentNote = AppointmentNote = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], AppointmentNote);
exports.AppointmentNoteSchema = mongoose_1.SchemaFactory.createForClass(AppointmentNote);
let Appointment = class Appointment {
    title;
    property;
    propertyId;
    agentId;
    clientName;
    clientEmail;
    clientPhone;
    clientId;
    type;
    location;
    description;
    date;
    duration;
    status;
    reminderSent;
    rescheduleHistory;
    notes;
    createdAt;
    updatedAt;
};
exports.Appointment = Appointment;
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], Appointment.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], Appointment.prototype, "property", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Property' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Appointment.prototype, "propertyId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Appointment.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], Appointment.prototype, "clientName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], Appointment.prototype, "clientEmail", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], Appointment.prototype, "clientPhone", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Appointment.prototype, "clientId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: AppointmentType, required: true }),
    __metadata("design:type", String)
], Appointment.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], Appointment.prototype, "location", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], Appointment.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, type: Date }),
    __metadata("design:type", Date)
], Appointment.prototype, "date", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], Appointment.prototype, "duration", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: AppointmentStatus, default: AppointmentStatus.SCHEDULED }),
    __metadata("design:type", String)
], Appointment.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: false }),
    __metadata("design:type", Boolean)
], Appointment.prototype, "reminderSent", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{ from: Date, to: Date, reason: String }], default: [] }),
    __metadata("design:type", Array)
], Appointment.prototype, "rescheduleHistory", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [exports.AppointmentNoteSchema], default: [] }),
    __metadata("design:type", Array)
], Appointment.prototype, "notes", void 0);
exports.Appointment = Appointment = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Appointment);
exports.AppointmentSchema = mongoose_1.SchemaFactory.createForClass(Appointment);
exports.AppointmentSchema.index({ agentId: 1, date: 1 });
exports.AppointmentSchema.index({ status: 1 });
exports.AppointmentSchema.index({ date: 1 });
exports.AppointmentSchema.index({ createdAt: -1 });
exports.AppointmentSchema.index({ clientName: 1 });
exports.AppointmentSchema.index({ propertyId: 1 });
//# sourceMappingURL=appointment.schema.js.map