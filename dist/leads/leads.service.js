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
exports.LeadsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const lead_schema_1 = require("./schemas/lead.schema");
let LeadsService = class LeadsService {
    leadModel;
    constructor(leadModel) {
        this.leadModel = leadModel;
    }
    async create(createLeadDto) {
        const createdLead = new this.leadModel(createLeadDto);
        return createdLead.save();
    }
    async findAll() {
        return this.leadModel.find().sort({ createdAt: -1 }).exec();
    }
    async findOne(id) {
        const lead = await this.leadModel.findById(id).exec();
        if (!lead) {
            throw new common_1.NotFoundException(`Lead #${id} not found`);
        }
        return lead;
    }
    async update(id, updateData) {
        const existingLead = await this.leadModel
            .findByIdAndUpdate(id, updateData, { new: true })
            .exec();
        if (!existingLead) {
            throw new common_1.NotFoundException(`Lead #${id} not found`);
        }
        return existingLead;
    }
    async remove(id) {
        const deletedLead = await this.leadModel.findByIdAndDelete(id).exec();
        if (!deletedLead) {
            throw new common_1.NotFoundException(`Lead #${id} not found`);
        }
        return deletedLead;
    }
    async addNote(id, content) {
        const lead = await this.leadModel.findByIdAndUpdate(id, { $push: { notes: { content, createdAt: new Date() } } }, { new: true }).exec();
        if (!lead) {
            throw new common_1.NotFoundException(`Lead #${id} not found`);
        }
        return lead;
    }
    async getStats() {
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const [total, newCount, contactedCount, qualifiedCount, lostCount, newThisWeek] = await Promise.all([
            this.leadModel.countDocuments().exec(),
            this.leadModel.countDocuments({ status: 'new' }).exec(),
            this.leadModel.countDocuments({ status: 'contacted' }).exec(),
            this.leadModel.countDocuments({ status: 'qualified' }).exec(),
            this.leadModel.countDocuments({ status: 'lost' }).exec(),
            this.leadModel.countDocuments({ createdAt: { $gte: oneWeekAgo } }).exec(),
        ]);
        return {
            total,
            new: newCount,
            contacted: contactedCount,
            qualified: qualifiedCount,
            lost: lostCount,
            newThisWeek,
            conversionRate: total > 0 ? Math.round((qualifiedCount / total) * 100) : 0,
        };
    }
};
exports.LeadsService = LeadsService;
exports.LeadsService = LeadsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(lead_schema_1.Lead.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], LeadsService);
//# sourceMappingURL=leads.service.js.map