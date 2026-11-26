import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    Logger,
    OnModuleInit, Optional } from '@nestjs/common';
import { HostPlansService } from '../host-plans/host-plans.service';
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
        @Optional() private readonly hostPlans?: HostPlansService,
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
    /**
     * The account that answers support chats: SUPPORT_USER_ID when it's set (and that
     * account exists), otherwise the longest-standing active admin.
     */
    private async supportAccountId(): Promise<string | null> {
        const configured = process.env.SUPPORT_USER_ID;
        if (configured && Types.ObjectId.isValid(configured)) {
            const found = await this.userModel.findById(configured).select('_id').lean();
            if (found) return String(found._id);
        }
        const admin = await this.userModel
            .findOne({ role: 'admin', isActive: { $ne: false } })
            .sort({ createdAt: 1 })
            .select('_id')
            .lean();
        return admin ? String(admin._id) : null;
    }

    /** The account that answers support (for the support inbox) */
    supportAccount(): Promise<string | null> {
        return this.supportAccountId();
    }

    /** Only support chats can be opened from the support inbox */
    async assertSupportConversation(conversationId: string): Promise<void> {
        if (!Types.ObjectId.isValid(conversationId)) throw new NotFoundException('Conversation not found');
        const found = await this.conversationModel.exists({ _id: conversationId, isSupport: true });
        if (!found) throw new NotFoundException('Support conversation not found');
    }

    /** Read on the support side: nothing waiting any more */
    async clearUnread(conversationId: string, userId: string): Promise<void> {
        await this.conversationModel.updateOne(
            { _id: conversationId, 'participants.userId': new Types.ObjectId(userId) },
            { $set: { 'participants.$.unreadCount': 0, 'participants.$.lastReadAt': new Date() } },
        ).exec();
    }

    /** My conversation with HoroHouse support (made on first use) */
    async createSupportConversation(userId: string): Promise<Conversation> {
        const supportId = await this.supportAccountId();
        if (!supportId) throw new NotFoundException('Support chat is not available right now');
        if (supportId === String(userId)) throw new BadRequestException('You are the support account');

        const me = new Types.ObjectId(userId);
        const them = new Types.ObjectId(supportId);
        const populate = (q: any) => q
            .populate('participants.userId', 'name profilePicture email phoneNumber')
            .populate('propertyId', 'title images price address city');

        const existing = await populate(this.conversationModel.findOne({ 'participants.userId': { $all: [me, them] }, isSupport: true })).exec();
        if (existing) return existing;

        // A support chat from before support chats were marked: the one with no listing
        const older = await this.conversationModel.findOneAndUpdate(
            { 'participants.userId': { $all: [me, them] }, propertyId: { $exists: false }, isSupport: { $ne: true } },
            { $set: { isSupport: true } },
            { new: true },
        );
        if (older) return populate(this.conversationModel.findById(older._id)).exec();

        const conversation = await this.conversationModel.create({
            participants: [
                { userId: me, unreadCount: 0, joinedAt: new Date() },
                { userId: them, unreadCount: 0, joinedAt: new Date() },
            ],
            isSupport: true,
            messagesCount: 0,
        });
        this.logger.log(`Created support conversation: ${conversation._id}`);
        return conversation;
    }

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

            await this.assertCanContact(userId, participantId);

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

    // ── Blocking ────────────────────────────────────────────────────────────

    /** Neither may write to or call the other once one of them blocked the other */
    async assertCanContact(fromId: string, toId: string): Promise<void> {
        if (String(fromId) === String(toId)) return;
        const people: any[] = await this.userModel
            .find({ _id: { $in: [fromId, toId] } })
            .select('+blockedUsers deletedAt')
            .lean()
            .exec();
        const blocks = (id: string, other: string) =>
            (people.find((p) => String(p._id) === String(id))?.blockedUsers ?? []).some((b: any) => String(b) === String(other));

        if (people.find((p) => String(p._id) === String(toId))?.deletedAt) {
            throw new ForbiddenException({ message: 'This account no longer exists', code: 'ACCOUNT_DELETED' });
        }
        if (blocks(fromId, toId)) {
            throw new ForbiddenException({ message: 'You blocked this person. Unblock them to write to them.', code: 'YOU_BLOCKED' });
        }
        if (blocks(toId, fromId)) {
            // Says nothing about who blocked whom
            throw new ForbiddenException({ message: 'You can’t contact this person', code: 'CANNOT_CONTACT' });
        }
    }

    async blockUser(userId: string, otherId: string): Promise<{ blocked: boolean }> {
        if (!Types.ObjectId.isValid(otherId)) throw new NotFoundException('User not found');
        if (String(userId) === String(otherId)) throw new BadRequestException('You cannot block yourself');
        const other: any = await this.userModel.findById(otherId).select('role deletedAt').lean().exec();
        if (!other) throw new NotFoundException('User not found');
        if (other.role === 'admin' || (await this.supportAccountId()) === String(otherId)) {
            throw new BadRequestException({ message: 'HoroHouse support can’t be blocked', code: 'SUPPORT' });
        }
        await this.userModel.updateOne({ _id: userId }, { $addToSet: { blockedUsers: new Types.ObjectId(otherId) } });
        return { blocked: true };
    }

    async unblockUser(userId: string, otherId: string): Promise<{ blocked: boolean }> {
        if (!Types.ObjectId.isValid(otherId)) throw new NotFoundException('User not found');
        await this.userModel.updateOne({ _id: userId }, { $pull: { blockedUsers: new Types.ObjectId(otherId) } });
        return { blocked: false };
    }

    /** People I blocked, newest last */
    async blockedUsers(userId: string): Promise<{ _id: string; name: string; profilePicture?: string }[]> {
        const me: any = await this.userModel.findById(userId).select('+blockedUsers').lean().exec();
        const ids = me?.blockedUsers ?? [];
        if (!ids.length) return [];
        const people: any[] = await this.userModel.find({ _id: { $in: ids }, deletedAt: { $exists: false } }).select('name profilePicture').lean().exec();
        return people.map((p) => ({ _id: String(p._id), name: p.name, profilePicture: p.profilePicture ?? undefined }));
    }

    async hasBlocked(userId: string, otherId: string): Promise<boolean> {
        if (!Types.ObjectId.isValid(otherId)) return false;
        return !!(await this.userModel.exists({ _id: userId, blockedUsers: new Types.ObjectId(otherId) }));
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
                    isSupport: { $ne: true },
                })
                .populate('participants.userId', 'name profilePicture email phoneNumber')
                .populate('propertyId', 'title images price address city')
                .exec();

            if (propConv) return propConv;
        }

        // 2. Fall back to finding any existing direct conversation between these 2 users
        //    (not the support chat: that one is only for help from HoroHouse)
        return this.conversationModel
            .findOne({
                'participants.userId': { $all: [u1, u2] },
                isSupport: { $ne: true },
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

            const me = new Types.ObjectId(userId);
            if (!includeArchived) {
                matchQuery.archivedBy = { $ne: me };
            }
            // Deleted on my side: hidden until someone writes again
            matchQuery.$expr = {
                $not: {
                    $let: {
                        vars: { mine: { $first: { $filter: { input: '$participants', cond: { $eq: ['$$this.userId', me] } } } } },
                        in: {
                            $and: [
                                { $gt: ['$$mine.clearedAt', null] },
                                { $gte: ['$$mine.clearedAt', { $ifNull: ['$lastMessage.createdAt', new Date(0)] }] },
                            ],
                        },
                    },
                },
            };

            // The support inbox: only chats with support
            if ((query as any).onlySupport) matchQuery.isSupport = true;

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

            // The support account sees which hosts are on a plan with priority support
            if (this.hostPlans && (await this.supportAccountId()) === String(userId)) {
                const tiers = await this.hostPlans.supportTiers(
                    formattedConversations.map((c: any) => resolveId(c.otherUser)).filter(Boolean),
                );
                for (const c of formattedConversations as any[]) {
                    const tier = tiers[resolveId(c.otherUser)];
                    if (tier && tier !== 'standard') c.supportTier = tier;
                }
                // Dedicated first, then priority, keeping the newest-first order inside each
                const rank = (c: any) => (c.supportTier === 'dedicated' ? 0 : c.supportTier === 'priority' ? 1 : 2);
                formattedConversations.sort((a: any, b: any) => (a.unreadCount > 0 && b.unreadCount > 0 ? rank(a) - rank(b) : 0));
            }

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
        if (!Types.ObjectId.isValid(conversationId)) {
            throw new NotFoundException('Conversation not found');
        }
        const conversation = await this.conversationModel
            .findById(conversationId)
            .populate('participants.userId', 'name profilePicture email phoneNumber')
            .populate('propertyId', 'title images price address city')
            .exec();

        if (!conversation) {
            throw new NotFoundException('Conversation not found');
        }

        // Check if user is participant (a deleted account leaves userId null after populate)
        const isParticipant = conversation.participants.some(
            p => String((p.userId as any)?._id ?? p.userId ?? '') === userId,
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
                p => !!p.userId && String((p.userId as any)?._id ?? p.userId) !== userId,
            );

            // Allow self-messaging (mostly for testing and developers)
            if (!recipient && conversation.participants.length > 0) {
                recipient = conversation.participants[0];
            }

            if (!recipient) {
                throw new BadRequestException('Recipient not found');
            }

            await this.assertCanContact(userId, String((recipient.userId as any)?._id ?? recipient.userId));

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
                recipientId: (recipient.userId as any)?._id ?? recipient.userId,
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
                arrayFilters: [{ 'elem.userId': (recipient.userId as any)?._id ?? recipient.userId }],
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
            const conv: any = await this.getConversation(conversationId, userId);
            const mine = (conv?.participants ?? []).find((p: any) => String(p.userId?._id ?? p.userId) === String(userId));

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
            // Deleted on my side: nothing from before that
            if (mine?.clearedAt) {
                matchQuery.createdAt = { ...(matchQuery.createdAt ?? {}), $gt: new Date(mine.clearedAt) };
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
            // Bad ids used to crash the request with a 500
            messageIds = (messageIds ?? []).filter((id) => Types.ObjectId.isValid(id));

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
        if ((message as any).isDeleted) {
            throw new BadRequestException('This message was deleted');
        }
        const content = String(dto.content ?? '').trim();
        if (!content) {
            throw new BadRequestException('A message cannot be empty');
        }

        const updatedMessage = await this.messageModel.findByIdAndUpdate(
            messageId,
            {
                content,
                isEdited: true,
                editedAt: new Date(),
            },
            { new: true }
        ).populate('senderId', 'name profilePicture');
        // The conversation list shows the last message: keep it in step
        await this.conversationModel.updateOne(
            { _id: message.conversationId, 'lastMessage.createdAt': (message as any).createdAt, 'lastMessage.senderId': message.senderId },
            { $set: { 'lastMessage.content': content } },
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
    async deleteMessage(messageId: string, userId: string): Promise<string> {
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
            // Nothing of a deleted message is kept for anyone to read
            content: '',
            attachments: [],
        });
        // If it was the last message, the list shows the one before it
        const conv: any = await this.conversationModel.findById(message.conversationId).select('lastMessage').lean();
        if (conv?.lastMessage && new Date(conv.lastMessage.createdAt).getTime() === new Date((message as any).createdAt).getTime()) {
            const prev: any = await this.messageModel
                .findOne({ conversationId: message.conversationId, isDeleted: false })
                .sort({ createdAt: -1 })
                .lean();
            await this.conversationModel.updateOne(
                { _id: message.conversationId },
                prev
                    ? { $set: { lastMessage: { content: prev.content || (prev.attachments?.length ? '📷' : ''), senderId: prev.senderId, createdAt: prev.createdAt, type: prev.type } } }
                    : { $unset: { lastMessage: 1 } },
            );
        }
        return String(message.conversationId);
    }

    /** Who's in a conversation (to tell their phones about edits and deletions) */
    async participantIds(conversationId: string): Promise<string[]> {
        const conv: any = await this.conversationModel.findById(conversationId).select('participants.userId').lean();
        return (conv?.participants ?? []).map((p: any) => String(p.userId));
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
        // Deleted on my side only: the other person keeps theirs. It comes back for me, empty,
        // if someone writes again.
        await this.getConversation(conversationId, userId);
        const me = new Types.ObjectId(userId);
        await this.conversationModel.updateOne(
            { _id: conversationId, 'participants.userId': me },
            { $set: { 'participants.$.clearedAt': new Date(), 'participants.$.unreadCount': 0 }, $pull: { archivedBy: me } },
        );
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