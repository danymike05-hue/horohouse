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
var ComparisonService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComparisonService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const crypto_1 = require("crypto");
const comparison_schema_1 = require("./schemas/comparison.schema");
const property_schema_1 = require("./schemas/property.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const history_service_1 = require("../history/history.service");
const history_schema_1 = require("../history/schemas/history.schema");
let ComparisonService = ComparisonService_1 = class ComparisonService {
    comparisonModel;
    propertyModel;
    userModel;
    historyService;
    logger = new common_1.Logger(ComparisonService_1.name);
    constructor(comparisonModel, propertyModel, userModel, historyService) {
        this.comparisonModel = comparisonModel;
        this.propertyModel = propertyModel;
        this.userModel = userModel;
        this.historyService = historyService;
    }
    async create(createComparisonDto, user) {
        const { name, propertyIds, isPublic = false } = createComparisonDto;
        if (!propertyIds || propertyIds.length === 0 || propertyIds.length > 3) {
            throw new common_1.BadRequestException('You can compare 1-3 properties');
        }
        const properties = await this.propertyModel.find({
            _id: { $in: propertyIds.map(id => new mongoose_2.Types.ObjectId(id)) }
        });
        if (properties.length !== propertyIds.length) {
            throw new common_1.BadRequestException('One or more properties not found');
        }
        const comparison = new this.comparisonModel({
            userId: user._id,
            name,
            propertyIds: propertyIds.map(id => new mongoose_2.Types.ObjectId(id)),
            isPublic,
            shareToken: (0, crypto_1.randomUUID)(),
        });
        const savedComparison = await comparison.save();
        await this.historyService.logActivity({
            userId: user._id,
            activityType: history_schema_1.ActivityType.PROPERTY_SEARCH,
            metadata: {
                comparisonId: savedComparison._id,
                propertyIds,
                comparisonName: name,
            },
        });
        this.logger.log(`Comparison created: ${savedComparison._id} by user ${user._id}`);
        return savedComparison.populate('propertyIds');
    }
    async findAll(user) {
        return this.comparisonModel
            .find({ userId: user._id })
            .populate('propertyIds', 'title price type images location')
            .sort({ createdAt: -1 })
            .exec();
    }
    async findOne(id, user) {
        const comparison = await this.comparisonModel
            .findById(id)
            .populate('propertyIds')
            .populate('userId', 'name');
        if (!comparison) {
            throw new common_1.NotFoundException('Comparison not found');
        }
        const canAccess = !user ||
            comparison.isPublic ||
            comparison.userId.toString() === user._id.toString() ||
            user.role === user_schema_1.UserRole.ADMIN;
        if (!canAccess) {
            throw new common_1.ForbiddenException('Access denied');
        }
        comparison.viewsCount += 1;
        await comparison.save();
        return comparison;
    }
    async findByShareToken(shareToken) {
        const comparison = await this.comparisonModel
            .findOne({ shareToken })
            .populate('propertyIds', 'title price type images location amenities')
            .populate('userId', 'name profilePicture');
        if (!comparison) {
            throw new common_1.NotFoundException('Comparison not found');
        }
        await this.comparisonModel.findByIdAndUpdate(comparison._id, { $inc: { shareViewsCount: 1 } });
        this.logger.log(`Comparison accessed via share token: ${comparison._id}`);
        return comparison;
    }
    async update(id, updateComparisonDto, user) {
        const comparison = await this.comparisonModel.findById(id);
        if (!comparison) {
            throw new common_1.NotFoundException('Comparison not found');
        }
        const canUpdate = comparison.userId.toString() === user._id.toString() ||
            user.role === user_schema_1.UserRole.ADMIN;
        if (!canUpdate) {
            throw new common_1.ForbiddenException('Access denied');
        }
        if (updateComparisonDto.propertyIds) {
            if (updateComparisonDto.propertyIds.length === 0 || updateComparisonDto.propertyIds.length > 3) {
                throw new common_1.BadRequestException('You can compare 1-3 properties');
            }
            const properties = await this.propertyModel.find({
                _id: { $in: updateComparisonDto.propertyIds.map(id => new mongoose_2.Types.ObjectId(id)) }
            });
            if (properties.length !== updateComparisonDto.propertyIds.length) {
                throw new common_1.BadRequestException('One or more properties not found');
            }
            updateComparisonDto.propertyIds = updateComparisonDto.propertyIds.map(id => new mongoose_2.Types.ObjectId(id));
        }
        Object.assign(comparison, updateComparisonDto);
        const updatedComparison = await comparison.save();
        return updatedComparison.populate('propertyIds');
    }
    async remove(id, user) {
        const comparison = await this.comparisonModel.findById(id);
        if (!comparison) {
            throw new common_1.NotFoundException('Comparison not found');
        }
        const canDelete = comparison.userId.toString() === user._id.toString() ||
            user.role === user_schema_1.UserRole.ADMIN;
        if (!canDelete) {
            throw new common_1.ForbiddenException('Access denied');
        }
        await this.comparisonModel.findByIdAndDelete(id);
    }
    async getPublicComparisons(limit = 10) {
        return this.comparisonModel
            .find({ isPublic: true })
            .populate('propertyIds', 'title price type images location')
            .populate('userId', 'name')
            .sort({ viewsCount: -1, createdAt: -1 })
            .limit(limit)
            .exec();
    }
    async generateShareUrl(id, user) {
        const comparison = await this.comparisonModel.findById(id);
        if (!comparison) {
            throw new common_1.NotFoundException('Comparison not found');
        }
        const canShare = comparison.userId.toString() === user._id.toString() ||
            user.role === user_schema_1.UserRole.ADMIN;
        if (!canShare) {
            throw new common_1.ForbiddenException('Access denied');
        }
        if (!comparison.shareToken) {
            comparison.shareToken = (0, crypto_1.randomUUID)();
            await comparison.save();
        }
        const shareUrl = `${process.env.FRONTEND_URL}/properties/compare?share=${comparison.shareToken}`;
        return {
            shareUrl,
            shareToken: comparison.shareToken,
        };
    }
};
exports.ComparisonService = ComparisonService;
exports.ComparisonService = ComparisonService = ComparisonService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(comparison_schema_1.Comparison.name)),
    __param(1, (0, mongoose_1.InjectModel)(property_schema_1.Property.name)),
    __param(2, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        history_service_1.HistoryService])
], ComparisonService);
//# sourceMappingURL=comparison.service.js.map