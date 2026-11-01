import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Inquiry, InquiryDocument, InquiryStatus, InquiryType } from './schemas/inquiry.schema';
import { Property, PropertyDocument } from './schemas/property.schema';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { HistoryService } from '../history/history.service';
import { ActivityType } from '../history/schemas/history.schema';
import { NotificationsService } from '../notifications/notifications.service';

export interface CreateInquiryDto {
  propertyId: string;
  message: string;
  type?: InquiryType;
  preferredContactMethod?: string;
  preferredContactTime?: string;
  viewingDate?: Date;
  budget?: number;
  moveInDate?: Date;
  contactEmail?: string;
  contactPhone?: string;
}

export interface UpdateInquiryDto {
  response?: string;
  status?: InquiryStatus;
}

export interface InquiryFilters {
  propertyId?: string;
  agentId?: string;
  userId?: string;
  status?: InquiryStatus;
  type?: InquiryType;
  isRead?: boolean;
}

export interface InquiryOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class InquiryService {
  private readonly logger = new Logger(InquiryService.name);

  constructor(
    @InjectModel(Inquiry.name) private inquiryModel: Model<InquiryDocument>,
    @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private historyService: HistoryService,
    private notificationsService: NotificationsService,
  ) { }

  async create(createInquiryDto: CreateInquiryDto, user: User): Promise<Inquiry> {
    // Verify property exists
    const property = await this.propertyModel.findById(createInquiryDto.propertyId).populate('agentId ownerId');
    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Determine the agent to receive the inquiry. property.agentId / ownerId
    // may be populated documents or raw ObjectId values. Normalize to a
    // string ID so notifications and room joins use the same identifier.
    const rawAgent = property.agentId || property.ownerId;

    if (!rawAgent) {
      throw new BadRequestException('Property has no assigned agent or owner');
    }

    // Normalize to string id (works for populated docs and ObjectId)
    const agentId = ((): string => {
      if (!rawAgent) return '';
      // If populated Mongoose document/object
      if (typeof rawAgent === 'object' && (rawAgent as any)._id) {
        return (rawAgent as any)._id.toString();
      }
      // If it's an ObjectId or string
      try {
        return rawAgent.toString();
      } catch (e) {
        return String(rawAgent);
      }
    })();

    // Create inquiry
    const inquiry = new this.inquiryModel({
      ...createInquiryDto,
      propertyId: new Types.ObjectId(createInquiryDto.propertyId),
      userId: user._id,
      // Store agentId as an ObjectId in the document
      agentId: new Types.ObjectId(agentId),
    });

    const savedInquiry = await inquiry.save();
    this.logger.log(`Inquiry created: ${savedInquiry._id} for property ${property._id} by user ${user._id}`);

    // Update property inquiries count
    await this.propertyModel.findByIdAndUpdate(
      property._id,
      { $inc: { inquiriesCount: 1 } }
    );

    // Log activity
    await this.historyService.logActivity({
      userId: user._id,
      activityType: ActivityType.PROPERTY_INQUIRY,
      propertyId: property._id as Types.ObjectId,
      agentId: new Types.ObjectId(agentId),
      metadata: {
        inquiryId: savedInquiry._id,
        agentId: agentId,
        message: createInquiryDto.message.substring(0, 100) + '...',
      },
    });

    // Create notification for property owner/agent
    try {
      // agentId is already normalized to string above
      await this.notificationsService.createInquiryNotification(
        agentId,
        (savedInquiry._id as Types.ObjectId).toString(),
        (property._id as Types.ObjectId).toString(),
        user.name || 'A user',
        property.title,
      );
    } catch (error) {
      this.logger.error(`Failed to create inquiry notification: ${error.message}`);
    }

    return savedInquiry.populate('propertyId userId agentId');
  }

  async findAll(
    filters: InquiryFilters = {},
    options: InquiryOptions = {},
    user: User,
  ): Promise<{ inquiries: Inquiry[]; total: number; page: number; totalPages: number }> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const skip = (page - 1) * limit;

