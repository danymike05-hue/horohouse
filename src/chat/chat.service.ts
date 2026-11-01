import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    Logger,
    OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
    Conversation,
    ConversationDocument,
    ParticipantInfo,
} from './schemas/conversation.schema';
import {
    Message,
    MessageAttachment,
    MessageDocument,
    MessageStatus,
    MessageType,
} from './schemas/message.schema';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
    CreateConversationDto,
    SendMessageDto,
    GetMessagesQueryDto,
    GetConversationsQueryDto,
    EditMessageDto,
} from './dto/chat.dto';

@Injectable()
export class ChatService implements OnModuleInit {
    private readonly logger = new Logger(ChatService.name);

    constructor(
        @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
        @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
        @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
    ) { }

    async onModuleInit() {
        try {
            const col = this.conversationModel.collection;
            const indexes = await col.indexes();
            const badIndex = indexes.find(idx => idx.name === 'participants.userId_1_propertyId_1');
            if (badIndex && (badIndex as any).unique) {
                this.logger.warn('Dropping legacy unique index participants.userId_1_propertyId_1');
                await col.dropIndex('participants.userId_1_propertyId_1');
            }
        } catch (e) {
            // Ignore if index doesn't exist or collection isn't created yet
        }
    }

    /**
     * Create or get existing conversation
     */
    async createConversation(
        userId: string,
        dto: CreateConversationDto,
    ): Promise<Conversation> {
        try {
            const { participantId, propertyId, initialMessage } = dto;

            if (userId === participantId) {
                throw new BadRequestException('You cannot start a conversation with yourself');
            }

            if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(participantId)) {
                throw new BadRequestException('Invalid user ID format');
            }

            if (propertyId && !Types.ObjectId.isValid(propertyId)) {
                throw new BadRequestException('Invalid property ID format');
            }

            // Validate users exist
            const [user, participant] = await Promise.all([
                this.userModel.findById(userId),
                this.userModel.findById(participantId),
            ]);

            if (!user || !participant) {
                throw new NotFoundException('User not found');
            }

            // Validate property if provided
            if (propertyId) {
                const property = await this.propertyModel.findById(propertyId);
                if (!property) {
                    throw new NotFoundException('Property not found');
                }
            }

            // Check if conversation already exists
            const existingConversation = await this.findExistingConversation(
                userId,
                participantId,
                propertyId,
            );

            if (existingConversation) {
                this.logger.log(`Found existing conversation: ${existingConversation._id}`);
                return existingConversation;
            }

            // Create new conversation
            const participants: ParticipantInfo[] = [
                {
                    userId: new Types.ObjectId(userId),
                    unreadCount: 0,
                    joinedAt: new Date(),
                },
                {
                    userId: new Types.ObjectId(participantId),
                    unreadCount: initialMessage ? 1 : 0,
                    joinedAt: new Date(),
                },
            ];

            const conversation = await this.conversationModel.create({
                participants,
                propertyId: propertyId ? new Types.ObjectId(propertyId) : undefined,
                messagesCount: 0,
            });

            // Send initial message if provided
            if (initialMessage) {
                await this.sendMessage(userId, {
                    conversationId: conversation._id.toString(),
                    content: initialMessage,
                    type: MessageType.TEXT,
                });
            }

            this.logger.log(`Created conversation: ${conversation._id}`);
            return conversation;
        } catch (error: any) {
            if (error?.code === 11000) {
                this.logger.warn('Duplicate key error on conversation creation, fetching existing conversation');
                const existing = await this.findExistingConversation(userId, dto.participantId, dto.propertyId);
                if (existing) return existing;
            }
            this.logger.error('Error creating conversation:', error);
            throw error;
        }
    }

    /**
     * Find existing conversation between users
     */
    private async findExistingConversation(
        userId1: string,
        userId2: string,
        propertyId?: string,
    ): Promise<Conversation | null> {
        const u1 = new Types.ObjectId(userId1);
        const u2 = new Types.ObjectId(userId2);

        // 1. First try finding conversation matching both users AND propertyId (if provided)
        if (propertyId) {
            const propConv = await this.conversationModel
                .findOne({
                    'participants.userId': { $all: [u1, u2] },
                    propertyId: new Types.ObjectId(propertyId),
                })
                .populate('participants.userId', 'name profilePicture email phoneNumber')
                .populate('propertyId', 'title images price address city')
                .exec();

            if (propConv) return propConv;
        }

        // 2. Fall back to finding any existing direct conversation between these 2 users
        return this.conversationModel
            .findOne({
                'participants.userId': { $all: [u1, u2] },
            })
            .populate('participants.userId', 'name profilePicture email phoneNumber')
            .populate('propertyId', 'title images price address city')
            .exec();
    }

    /**
     * Get user's conversations with pagination
     */
    async getConversations(
        userId: string,
        query: GetConversationsQueryDto,
    ): Promise<{ conversations: any[]; total: number; page: number; totalPages: number }> {
        try {
            const { page = 1, limit = 20, includeArchived = false, filter } = query;
            const skip = (page - 1) * limit;

            const matchQuery: any = {
                'participants.userId': new Types.ObjectId(userId),
            };

            if (!includeArchived) {
                matchQuery.$or = [
                    { isArchived: false },
                    { archivedBy: { $ne: new Types.ObjectId(userId) } },
                ];
            }

            // Filter unread conversations
            if (filter === 'unread') {
                matchQuery['participants'] = {
                    $elemMatch: {
                        userId: new Types.ObjectId(userId),
                        unreadCount: { $gt: 0 },
                    },
                };
            }

            const [conversations, total] = await Promise.all([
                this.conversationModel
                    .find(matchQuery)
                    .populate('participants.userId', 'name profilePicture email phoneNumber')
                    .populate('propertyId', 'title images price address city')
                    .sort({ 'lastMessage.createdAt': -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean()
                    .exec(),
                this.conversationModel.countDocuments(matchQuery),
            ]);

            // Format conversations for response
            // After .lean(), a populated userId is a plain object with ._id;
            // if the user was deleted, population fails and userId stays as a
            // raw ObjectId — handle both forms to avoid crashes (500).
            const resolveId = (raw: any): string => {
                if (!raw) return '';
                if (typeof raw === 'string') return raw;
                if (raw._id) return raw._id.toString();
                if (typeof raw.toString === 'function') return raw.toString();
                return '';
            };

            const formattedConversations = conversations.map(conv => {
                const currentUserParticipant = conv.participants.find(
                    p => resolveId(p.userId) === userId,
                );
                const otherParticipant = conv.participants.find(
                    p => resolveId(p.userId) !== userId,
                );

                return {
                    ...conv,
                    unreadCount: currentUserParticipant?.unreadCount || 0,
                    otherUser: otherParticipant?.userId,
                };
            });

            return {
                conversations: formattedConversations,
                total,
                page,
                totalPages: Math.ceil(total / limit),
            };
        } catch (error) {
            this.logger.error('Error getting conversations:', error);
            throw error;
        }
    }

    /**
     * Get single conversation by ID
     */
    async getConversation(conversationId: string, userId: string): Promise<Conversation> {
        const conversation = await this.conversationModel
            .findById(conversationId)
            .populate('participants.userId', 'name profilePicture email phoneNumber')
            .populate('propertyId', 'title images price address city')
            .exec();

        if (!conversation) {
            throw new NotFoundException('Conversation not found');
        }

        // Check if user is participant
        const isParticipant = conversation.participants.some(
            p => p.userId._id.toString() === userId,
        );

        if (!isParticipant) {
            throw new ForbiddenException('You are not a participant in this conversation');
        }

        return conversation;
    }

    /**
     * Send a message
     */
    async sendMessage(
        userId: string,
        dto: SendMessageDto & { attachments?: MessageAttachment[] },
    ): Promise<Message> {
        try {
            const {
                conversationId,
                content,
                type = MessageType.TEXT,
                attachments = [] as string[],
                propertyId,
                replyTo
            } = dto;
            // Get conversation and validate user is participant
            const conversation = await this.getConversation(conversationId, userId);

            // Get recipient
            let recipient = conversation.participants.find(
                p => p.userId._id.toString() !== userId,
            );

            // Allow self-messaging (mostly for testing and developers)
            if (!recipient && conversation.participants.length > 0) {
                recipient = conversation.participants[0];
            }

            if (!recipient) {
                throw new BadRequestException('Recipient not found');
            }

            // Build property reference if propertyId provided
            let propertyReference;
            if (propertyId) {
                const property = await this.propertyModel.findById(propertyId);
                if (property) {
                    propertyReference = {
                        propertyId: property._id,
                        title: property.title,
                        price: property.price,
                        image: property.images?.[0]?.url || '',
                        address: property.address,
                        city: property.city,
                    };
                }
            }

            // Create message
            const message = await this.messageModel.create({
                conversationId: new Types.ObjectId(conversationId),
                senderId: new Types.ObjectId(userId),
                recipientId: recipient.userId._id,
                type,
                content,
                attachments: attachments || [],   // ← ajouté
                propertyReference,
                replyTo: replyTo ? new Types.ObjectId(replyTo) : undefined,
                status: MessageStatus.SENT,
            });

            // Update conversation
            await this.conversationModel.findByIdAndUpdate(conversationId, {
                $set: {
                    lastMessage: {
                        content: content || `Sent a ${type}`,
                        senderId: new Types.ObjectId(userId),
                        createdAt: message.createdAt,
                        type,
                    },
                },
                $inc: {
                    messagesCount: 1,
                    [`participants.$[elem].unreadCount`]: 1,
                },
            }, {
                arrayFilters: [{ 'elem.userId': recipient.userId._id }],
            });

            this.logger.log(`Message sent: ${message._id} in conversation ${conversationId}`);

            // Populate sender info before returning
            await message.populate('senderId', 'name profilePicture');

            return message;
        } catch (error) {
            this.logger.error('Error sending message:', error);
            throw error;
        }
    }

    /**
     * Get messages in a conversation with pagination
     */
    async getMessages(
        conversationId: string,
        userId: string,
        query: GetMessagesQueryDto,
    ) {
        try {
            // Validate user is participant
            await this.getConversation(conversationId, userId);

            const { page = 1, limit = 50, before } = query;
            const skip = (page - 1) * limit;

            const matchQuery: any = {
                conversationId: new Types.ObjectId(conversationId),
                isDeleted: false,
            };

            // For cursor-based pagination
            if (before) {
                const beforeMessage = await this.messageModel.findById(before);
                if (beforeMessage) {
                    matchQuery.createdAt = { $lt: beforeMessage.createdAt };
                }
            }

            const [messages, total] = await Promise.all([
                this.messageModel
                    .find(matchQuery)
                    .populate('senderId', 'name profilePicture')
                    .populate('recipientId', 'name profilePicture')
                    .populate('replyTo')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean()
                    .exec(),
                this.messageModel.countDocuments(matchQuery),
            ]);

            return {
                messages: messages.reverse(), // Reverse to show oldest first
                total,
                page,
                totalPages: Math.ceil(total / limit),
                hasMore: skip + messages.length < total,
            };
        } catch (error) {
            this.logger.error('Error getting messages:', error);
            throw error;
        }
    }

    /**
     * Mark messages as read
     */
    async markMessagesAsRead(
        conversationId: string,
        userId: string,
        messageIds: string[],
    ): Promise<void> {
        try {
            // Validate user is participant
            await this.getConversation(conversationId, userId);

            const now = new Date();

            // Update messages
            await this.messageModel.updateMany(
                {
                    _id: { $in: messageIds.map(id => new Types.ObjectId(id)) },
                    recipientId: new Types.ObjectId(userId),
                    status: { $ne: MessageStatus.READ },
                },
                {
                    $set: {
                        status: MessageStatus.READ,
                        readAt: now,
                    },
                },
            );

            // Reset unread count for user
            await this.conversationModel.updateOne(
                {
                    _id: new Types.ObjectId(conversationId),
                    'participants.userId': new Types.ObjectId(userId),
                },
                {
                    $set: {
                        'participants.$.unreadCount': 0,
                        'participants.$.lastReadAt': now,
                    },
                },
            );

            this.logger.log(`Marked ${messageIds.length} messages as read in ${conversationId}`);
        } catch (error) {
            this.logger.error('Error marking messages as read:', error);
            throw error;
        }
    }

    /**
 * Update message status
 */
    async updateMessageStatus(messageId: string, status: MessageStatus): Promise<void> {
        await this.messageModel.findByIdAndUpdate(messageId, {
            status,
            ...(status === MessageStatus.DELIVERED && { deliveredAt: new Date() }),
            ...(status === MessageStatus.READ && { readAt: new Date() }),
        });
    }

    /**
     * Edit a message
     */
    async editMessage(
        messageId: string,
        userId: string,
        dto: EditMessageDto,
    ): Promise<Message> {
        const message = await this.messageModel.findById(messageId);

        if (!message) {
            throw new NotFoundException('Message not found');
        }

        if (message.senderId.toString() !== userId) {
            throw new ForbiddenException('You can only edit your own messages');
        }

        const updatedMessage = await this.messageModel.findByIdAndUpdate(
            messageId,
            {
                content: dto.content,
                isEdited: true,
                editedAt: new Date(),
            },
            { new: true }
        );

        // Add null check after update
        if (!updatedMessage) {
            throw new NotFoundException('Message not found after update');
        }

        return updatedMessage;
    }

    /**
     * Delete a message (soft delete)
     */
    async deleteMessage(messageId: string, userId: string): Promise<void> {
        const message = await this.messageModel.findById(messageId);

        if (!message) {
            throw new NotFoundException('Message not found');
        }

        if (message.senderId.toString() !== userId) {
            throw new ForbiddenException('You can only delete your own messages');
        }

        await this.messageModel.findByIdAndUpdate(messageId, {
            isDeleted: true,
            deletedAt: new Date(),
        });
    }

    /**
     * Archive conversation
     */
    async archiveConversation(
        conversationId: string,
        userId: string,
        archive: boolean,
    ): Promise<Conversation> {
        const conversation = await this.getConversation(conversationId, userId);

        const userObjectId = new Types.ObjectId(userId);

        if (archive) {
            // Add user to archivedBy if not already there
            await this.conversationModel.findByIdAndUpdate(
                conversationId,
                { $addToSet: { archivedBy: userObjectId } }
            );
        } else {
            // Remove user from archivedBy
            await this.conversationModel.findByIdAndUpdate(
                conversationId,
                { $pull: { archivedBy: userObjectId } }
            );
        }

        const updatedConversation = await this.conversationModel
            .findById(conversationId)
            .populate('participants.userId', 'name profilePicture email phoneNumber')
            .populate('propertyId', 'title images price address city')
            .exec();

        // Add null check after fetching updated conversation
        if (!updatedConversation) {
            throw new NotFoundException('Conversation not found after update');
        }

        return updatedConversation;
    }

    /**
     * Delete conversation (for current user only)
     */
    async deleteConversation(conversationId: string, userId: string): Promise<void> {
        // Just archive it for the user
        await this.archiveConversation(conversationId, userId, true);
    }

    /**
     * Get unread messages count
     */
    async getUnreadCount(userId: string): Promise<number> {
        const conversations = await this.conversationModel.find({
            'participants.userId': new Types.ObjectId(userId),
        });

        let totalUnread = 0;
        for (const conv of conversations) {
            const userParticipant = conv.participants.find(
                p => p.userId.toString() === userId,
            );
            if (userParticipant) {
                totalUnread += userParticipant.unreadCount;
            }
        }

        return totalUnread;
    }

    /**
     * Update typing indicator
     */
    async updateTypingIndicator(
        conversationId: string,
        userId: string,
        isTyping: boolean,
    ): Promise<void> {
        await this.conversationModel.findByIdAndUpdate(conversationId, {
            $set: {
                [`typingUsers.${userId}`]: isTyping,
            },
        });
    }

    /**
     * Update user online status
     */
    async updateOnlineStatus(
        userId: string,
        status: 'online' | 'offline' | 'away',
    ): Promise<void> {
        await this.conversationModel.updateMany(
            { 'participants.userId': new Types.ObjectId(userId) },
            {
                $set: {
                    [`onlineStatus.${userId}`]: status,
                },
            },
        );
    }
}