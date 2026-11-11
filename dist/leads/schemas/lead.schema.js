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
exports.LeadSchema = exports.Lead = exports.LeadNoteSchema = exports.LeadNote = exports.LeadPriority = exports.LeadSource = exports.LeadStatus = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var LeadStatus;
(function (LeadStatus) {
    LeadStatus["NEW"] = "new";
    LeadStatus["CONTACTED"] = "contacted";
    LeadStatus["QUALIFIED"] = "qualified";
    LeadStatus["LOST"] = "lost";
})(LeadStatus || (exports.LeadStatus = LeadStatus = {}));
var LeadSource;
(function (LeadSource) {
    LeadSource["WEBSITE"] = "website";
    LeadSource["REFERRAL"] = "referral";
    LeadSource["MESSAGE"] = "message";
    LeadSource["CAMPAIGN"] = "campaign";
})(LeadSource || (exports.LeadSource = LeadSource = {}));
var LeadPriority;
(function (LeadPriority) {
    LeadPriority["LOW"] = "low";
    LeadPriority["MEDIUM"] = "medium";
    LeadPriority["HIGH"] = "high";
})(LeadPriority || (exports.LeadPriority = LeadPriority = {}));
let LeadNote = class LeadNote {
    _id;
    content;
    createdAt;
};
exports.LeadNote = LeadNote;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, default: () => new mongoose_2.Types.ObjectId() }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], LeadNote.prototype, "_id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], LeadNote.prototype, "content", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, default: Date.now }),
    __metadata("design:type", Date)
], LeadNote.prototype, "createdAt", void 0);
exports.LeadNote = LeadNote = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], LeadNote);
exports.LeadNoteSchema = mongoose_1.SchemaFactory.createForClass(LeadNote);
let Lead = class Lead {
    name;
    email;
    phone;
    interest;
    source;
    status;
    location;
    lastContactedAt;
    budget;
    propertyType;
    priority;
    assignedAgent;
    tags;
    notes;
};
exports.Lead = Lead;
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], Lead.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], Lead.prototype, "email", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], Lead.prototype, "phone", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], Lead.prototype, "interest", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: LeadSource, default: LeadSource.WEBSITE }),
    __metadata("design:type", String)
], Lead.prototype, "source", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: LeadStatus, default: LeadStatus.NEW }),
    __metadata("design:type", String)
], Lead.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], Lead.prototype, "location", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], Lead.prototype, "lastContactedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], Lead.prototype, "budget", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], Lead.prototype, "propertyType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: LeadPriority }),
    __metadata("design:type", String)
], Lead.prototype, "priority", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], Lead.prototype, "assignedAgent", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], Lead.prototype, "tags", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [exports.LeadNoteSchema], default: [] }),
    __metadata("design:type", Array)
], Lead.prototype, "notes", void 0);
exports.Lead = Lead = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Lead);
exports.LeadSchema = mongoose_1.SchemaFactory.createForClass(Lead);
exports.LeadSchema.index({ status: 1 });
exports.LeadSchema.index({ createdAt: -1 });
exports.LeadSchema.index({ priority: 1 });
exports.LeadSchema.index({ source: 1 });
//# sourceMappingURL=lead.schema.js.map