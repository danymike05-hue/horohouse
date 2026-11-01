import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';

import { SavedSearch, SavedSearchDocument, SearchFrequency } from './schemas/saved-search.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import { EmailService } from '../email/email.service';
import { CreateSavedSearchDto, UpdateSavedSearchDto } from './dto/saved-search.dto';

@Injectable()
export class SavedSearchesService {
  private readonly logger = new Logger(SavedSearchesService.name);

  constructor(
    @InjectModel(SavedSearch.name) private savedSearchModel: Model<SavedSearchDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
    private emailService: EmailService,
  ) {}

  /**
   * Create a new saved search with immediate check
   */
  async create(createDto: CreateSavedSearchDto, userId: string): Promise<SavedSearch> {
    try {
      // Check if user exists
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Limit number of saved searches per user (e.g., 10)
      const existingSearches = await this.savedSearchModel.countDocuments({ userId: new Types.ObjectId(userId) });
      if (existingSearches >= 10) {
        throw new BadRequestException('Maximum number of saved searches (10) reached. Please delete an existing search to create a new one.');
      }

      // Get initial results count
      const resultsCount = await this.getMatchingPropertiesCount(createDto.searchCriteria);

      const savedSearch = new this.savedSearchModel({
        ...createDto,
        userId: new Types.ObjectId(userId),
        resultsCount,
        lastChecked: new Date(),
      });

      const saved = await savedSearch.save();
      this.logger.log(`Saved search created: ${saved._id} by user ${userId}`);

      // 🆕 Immediately check for matches and send welcome notification if instant
      if (createDto.isActive && createDto.notificationFrequency !== SearchFrequency.NEVER) {
        // Run the check in the background
        this.performImmediateCheck(saved, user).catch(err => 
          this.logger.error(`Error in immediate check for search ${saved._id}:`, err)
        );
      }

      return saved;
    } catch (error) {
      this.logger.error('Error creating saved search:', error);
      throw error;
    }
  }

  /**
   * 🆕 Perform immediate check after saving a search
   */
  private async performImmediateCheck(search: SavedSearchDocument, user: UserDocument): Promise<void> {
    try {
      this.logger.log(`🔍 Performing immediate check for search: ${search._id}`);

      // Verify user has email
      if (!user.email) {
        this.logger.warn(`Cannot send notification for search ${search._id}: User has no email`);
        return;
      }

      // Get matching properties
      const query = this.buildPropertyQuery(search.searchCriteria);
      const matchingProperties = await this.propertyModel
        .find(query)
        .sort({ createdAt: -1 })
        .limit(10) // Get top 10 for initial notification
        .exec();

      if (matchingProperties.length > 0) {
        this.logger.log(`✅ Found ${matchingProperties.length} matching properties for search ${search._id}`);

        // For instant notifications, send immediately
        if (search.notificationFrequency === SearchFrequency.INSTANT) {
          await this.emailService.sendSavedSearchNotification(
            user.email,
            user.name || 'there',
            search.name,
            matchingProperties.slice(0, 5), // Show top 5 in email
            (search._id as Types.ObjectId).toString()
          );

          // Update last notification sent
          await this.savedSearchModel.findByIdAndUpdate(search._id, {
            lastNotificationSent: new Date(),
          });

          this.logger.log(`📧 Sent immediate notification for search ${search._id}`);
        } else {
          // For daily/weekly, just mark the properties as new matches
          const propertyIds = matchingProperties.map(p => p._id);
          await this.savedSearchModel.findByIdAndUpdate(search._id, {
            $addToSet: { newMatchingProperties: { $each: propertyIds } },
          });

          this.logger.log(`📝 Marked ${propertyIds.length} properties as new matches for ${search.notificationFrequency} notification`);
        }
      } else {
        this.logger.log(`ℹ️ No matching properties found for search ${search._id}`);
      }
    } catch (error) {
      this.logger.error(`❌ Error in immediate check for search ${search._id}:`, error);
      throw error;
    }
  }

