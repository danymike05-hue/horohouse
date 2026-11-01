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
var SavedSearchesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SavedSearchesService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const schedule_1 = require("@nestjs/schedule");
const saved_search_schema_1 = require("./schemas/saved-search.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const property_schema_1 = require("../properties/schemas/property.schema");
const email_service_1 = require("../email/email.service");
let SavedSearchesService = SavedSearchesService_1 = class SavedSearchesService {
    savedSearchModel;
    userModel;
    propertyModel;
    emailService;
    logger = new common_1.Logger(SavedSearchesService_1.name);
    constructor(savedSearchModel, userModel, propertyModel, emailService) {
        this.savedSearchModel = savedSearchModel;
        this.userModel = userModel;
        this.propertyModel = propertyModel;
        this.emailService = emailService;
    }
    async create(createDto, userId) {
        try {
            const user = await this.userModel.findById(userId);
            if (!user) {
                throw new common_1.NotFoundException('User not found');
            }
            const existingSearches = await this.savedSearchModel.countDocuments({ userId: new mongoose_2.Types.ObjectId(userId) });
            if (existingSearches >= 10) {
                throw new common_1.BadRequestException('Maximum number of saved searches (10) reached. Please delete an existing search to create a new one.');
            }
            const resultsCount = await this.getMatchingPropertiesCount(createDto.searchCriteria);
            const savedSearch = new this.savedSearchModel({
                ...createDto,
                userId: new mongoose_2.Types.ObjectId(userId),
                resultsCount,
                lastChecked: new Date(),
            });
            const saved = await savedSearch.save();
            this.logger.log(`Saved search created: ${saved._id} by user ${userId}`);
            if (createDto.isActive && createDto.notificationFrequency !== saved_search_schema_1.SearchFrequency.NEVER) {
                this.performImmediateCheck(saved, user).catch(err => this.logger.error(`Error in immediate check for search ${saved._id}:`, err));
            }
            return saved;
        }
        catch (error) {
            this.logger.error('Error creating saved search:', error);
            throw error;
        }
    }
    async performImmediateCheck(search, user) {
        try {
            this.logger.log(`🔍 Performing immediate check for search: ${search._id}`);
            if (!user.email) {
                this.logger.warn(`Cannot send notification for search ${search._id}: User has no email`);
                return;
            }
            const query = this.buildPropertyQuery(search.searchCriteria);
            const matchingProperties = await this.propertyModel
                .find(query)
                .sort({ createdAt: -1 })
                .limit(10)
                .exec();
            if (matchingProperties.length > 0) {
                this.logger.log(`✅ Found ${matchingProperties.length} matching properties for search ${search._id}`);
                if (search.notificationFrequency === saved_search_schema_1.SearchFrequency.INSTANT) {
                    await this.emailService.sendSavedSearchNotification(user.email, user.name || 'there', search.name, matchingProperties.slice(0, 5), search._id.toString());
                    await this.savedSearchModel.findByIdAndUpdate(search._id, {
                        lastNotificationSent: new Date(),
                    });
                    this.logger.log(`📧 Sent immediate notification for search ${search._id}`);
                }
                else {
                    const propertyIds = matchingProperties.map(p => p._id);
                    await this.savedSearchModel.findByIdAndUpdate(search._id, {
                        $addToSet: { newMatchingProperties: { $each: propertyIds } },
                    });
                    this.logger.log(`📝 Marked ${propertyIds.length} properties as new matches for ${search.notificationFrequency} notification`);
                }
            }
            else {
                this.logger.log(`ℹ️ No matching properties found for search ${search._id}`);
            }
        }
        catch (error) {
            this.logger.error(`❌ Error in immediate check for search ${search._id}:`, error);
            throw error;
        }
    }
    async findAllByUser(userId) {
        try {
            const searches = await this.savedSearchModel
                .find({ userId: new mongoose_2.Types.ObjectId(userId) })
                .sort({ createdAt: -1 })
                .exec();
            this.logger.log(`Retrieved ${searches.length} saved searches for user ${userId}`);
            return searches;
        }
        catch (error) {
            this.logger.error(`Error finding saved searches for user ${userId}:`, error);
            throw error;
        }
    }
    async findOne(id, userId) {
        try {
            if (!mongoose_2.Types.ObjectId.isValid(id)) {
                throw new common_1.BadRequestException('Invalid saved search ID');
            }
            const savedSearch = await this.savedSearchModel.findById(id).exec();
            if (!savedSearch) {
                throw new common_1.NotFoundException('Saved search not found');
            }
            if (savedSearch.userId.toString() !== userId) {
                throw new common_1.ForbiddenException('You can only access your own saved searches');
            }
            return savedSearch;
        }
        catch (error) {
            this.logger.error(`Error finding saved search ${id}:`, error);
            throw error;
        }
    }
    async update(id, updateDto, userId) {
        try {
            const savedSearch = await this.findOne(id, userId);
            if (updateDto.searchCriteria) {
                const resultsCount = await this.getMatchingPropertiesCount(updateDto.searchCriteria);
                updateDto['resultsCount'] = resultsCount;
            }
            const updated = await this.savedSearchModel
                .findByIdAndUpdate(id, { ...updateDto, lastChecked: new Date() }, { new: true })
                .exec();
            if (!updated) {
                throw new common_1.NotFoundException('Saved search not found after update');
            }
            this.logger.log(`Saved search updated: ${id} by user ${userId}`);
            return updated;
        }
        catch (error) {
            this.logger.error(`Error updating saved search ${id}:`, error);
            throw error;
        }
    }
    async remove(id, userId) {
        try {
            const savedSearch = await this.findOne(id, userId);
            await this.savedSearchModel.findByIdAndDelete(id).exec();
            this.logger.log(`Saved search deleted: ${id} by user ${userId}`);
        }
        catch (error) {
            this.logger.error(`Error deleting saved search ${id}:`, error);
            throw error;
        }
    }
    async getMatchingProperties(id, userId, page = 1, limit = 20) {
        try {
            const savedSearch = await this.findOne(id, userId);
            const skip = (page - 1) * limit;
            const query = this.buildPropertyQuery(savedSearch.searchCriteria);
            this.logger.log(`🔍 Query for search ${id}: ${JSON.stringify(query)}`);
            const [properties, total] = await Promise.all([
                this.propertyModel
                    .find(query)
                    .populate('ownerId', 'name email phoneNumber profilePicture')
                    .populate('agentId', 'name email phoneNumber profilePicture agency')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .exec(),
                this.propertyModel.countDocuments(query),
            ]);
            this.logger.log(`✅ Found ${properties.length} properties out of ${total} total for search ${id}`);
            await this.savedSearchModel.findByIdAndUpdate(id, {
                resultsCount: total,
                lastChecked: new Date(),
                newMatchingProperties: [],
            });
            const result = {
                properties,
                total,
                page,
                totalPages: Math.ceil(total / limit),
            };
            this.logger.log(`📦 Returning result: ${JSON.stringify({ propertiesCount: properties.length, total, page, totalPages: result.totalPages })}`);
            return result;
        }
        catch (error) {
            this.logger.error(`Error getting matching properties for saved search ${id}:`, error);
            throw error;
        }
    }
    async checkForNewMatches() {
        try {
            this.logger.log('🔔 CRON: Starting new property matches check...');
            const activeSearches = await this.savedSearchModel
                .find({
                isActive: true,
                notificationFrequency: { $ne: saved_search_schema_1.SearchFrequency.NEVER }
            })
                .exec();
            this.logger.log(`Found ${activeSearches.length} active searches to check`);
            for (const search of activeSearches) {
                await this.updateNewMatches(search);
            }
            this.logger.log(`✅ CRON: Completed checking ${activeSearches.length} saved searches for new matches`);
        }
        catch (error) {
            this.logger.error('❌ CRON: Error checking for new matches:', error);
        }
    }
    async sendDailyNotifications() {
        this.logger.log('🔔 CRON: Sending daily notifications...');
        await this.sendNotifications(saved_search_schema_1.SearchFrequency.DAILY);
    }
    async sendInstantNotifications() {
        this.logger.log('🔔 CRON: Sending instant notifications...');
        await this.sendNotifications(saved_search_schema_1.SearchFrequency.INSTANT);
    }
    async sendWeeklyNotifications() {
        this.logger.log('🔔 CRON: Sending weekly notifications...');
        await this.sendNotifications(saved_search_schema_1.SearchFrequency.WEEKLY);
    }
    async sendNotifications(frequency) {
        try {
            const searches = await this.savedSearchModel
                .find({
                isActive: true,
                notificationFrequency: frequency,
                newMatchingProperties: { $exists: true, $ne: [] },
            })
                .populate('userId', 'email name')
                .exec();
            this.logger.log(`Found ${searches.length} searches with new matches for ${frequency} notifications`);
            for (const search of searches) {
                try {
                    const user = search.userId;
                    if (!user || !user.email) {
                        this.logger.warn(`Skipping search ${search._id}: User not found or no email`);
                        continue;
                    }
                    const newProperties = await this.propertyModel
                        .find({ _id: { $in: search.newMatchingProperties } })
                        .limit(5)
                        .exec();
                    if (newProperties.length > 0) {
                        await this.emailService.sendSavedSearchNotification(user.email, user.name || 'there', search.name, newProperties, search._id.toString());
                        await this.savedSearchModel.findByIdAndUpdate(search._id, {
                            lastNotificationSent: new Date(),
                            newMatchingProperties: [],
                        });
                        this.logger.log(`📧 Sent notification for search ${search._id} to ${user.email}`);
                    }
                }
                catch (error) {
                    this.logger.error(`Error sending notification for search ${search._id}:`, error);
                }
            }
            this.logger.log(`✅ Completed sending ${frequency} notifications for ${searches.length} searches`);
        }
        catch (error) {
            this.logger.error(`Error sending ${frequency} notifications:`, error);
        }
    }
    async updateNewMatches(search) {
        try {
            const lastChecked = search.lastChecked || search.createdAt;
            const query = {
                ...this.buildPropertyQuery(search.searchCriteria),
                createdAt: { $gt: lastChecked },
            };
            const newProperties = await this.propertyModel
                .find(query)
                .select('_id')
                .limit(100)
                .exec();
            if (newProperties.length > 0) {
                const newPropertyIds = newProperties.map(p => p._id);
                await this.savedSearchModel.findByIdAndUpdate(search._id, {
                    $addToSet: { newMatchingProperties: { $each: newPropertyIds } },
                    lastChecked: new Date(),
                });
                this.logger.log(`Found ${newProperties.length} new matches for search ${search._id}`);
            }
            else {
                await this.savedSearchModel.findByIdAndUpdate(search._id, {
                    lastChecked: new Date(),
                });
            }
        }
        catch (error) {
            this.logger.error(`Error updating new matches for search ${search._id}:`, error);
        }
    }
    async getMatchingPropertiesCount(searchCriteria) {
        try {
            const query = this.buildPropertyQuery(searchCriteria);
            return await this.propertyModel.countDocuments(query);
        }
        catch (error) {
            this.logger.error('Error getting matching properties count:', error);
            return 0;
        }
    }
    buildPropertyQuery(criteria) {
        const query = {
            isActive: true,
            availability: 'active',
        };
        if (criteria.minPrice !== undefined && criteria.minPrice !== null) {
            query.price = query.price || {};
            query.price.$gte = criteria.minPrice;
        }
        if (criteria.maxPrice !== undefined && criteria.maxPrice !== null) {
            query.price = query.price || {};
            query.price.$lte = criteria.maxPrice;
        }
        if (criteria.propertyType) {
            query.type = criteria.propertyType;
        }
        if (criteria.listingType) {
            query.listingType = criteria.listingType;
        }
        if (criteria.city) {
            query.city = { $regex: criteria.city, $options: 'i' };
        }
        if (criteria.state) {
            query.state = { $regex: criteria.state, $options: 'i' };
        }
        if (criteria.bedrooms) {
            query['amenities.bedrooms'] = { $gte: criteria.bedrooms };
        }
        if (criteria.bathrooms) {
            query['amenities.bathrooms'] = { $gte: criteria.bathrooms };
        }
        if (criteria.amenities && criteria.amenities.length > 0) {
            const amenityQueries = criteria.amenities.map((amenity) => ({
                [`amenities.${amenity}`]: true,
            }));
            query.$and = amenityQueries;
        }
        if (criteria.latitude && criteria.longitude && criteria.radius) {
            query.location = {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [criteria.longitude, criteria.latitude],
                    },
                    $maxDistance: criteria.radius * 1000,
                },
            };
        }
        return query;
    }
    async getStatistics(userId) {
        try {
            const searches = await this.savedSearchModel
                .find({ userId: new mongoose_2.Types.ObjectId(userId) })
                .exec();
            const statistics = {
                totalSearches: searches.length,
                activeSearches: searches.filter(s => s.isActive).length,
                totalNewMatches: searches.reduce((sum, s) => sum + (s.newMatchingProperties?.length || 0), 0),
                byFrequency: {
                    instant: searches.filter(s => s.notificationFrequency === saved_search_schema_1.SearchFrequency.INSTANT).length,
                    daily: searches.filter(s => s.notificationFrequency === saved_search_schema_1.SearchFrequency.DAILY).length,
                    weekly: searches.filter(s => s.notificationFrequency === saved_search_schema_1.SearchFrequency.WEEKLY).length,
                    never: searches.filter(s => s.notificationFrequency === saved_search_schema_1.SearchFrequency.NEVER).length,
                },
                totalResults: searches.reduce((sum, s) => sum + (s.resultsCount || 0), 0),
            };
            return statistics;
        }
        catch (error) {
            this.logger.error(`Error getting statistics for user ${userId}:`, error);
            throw error;
        }
    }
    async triggerManualCheck(userId) {
        try {
            this.logger.log(`🧪 Manual trigger: Checking searches for user ${userId}`);
            const searches = await this.savedSearchModel
                .find({
                userId: new mongoose_2.Types.ObjectId(userId),
                isActive: true
            })
                .exec();
            const results = [];
            for (const search of searches) {
                await this.updateNewMatches(search);
                const updated = await this.savedSearchModel.findById(search._id);
                if (updated) {
                    results.push({
                        searchId: search._id,
                        name: search.name,
                        newMatches: updated.newMatchingProperties?.length || 0,
                        resultsCount: updated.resultsCount || 0
                    });
                }
            }
            this.logger.log(`✅ Manual check completed for ${results.length} searches`);
            return results;
        }
        catch (error) {
            this.logger.error(`Error in manual check for user ${userId}:`, error);
            throw error;
        }
    }
};
exports.SavedSearchesService = SavedSearchesService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SavedSearchesService.prototype, "checkForNewMatches", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_9AM),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SavedSearchesService.prototype, "sendDailyNotifications", null);
__decorate([
    (0, schedule_1.Cron)('*/15 * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SavedSearchesService.prototype, "sendInstantNotifications", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_WEEK),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SavedSearchesService.prototype, "sendWeeklyNotifications", null);
exports.SavedSearchesService = SavedSearchesService = SavedSearchesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(saved_search_schema_1.SavedSearch.name)),
    __param(1, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __param(2, (0, mongoose_1.InjectModel)(property_schema_1.Property.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        email_service_1.EmailService])
], SavedSearchesService);
//# sourceMappingURL=saved-searches.service.js.map