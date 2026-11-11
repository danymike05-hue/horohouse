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
var StudentPropertiesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentPropertiesService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const property_schema_1 = require("../properties/schemas/property.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const notifications_service_1 = require("../notifications/notifications.service");
const notification_schema_1 = require("../notifications/schemas/notification.schema");
let StudentPropertiesService = StudentPropertiesService_1 = class StudentPropertiesService {
    propertyModel;
    userModel;
    notificationsService;
    logger = new common_1.Logger(StudentPropertiesService_1.name);
    constructor(propertyModel, userModel, notificationsService) {
        this.propertyModel = propertyModel;
        this.userModel = userModel;
        this.notificationsService = notificationsService;
    }
    async searchStudentProperties(dto) {
        const { page = 1, limit = 20, sortBy = 'campusProximityMeters', sortOrder = 'asc', } = dto;
        const skip = (page - 1) * limit;
        const filter = {
            isStudentFriendly: true,
            isActive: true,
            approvalStatus: property_schema_1.ApprovalStatus.APPROVED,
            availability: property_schema_1.PropertyStatus.ACTIVE,
        };
        if (dto.city) {
            filter.city = { $regex: dto.city, $options: 'i' };
        }
        if (dto.neighborhood) {
            filter.neighborhood = { $regex: dto.neighborhood, $options: 'i' };
        }
        if (dto.nearestCampus) {
            filter['studentDetails.nearestCampus'] = {
                $regex: dto.nearestCampus,
                $options: 'i',
            };
        }
        if (dto.maxCampusProximityMeters !== undefined) {
            filter['studentDetails.campusProximityMeters'] = {
                $lte: dto.maxCampusProximityMeters,
            };
        }
        if (dto.minPricePerPerson !== undefined || dto.maxPricePerPerson !== undefined) {
            filter['studentDetails.pricePerPersonMonthly'] = {};
            if (dto.minPricePerPerson !== undefined) {
                filter['studentDetails.pricePerPersonMonthly'].$gte = dto.minPricePerPerson;
            }
            if (dto.maxPricePerPerson !== undefined) {
                filter['studentDetails.pricePerPersonMonthly'].$lte = dto.maxPricePerPerson;
            }
        }
        if (dto.waterSource) {
            filter['studentDetails.waterSource'] = dto.waterSource;
        }
        if (dto.electricityBackup) {
            filter['studentDetails.electricityBackup'] = dto.electricityBackup;
        }
        if (dto.furnishingStatus) {
            filter['studentDetails.furnishingStatus'] = dto.furnishingStatus;
        }
        if (dto.genderRestriction) {
            filter['studentDetails.genderRestriction'] = dto.genderRestriction;
        }
        if (dto.noCurfew === true) {
            filter['studentDetails.curfewTime'] = { $in: [null, ''] };
        }
        if (dto.visitorsAllowed === true) {
            filter['studentDetails.visitorsAllowed'] = true;
        }
        if (dto.hasGatedCompound === true) {
            filter['studentDetails.hasGatedCompound'] = true;
        }
        if (dto.hasNightWatchman === true) {
            filter['studentDetails.hasNightWatchman'] = true;
        }
        if (dto.studentApprovedOnly === true) {
            filter['studentDetails.isStudentApproved'] = true;
        }
        if (dto.acceptsRentAdvanceScheme === true) {
            filter['studentDetails.acceptsRentAdvanceScheme'] = true;
        }
        if (dto.maxAdvanceMonths !== undefined) {
            filter['studentDetails.maxAdvanceMonths'] = { $lte: dto.maxAdvanceMonths };
        }
        if (dto.hasAvailableBeds === true) {
            filter['studentDetails.availableBeds'] = { $gt: 0 };
        }
        if (dto.minAvailableBeds !== undefined) {
            filter['studentDetails.availableBeds'] = { $gte: dto.minAvailableBeds };
        }
        const sortKeyMap = {
            campusProximityMeters: 'studentDetails.campusProximityMeters',
            pricePerPersonMonthly: 'studentDetails.pricePerPersonMonthly',
            price: 'price',
            createdAt: 'createdAt',
        };
        const mongoSortKey = sortKeyMap[sortBy] ?? 'createdAt';
        const sort = { [mongoSortKey]: sortOrder === 'asc' ? 1 : -1 };
        sort['studentDetails.isStudentApproved'] = -1;
        const [properties, total] = await Promise.all([
            this.propertyModel
                .find(filter)
                .populate('ownerId', 'name phoneNumber profilePicture averageRating')
                .populate('agentId', 'name phoneNumber profilePicture agency')
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .exec(),
            this.propertyModel.countDocuments(filter),
        ]);
        this.logger.log(`Student property search: ${total} results (city: ${dto.city ?? 'any'})`);
        return { properties, total, page, totalPages: Math.ceil(total / limit) };
    }
    async markAsStudentFriendly(propertyId, requestingUser, dto) {
        if (!mongoose_2.Types.ObjectId.isValid(propertyId)) {
            throw new common_1.BadRequestException('Invalid property ID');
        }
        const property = await this.propertyModel.findById(propertyId).exec();
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        const isOwner = property.ownerId.toString() === requestingUser._id.toString();
        const isAgent = property.agentId?.toString() === requestingUser._id.toString();
        const isAdmin = requestingUser.role === user_schema_1.UserRole.ADMIN;
        if (!isOwner && !isAgent && !isAdmin) {
            throw new common_1.ForbiddenException('You can only update student details for your own listings.');
        }
        const updated = await this.propertyModel
            .findByIdAndUpdate(propertyId, {
            $set: {
                isStudentFriendly: true,
                studentDetails: {
                    campusProximityMeters: dto.campusProximityMeters,
                    nearestCampus: dto.nearestCampus,
                    walkingMinutes: dto.walkingMinutes,
                    taxiMinutes: dto.taxiMinutes,
                    waterSource: dto.waterSource,
                    electricityBackup: dto.electricityBackup,
                    furnishingStatus: dto.furnishingStatus,
                    genderRestriction: dto.genderRestriction,
                    curfewTime: dto.curfewTime,
                    visitorsAllowed: dto.visitorsAllowed,
                    cookingAllowed: dto.cookingAllowed,
                    hasGatedCompound: dto.hasGatedCompound,
                    hasNightWatchman: dto.hasNightWatchman,
                    hasFence: dto.hasFence,
                    maxAdvanceMonths: dto.maxAdvanceMonths,
                    acceptsRentAdvanceScheme: dto.acceptsRentAdvanceScheme ?? false,
                    availableBeds: dto.availableBeds,
                    totalBeds: dto.totalBeds,
                    pricePerPersonMonthly: dto.pricePerPersonMonthly,
                    isStudentApproved: property.studentDetails?.isStudentApproved ?? false,
                },
            },
        }, { new: true })
            .exec();
        this.logger.log(`✅ Property ${propertyId} marked as student-friendly`);
        return updated;
    }
    async removeStudentFriendly(propertyId, requestingUser) {
        if (!mongoose_2.Types.ObjectId.isValid(propertyId)) {
            throw new common_1.BadRequestException('Invalid property ID');
        }
        const property = await this.propertyModel.findById(propertyId).exec();
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        const isOwner = property.ownerId.toString() === requestingUser._id.toString();
        const isAgent = property.agentId?.toString() === requestingUser._id.toString();
        const isAdmin = requestingUser.role === user_schema_1.UserRole.ADMIN;
        if (!isOwner && !isAgent && !isAdmin) {
            throw new common_1.ForbiddenException('You can only update your own listings.');
        }
        const updated = await this.propertyModel
            .findByIdAndUpdate(propertyId, { $set: { isStudentFriendly: false, studentDetails: null } }, { new: true })
            .exec();
        this.logger.log(`Property ${propertyId} removed from student programme`);
        return updated;
    }
    async grantStudentApproved(propertyId, adminId) {
        if (!mongoose_2.Types.ObjectId.isValid(propertyId)) {
            throw new common_1.BadRequestException('Invalid property ID');
        }
        const property = await this.propertyModel.findById(propertyId).exec();
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        if (!property.isStudentFriendly) {
            throw new common_1.BadRequestException('Property must be marked as student-friendly before receiving the Student-Approved badge.');
        }
        const updated = await this.propertyModel
            .findByIdAndUpdate(propertyId, { $set: { 'studentDetails.isStudentApproved': true } }, { new: true })
            .exec();
        this.notificationsService.create({
            userId: property.ownerId.toString(),
            type: notification_schema_1.NotificationType.PROPERTY_UPDATE,
            title: 'Student-Approved badge awarded!',
            message: `Your property "${property.title}" has been awarded the Student-Approved badge and will rank higher in student housing searches.`,
            metadata: { propertyId, action: 'student_approved_granted' },
        }).catch((err) => this.logger.warn(`Notification failed: ${err.message}`));
        this.logger.log(`✅ Student-Approved badge granted to property ${propertyId} by admin ${adminId}`);
        return updated;
    }
    async revokeStudentApproved(propertyId, adminId) {
        if (!mongoose_2.Types.ObjectId.isValid(propertyId)) {
            throw new common_1.BadRequestException('Invalid property ID');
        }
        const property = await this.propertyModel.findById(propertyId).exec();
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        const updated = await this.propertyModel
            .findByIdAndUpdate(propertyId, { $set: { 'studentDetails.isStudentApproved': false } }, { new: true })
            .exec();
        this.logger.log(`Student-Approved badge revoked from property ${propertyId} by admin ${adminId}`);
        return updated;
    }
    async getStudentPropertyStats() {
        const baseFilter = {
            isStudentFriendly: true,
            isActive: true,
            approvalStatus: property_schema_1.ApprovalStatus.APPROVED,
        };
        const [total, studentApproved, byCityAgg, waterAgg, electricityAgg, withBeds] = await Promise.all([
            this.propertyModel.countDocuments(baseFilter),
            this.propertyModel.countDocuments({
                ...baseFilter,
                'studentDetails.isStudentApproved': true,
            }),
            this.propertyModel.aggregate([
                { $match: baseFilter },
                { $group: { _id: '$city', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
                { $project: { _id: 0, city: '$_id', count: 1 } },
            ]),
            this.propertyModel.aggregate([
                { $match: { ...baseFilter, 'studentDetails.waterSource': { $exists: true } } },
                { $group: { _id: '$studentDetails.waterSource', count: { $sum: 1 } } },
            ]),
            this.propertyModel.aggregate([
                { $match: { ...baseFilter, 'studentDetails.electricityBackup': { $exists: true } } },
                { $group: { _id: '$studentDetails.electricityBackup', count: { $sum: 1 } } },
            ]),
            this.propertyModel.countDocuments({
                ...baseFilter,
                'studentDetails.availableBeds': { $gt: 0 },
            }),
        ]);
        return {
            total,
            studentApproved,
            byCity: byCityAgg,
            byWaterSource: waterAgg.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
            byElectricityBackup: electricityAgg.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
            withAvailableBeds: withBeds,
        };
    }
};
exports.StudentPropertiesService = StudentPropertiesService;
exports.StudentPropertiesService = StudentPropertiesService = StudentPropertiesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(property_schema_1.Property.name)),
    __param(1, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        notifications_service_1.NotificationsService])
], StudentPropertiesService);
//# sourceMappingURL=student-properties.service.js.map