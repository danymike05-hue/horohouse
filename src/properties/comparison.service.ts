import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';

import { Comparison, ComparisonDocument } from './schemas/comparison.schema';
import { Property, PropertyDocument } from './schemas/property.schema';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { HistoryService } from '../history/history.service';
import { ActivityType } from '../history/schemas/history.schema';

export interface CreateComparisonDto {
  name: string;
  propertyIds: string[];
  isPublic?: boolean;
}

export interface UpdateComparisonDto {
  name?: string;
  propertyIds?: string[];
  isPublic?: boolean;
}

@Injectable()
export class ComparisonService {
  private readonly logger = new Logger(ComparisonService.name);

  constructor(
    @InjectModel(Comparison.name) private comparisonModel: Model<ComparisonDocument>,
    @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private historyService: HistoryService,
  ) {}

  async create(createComparisonDto: CreateComparisonDto, user: User): Promise<Comparison> {
    const { name, propertyIds, isPublic = false } = createComparisonDto;

    // Validate property IDs
    if (!propertyIds || propertyIds.length === 0 || propertyIds.length > 3) {
      throw new BadRequestException('You can compare 1-3 properties');
    }

    // Verify all properties exist
    const properties = await this.propertyModel.find({
      _id: { $in: propertyIds.map(id => new Types.ObjectId(id)) }
    });

    if (properties.length !== propertyIds.length) {
      throw new BadRequestException('One or more properties not found');
    }

    // Create comparison
    const comparison = new this.comparisonModel({
      userId: user._id,
      name,
      propertyIds: propertyIds.map(id => new Types.ObjectId(id)),
      isPublic,
      shareToken: randomUUID(),
    });

    const savedComparison = await comparison.save();

    // Log activity
    await this.historyService.logActivity({
      userId: user._id,
      activityType: ActivityType.PROPERTY_SEARCH, // Using closest available activity type
      metadata: {
        comparisonId: savedComparison._id,
        propertyIds,
        comparisonName: name,
      },
    });

    this.logger.log(`Comparison created: ${savedComparison._id} by user ${user._id}`);

    return savedComparison.populate('propertyIds');
  }

  async findAll(user: User): Promise<Comparison[]> {
    return this.comparisonModel
      .find({ userId: user._id })
      .populate('propertyIds', 'title price type images location')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string, user?: User): Promise<Comparison> {
    const comparison = await this.comparisonModel
      .findById(id)
      .populate('propertyIds')
      .populate('userId', 'name');

    if (!comparison) {
      throw new NotFoundException('Comparison not found');
    }

    // Check access permissions
    const canAccess = 
      !user || // Public access for guests
      comparison.isPublic ||
      comparison.userId.toString() === user._id.toString() ||
      user.role === UserRole.ADMIN;

    if (!canAccess) {
      throw new ForbiddenException('Access denied');
    }

    // Increment view count
    comparison.viewsCount += 1;
    await comparison.save();

    return comparison;
  }

  async findByShareToken(shareToken: string): Promise<Comparison> {
    const comparison = await this.comparisonModel
      .findOne({ shareToken })
      .populate('propertyIds', 'title price type images location amenities')
      .populate('userId', 'name profilePicture');

    if (!comparison) {
      throw new NotFoundException('Comparison not found');
    }

    // Increment share views count
    await this.comparisonModel.findByIdAndUpdate(
      comparison._id,
      { $inc: { shareViewsCount: 1 } }
    );

    this.logger.log(`Comparison accessed via share token: ${comparison._id}`);
    return comparison;
  }

  async update(id: string, updateComparisonDto: UpdateComparisonDto, user: User): Promise<Comparison> {
    const comparison = await this.comparisonModel.findById(id);
    if (!comparison) {
      throw new NotFoundException('Comparison not found');
    }

    // Check permissions
    const canUpdate = 
      comparison.userId.toString() === user._id.toString() ||
      user.role === UserRole.ADMIN;

    if (!canUpdate) {
      throw new ForbiddenException('Access denied');
    }

    // Validate property IDs if being updated
    if (updateComparisonDto.propertyIds) {
      if (updateComparisonDto.propertyIds.length === 0 || updateComparisonDto.propertyIds.length > 3) {
        throw new BadRequestException('You can compare 1-3 properties');
      }

      const properties = await this.propertyModel.find({
        _id: { $in: updateComparisonDto.propertyIds.map(id => new Types.ObjectId(id)) }
      });

      if (properties.length !== updateComparisonDto.propertyIds.length) {
        throw new BadRequestException('One or more properties not found');
      }

      updateComparisonDto.propertyIds = updateComparisonDto.propertyIds.map(id => new Types.ObjectId(id)) as any;
    }

    Object.assign(comparison, updateComparisonDto);
    const updatedComparison = await comparison.save();

    return updatedComparison.populate('propertyIds');
  }

  async remove(id: string, user: User): Promise<void> {
    const comparison = await this.comparisonModel.findById(id);
    if (!comparison) {
      throw new NotFoundException('Comparison not found');
    }

    // Check permissions
    const canDelete = 
      comparison.userId.toString() === user._id.toString() ||
      user.role === UserRole.ADMIN;

    if (!canDelete) {
      throw new ForbiddenException('Access denied');
    }

    await this.comparisonModel.findByIdAndDelete(id);
  }

  async getPublicComparisons(limit: number = 10): Promise<Comparison[]> {
    return this.comparisonModel
      .find({ isPublic: true })
      .populate('propertyIds', 'title price type images location')
      .populate('userId', 'name')
      .sort({ viewsCount: -1, createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async generateShareUrl(id: string, user: User): Promise<{ shareUrl: string; shareToken: string }> {
    const comparison = await this.comparisonModel.findById(id);
    if (!comparison) {
      throw new NotFoundException('Comparison not found');
    }

    // Check permissions
    const canShare = 
      comparison.userId.toString() === user._id.toString() ||
      user.role === UserRole.ADMIN;

    if (!canShare) {
      throw new ForbiddenException('Access denied');
    }

    // Generate new share token if not exists
    if (!comparison.shareToken) {
      comparison.shareToken = randomUUID();
      await comparison.save();
    }

    const shareUrl = `${process.env.FRONTEND_URL}/properties/compare?share=${comparison.shareToken}`;

    return {
      shareUrl,
      shareToken: comparison.shareToken!,
    };
  }
}