    // Build query based on user role and filters
    let query: any = {};

    // Role-based filtering
    if (user.role === UserRole.AGENT || user.role === UserRole.LANDLORD) {
      query.agentId = user._id;
    } else if (user.role === UserRole.REGISTERED_USER) {
      query.userId = user._id;
    }
    // Admin can see all inquiries

    // Apply additional filters
    if (filters.propertyId) {
      query.propertyId = new Types.ObjectId(filters.propertyId);
    }
    if (filters.agentId) {
      query.agentId = new Types.ObjectId(filters.agentId);
    }
    if (filters.userId) {
      query.userId = new Types.ObjectId(filters.userId);
    }
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.type) {
      query.type = filters.type;
    }
    if (filters.isRead !== undefined) {
      query.isRead = filters.isRead;
    }

    const [inquiries, total] = await Promise.all([
      this.inquiryModel
        .find(query)
        .populate('propertyId', 'title price type images location')
        .populate('userId', 'name email phoneNumber profilePicture')
        .populate('agentId', 'name email phoneNumber profilePicture')
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.inquiryModel.countDocuments(query),
    ]);

    return {
      inquiries,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, user: User): Promise<Inquiry> {
    const inquiry = await this.inquiryModel
      .findById(id)
      .populate('propertyId')
      .populate('userId', 'name email phoneNumber profilePicture')
      .populate('agentId', 'name email phoneNumber profilePicture');

    if (!inquiry) {
      throw new NotFoundException('Inquiry not found');
    }

    // More robust ID extraction that handles all cases
    const getUserId = (field: any): string | null => {
      if (!field) return null;
      // If it's an object with _id property
      if (typeof field === 'object' && field._id) {
        return field._id.toString();
      }
      // If it's a direct value (ObjectId or string)
      return field.toString();
    };

    const inquiryUserId = getUserId(inquiry.userId);
    const inquiryAgentId = getUserId(inquiry.agentId);
    const currentUserId = (user._id || (user as any).id).toString();

    // Check permissions
    const canAccess =
      user.role === UserRole.ADMIN ||
      inquiryUserId === currentUserId ||
      (inquiryAgentId && inquiryAgentId === currentUserId);

    if (!canAccess) {
      this.logger.warn(`Access denied for user ${currentUserId} to inquiry ${id}`);
      this.logger.debug(`Permission check: userId=${inquiryUserId}, agentId=${inquiryAgentId}, currentUser=${currentUserId}, role=${user.role}`);
      throw new ForbiddenException('Access denied');
    }

    // Mark as read if accessed by agent
    if (inquiryAgentId && inquiryAgentId === currentUserId && !inquiry.isRead) {
      inquiry.isRead = true;
      inquiry.readAt = new Date();
      await inquiry.save();
    }

    return inquiry;
  }

  async update(id: string, updateInquiryDto: UpdateInquiryDto, user: User): Promise<Inquiry> {
    const inquiry = await this.inquiryModel.findById(id);
    if (!inquiry) {
      throw new NotFoundException('Inquiry not found');
    }

    // Check permissions - only agent, landlord, or admin can update
    const canUpdate =
      user.role === UserRole.ADMIN ||
      (inquiry.agentId && inquiry.agentId.toString() === user._id.toString());

    if (!canUpdate) {
      throw new ForbiddenException('Access denied');
    }

    // Update inquiry
    Object.assign(inquiry, updateInquiryDto);

    if (updateInquiryDto.response) {
      inquiry.respondedAt = new Date();
      inquiry.respondedBy = user._id;
      inquiry.status = InquiryStatus.RESPONDED;
    }

    const updatedInquiry = await inquiry.save();

    // Log activity
    await this.historyService.logActivity({
      userId: user._id,
      activityType: ActivityType.AGENT_CONTACT,
      propertyId: inquiry.propertyId,
      metadata: {
        inquiryId: inquiry._id,
        action: 'response',
        response: updateInquiryDto.response?.substring(0, 100) + '...',
      },
    });

    // Notify the inquiring user that an agent replied
    try {
      // Normalize inquiry.userId to string (handles populated docs and ObjectId)
      const targetUserId = ((): string => {
        const u = inquiry.userId as any;
        if (!u) return '';
        if (typeof u === 'object' && u._id) return u._id.toString();
        return u.toString();
      })();

      if (targetUserId) {
        // Use a short snippet of the response as the notification message
        const snippet = updateInquiryDto.response ? updateInquiryDto.response.substring(0, 120) : undefined;
        await this.notificationsService.createInquiryResponseNotification(
          targetUserId,
          (inquiry._id as Types.ObjectId).toString(),
          (inquiry.propertyId as Types.ObjectId).toString(),
          user.name || 'An agent',
          snippet,
        );
      } else {
        this.logger.warn(`Could not determine target user for inquiry ${inquiry._id}`);
      }
    } catch (error) {
      this.logger.error(`Failed to notify user about agent response: ${error.message}`);
    }

    return updatedInquiry.populate('propertyId userId agentId');
  }

  async remove(id: string, user: User): Promise<void> {
    const inquiry = await this.inquiryModel.findById(id);
    if (!inquiry) {
      throw new NotFoundException('Inquiry not found');
    }

    // Check permissions - only admin or the user who created the inquiry can delete
    const canDelete =
      user.role === UserRole.ADMIN ||
      inquiry.userId.toString() === user._id.toString();

    if (!canDelete) {
      throw new ForbiddenException('Access denied');
    }

    await this.inquiryModel.findByIdAndDelete(id);

    // Update property inquiries count
    await this.propertyModel.findByIdAndUpdate(
      inquiry.propertyId,
      { $inc: { inquiriesCount: -1 } }
    );
  }

  async getInquiriesForProperty(propertyId: string, user: User): Promise<Inquiry[]> {
    // Verify property exists and user has access
    const property = await this.propertyModel.findById(propertyId);
    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Check permissions
    const canAccess =
      user.role === UserRole.ADMIN ||
      property.ownerId.toString() === user._id.toString() ||
      property.agentId?.toString() === user._id.toString();

    if (!canAccess) {
      throw new ForbiddenException('Access denied');
    }

    return this.inquiryModel
      .find({ propertyId: new Types.ObjectId(propertyId) })
      .populate('userId', 'name email phoneNumber profilePicture')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getInquiryStats(user: User): Promise<any> {
    let matchQuery: any = {};

    // Role-based filtering
    if (user.role === UserRole.AGENT || user.role === UserRole.LANDLORD) {
      matchQuery.agentId = user._id;
    } else if (user.role === UserRole.REGISTERED_USER) {
      matchQuery.userId = user._id;
    }
    // Admin can see all stats

    const stats = await this.inquiryModel.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', InquiryStatus.PENDING] }, 1, 0] } },
          responded: { $sum: { $cond: [{ $eq: ['$status', InquiryStatus.RESPONDED] }, 1, 0] } },
          closed: { $sum: { $cond: [{ $eq: ['$status', InquiryStatus.CLOSED] }, 1, 0] } },
          unread: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } },
        },
      },
    ]);

    return stats[0] || {
      total: 0,
      pending: 0,
      responded: 0,
      closed: 0,
      unread: 0,
    };
  }

  async markAsRead(id: string, user: User): Promise<Inquiry> {
    const inquiry = await this.inquiryModel.findById(id);
    if (!inquiry) {
      throw new NotFoundException('Inquiry not found');
    }

    // Check permissions
    const canMarkRead =
      user.role === UserRole.ADMIN ||
      inquiry.agentId.toString() === user._id.toString();

    if (!canMarkRead) {
      throw new ForbiddenException('Access denied');
    }

    inquiry.isRead = true;
    inquiry.readAt = new Date();

    return inquiry.save();
  }
}