  /**
   * Get all saved searches for a user
   */
  async findAllByUser(userId: string): Promise<SavedSearch[]> {
    try {
      const searches = await this.savedSearchModel
        .find({ userId: new Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .exec();

      this.logger.log(`Retrieved ${searches.length} saved searches for user ${userId}`);
      return searches;
    } catch (error) {
      this.logger.error(`Error finding saved searches for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific saved search
   */
  async findOne(id: string, userId: string): Promise<SavedSearch> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException('Invalid saved search ID');
      }

      const savedSearch = await this.savedSearchModel.findById(id).exec();

      if (!savedSearch) {
        throw new NotFoundException('Saved search not found');
      }

      // Check ownership
      if (savedSearch.userId.toString() !== userId) {
        throw new ForbiddenException('You can only access your own saved searches');
      }

      return savedSearch;
    } catch (error) {
      this.logger.error(`Error finding saved search ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update a saved search
   */
  async update(id: string, updateDto: UpdateSavedSearchDto, userId: string): Promise<SavedSearch> {
    try {
      const savedSearch = await this.findOne(id, userId);

      // Update results count if criteria changed
      if (updateDto.searchCriteria) {
        const resultsCount = await this.getMatchingPropertiesCount(updateDto.searchCriteria);
        updateDto['resultsCount'] = resultsCount;
      }

      const updated = await this.savedSearchModel
        .findByIdAndUpdate(
          id,
          { ...updateDto, lastChecked: new Date() },
          { new: true }
        )
        .exec();

      if (!updated) {
        throw new NotFoundException('Saved search not found after update');
      }

      this.logger.log(`Saved search updated: ${id} by user ${userId}`);
      return updated;
    } catch (error) {
      this.logger.error(`Error updating saved search ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a saved search
   */
  async remove(id: string, userId: string): Promise<void> {
    try {
      const savedSearch = await this.findOne(id, userId);

      await this.savedSearchModel.findByIdAndDelete(id).exec();
      this.logger.log(`Saved search deleted: ${id} by user ${userId}`);
    } catch (error) {
      this.logger.error(`Error deleting saved search ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get matching properties for a saved search
   */
 async getMatchingProperties(
  id: string,
  userId: string,
  page: number = 1,
  limit: number = 20
): Promise<{ properties: Property[]; total: number; page: number; totalPages: number }> {
  try {
    const savedSearch = await this.findOne(id, userId);
    const skip = (page - 1) * limit;

    const query = this.buildPropertyQuery(savedSearch.searchCriteria);
    
    // 🔍 ADD THIS DEBUG LOG
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

    // 🔍 ADD THIS DEBUG LOG
    this.logger.log(`✅ Found ${properties.length} properties out of ${total} total for search ${id}`);

    // Update saved search with new results count and clear new matches
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

    // 🔍 ADD THIS DEBUG LOG
    this.logger.log(`📦 Returning result: ${JSON.stringify({ propertiesCount: properties.length, total, page, totalPages: result.totalPages })}`);

    return result;
  } catch (error) {
    this.logger.error(`Error getting matching properties for saved search ${id}:`, error);
    throw error;
  }
}

  /**
   * Check for new properties matching saved searches (Cron job - runs every hour)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkForNewMatches(): Promise<void> {
    try {
      this.logger.log('🔔 CRON: Starting new property matches check...');

      const activeSearches = await this.savedSearchModel
        .find({ 
          isActive: true,
          notificationFrequency: { $ne: SearchFrequency.NEVER }
        })
        .exec();

      this.logger.log(`Found ${activeSearches.length} active searches to check`);

      for (const search of activeSearches) {
        await this.updateNewMatches(search);
      }

      this.logger.log(`✅ CRON: Completed checking ${activeSearches.length} saved searches for new matches`);
    } catch (error) {
      this.logger.error('❌ CRON: Error checking for new matches:', error);
    }
  }

  /**
   * Send notification emails for saved searches (Cron job - runs daily at 9 AM)
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendDailyNotifications(): Promise<void> {
    this.logger.log('🔔 CRON: Sending daily notifications...');
    await this.sendNotifications(SearchFrequency.DAILY);
  }

  /**
   * Send instant notifications (Cron job - runs every 15 minutes)
   */
  @Cron('*/15 * * * *')
  async sendInstantNotifications(): Promise<void> {
    this.logger.log('🔔 CRON: Sending instant notifications...');
    await this.sendNotifications(SearchFrequency.INSTANT);
  }

  /**
   * Send weekly notifications (Cron job - runs every Monday at 9 AM)
   */
  @Cron(CronExpression.EVERY_WEEK)
  async sendWeeklyNotifications(): Promise<void> {
    this.logger.log('🔔 CRON: Sending weekly notifications...');
    await this.sendNotifications(SearchFrequency.WEEKLY);
  }

  /**
   * Send notifications for a specific frequency
   */
  private async sendNotifications(frequency: SearchFrequency): Promise<void> {
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
          const user = search.userId as any;
          
          if (!user || !user.email) {
            this.logger.warn(`Skipping search ${search._id}: User not found or no email`);
            continue;
          }

          // Get new properties
          const newProperties = await this.propertyModel
            .find({ _id: { $in: search.newMatchingProperties } })
            .limit(5) // Show top 5 new properties
            .exec();

          if (newProperties.length > 0) {
            await this.emailService.sendSavedSearchNotification(
              user.email,
              user.name || 'there',
              search.name,
              newProperties,
              (search._id as Types.ObjectId).toString()
            );

            // Update last notification sent and clear new matches
            await this.savedSearchModel.findByIdAndUpdate(search._id as Types.ObjectId, {
              lastNotificationSent: new Date(),
              newMatchingProperties: [],
            });

            this.logger.log(`📧 Sent notification for search ${search._id} to ${user.email}`);
          }
        } catch (error) {
          this.logger.error(`Error sending notification for search ${search._id}:`, error);
        }
      }

      this.logger.log(`✅ Completed sending ${frequency} notifications for ${searches.length} searches`);
    } catch (error) {
      this.logger.error(`Error sending ${frequency} notifications:`, error);
    }
  }

  /**
   * Update new matching properties for a saved search
   */
  private async updateNewMatches(search: SavedSearchDocument): Promise<void> {
    try {
      const lastChecked = search.lastChecked || search.createdAt;
      const query = {
        ...this.buildPropertyQuery(search.searchCriteria),
        createdAt: { $gt: lastChecked },
      };

      const newProperties = await this.propertyModel
        .find(query)
        .select('_id')
        .limit(100) // Limit to prevent excessive data
        .exec();

      if (newProperties.length > 0) {
        const newPropertyIds = newProperties.map(p => p._id);
        
        await this.savedSearchModel.findByIdAndUpdate(search._id, {
          $addToSet: { newMatchingProperties: { $each: newPropertyIds } },
          lastChecked: new Date(),
        });

        this.logger.log(`Found ${newProperties.length} new matches for search ${search._id}`);
      } else {
        await this.savedSearchModel.findByIdAndUpdate(search._id, {
          lastChecked: new Date(),
        });
      }
    } catch (error) {
      this.logger.error(`Error updating new matches for search ${search._id}:`, error);
    }
  }

  /**
   * Get count of matching properties
   */
  private async getMatchingPropertiesCount(searchCriteria: any): Promise<number> {
    try {
      const query = this.buildPropertyQuery(searchCriteria);
      return await this.propertyModel.countDocuments(query);
    } catch (error) {
      this.logger.error('Error getting matching properties count:', error);
      return 0;
    }
  }

/**
 * Build MongoDB query from search criteria
 */
private buildPropertyQuery(criteria: any): any {
  const query: any = {
    isActive: true,
    availability: 'active',
  };

  // 🔧 FIX: Only add price filter if values are actually defined and not null
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
    const amenityQueries = criteria.amenities.map((amenity: string) => ({
      [`amenities.${amenity}`]: true,
    }));
    query.$and = amenityQueries;
  }

  // Geospatial search
  if (criteria.latitude && criteria.longitude && criteria.radius) {
    query.location = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [criteria.longitude, criteria.latitude],
        },
        $maxDistance: criteria.radius * 1000, // Convert km to meters
      },
    };
  }

  return query;
}

  /**
   * Get statistics for user's saved searches
   */
  async getStatistics(userId: string): Promise<any> {
    try {
      const searches = await this.savedSearchModel
        .find({ userId: new Types.ObjectId(userId) })
        .exec();

      const statistics = {
        totalSearches: searches.length,
        activeSearches: searches.filter(s => s.isActive).length,
        totalNewMatches: searches.reduce((sum, s) => sum + (s.newMatchingProperties?.length || 0), 0),
        byFrequency: {
          instant: searches.filter(s => s.notificationFrequency === SearchFrequency.INSTANT).length,
          daily: searches.filter(s => s.notificationFrequency === SearchFrequency.DAILY).length,
          weekly: searches.filter(s => s.notificationFrequency === SearchFrequency.WEEKLY).length,
          never: searches.filter(s => s.notificationFrequency === SearchFrequency.NEVER).length,
        },
        totalResults: searches.reduce((sum, s) => sum + (s.resultsCount || 0), 0),
      };

      return statistics;
    } catch (error) {
      this.logger.error(`Error getting statistics for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * 🆕 Manual trigger for testing notifications (call this from controller for testing)
   */
  async triggerManualCheck(userId: string): Promise<Array<{
    searchId: Types.ObjectId;
    name: string;
    newMatches: number;
    resultsCount: number;
  }>> {
    try {
      this.logger.log(`🧪 Manual trigger: Checking searches for user ${userId}`);

      const searches = await this.savedSearchModel
        .find({ 
          userId: new Types.ObjectId(userId),
          isActive: true 
        })
        .exec();

      const results: Array<{
        searchId: Types.ObjectId;
        name: string;
        newMatches: number;
        resultsCount: number;
      }> = [];

      for (const search of searches) {
        await this.updateNewMatches(search);
        const updated = await this.savedSearchModel.findById(search._id);
        
        if (updated) {
          results.push({
            searchId: search._id as Types.ObjectId,
            name: search.name,
            newMatches: updated.newMatchingProperties?.length || 0,
            resultsCount: updated.resultsCount || 0
          });
        }
      }

      this.logger.log(`✅ Manual check completed for ${results.length} searches`);
      return results;
    } catch (error) {
      this.logger.error(`Error in manual check for user ${userId}:`, error);
      throw error;
    }
  }
}