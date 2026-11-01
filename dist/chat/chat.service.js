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
var ChatService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const conversation_schema_1 = require("./schemas/conversation.schema");
const message_schema_1 = require("./schemas/message.schema");
const property_schema_1 = require("../properties/schemas/property.schema");
const user_schema_1 = require("../users/schemas/user.schema");
let ChatService = ChatService_1 = class ChatService {
    conversationModel;
    messageModel;
    propertyModel;
    userModel;
    logger = new common_1.Logger(ChatService_1.name);
    constructor(conversationModel, messageModel, propertyModel, userModel) {
        this.conversationModel = conversationModel;
        this.messageModel = messageModel;
        this.propertyModel = propertyModel;
        this.userModel = userModel;
    }
    async onModuleInit() {
        try {
            const col = this.conversationModel.collection;
            const indexes = await col.indexes();
            const badIndex = indexes.find(idx => idx.name === 'participants.userId_1_propertyId_1');
            if (badIndex && badIndex.unique) {
                this.logger.warn('Dropping legacy unique index participants.userId_1_propertyId_1');
                await col.dropIndex('participants.userId_1_propertyId_1');
            }
        }
        catch (e) {
        }
    }
    async createConversation(userId, dto) {
        try {
            const { participantId, propertyId, initialMessage } = dto;
            if (userId === participantId) {
                throw new common_1.BadRequestException('You cannot start a conversation with yourself');
            }
            if (!mongoose_2.Types.ObjectId.isValid(userId) || !mongoose_2.Types.ObjectId.isValid(participantId)) {
                throw new common_1.BadRequestException('Invalid user ID format');
            }
            if (propertyId && !mongoose_2.Types.ObjectId.isValid(propertyId)) {
                throw new common_1.BadRequestException('Invalid property ID format');
            }
            const [user, participant] = await Promise.all([
                this.userModel.findById(userId),
                this.userModel.findById(participantId),
            ]);
            if (!user || !participant) {
                throw new common_1.NotFoundException('User not found');
            }
            if (propertyId) {
                const property = await this.propertyModel.findById(propertyId);
                if (!property) {
                    throw new common_1.NotFoundException('Property not found');
                }
            }
            const existingConversation = await this.findExistingConversation(userId, participantId, propertyId);
            if (existingConversation) {
                this.logger.log(`Found existing conversation: ${existingConversation._id}`);
                return existingConversation;
            }
            const participants = [
                {
                    userId: new mongoose_2.Types.ObjectId(userId),
                    unreadCount: 0,
                    joinedAt: new Date(),
                },
                {
                    userId: new mongoose_2.Types.ObjectId(participantId),
                    unreadCount: initialMessage ? 1 : 0,
                    joinedAt: new Date(),
                },
            ];
            const conversation = await this.conversationModel.create({
                participants,
                propertyId: propertyId ? new mongoose_2.Types.ObjectId(propertyId) : undefined,
                messagesCount: 0,
            });
            if (initialMessage) {
                await this.sendMessage(userId, {
                    conversationId: conversation._id.toString(),
                    content: initialMessage,
                    type: message_schema_1.MessageType.TEXT,
                });
            }
            this.logger.log(`Created conversation: ${conversation._id}`);
            return conversation;
        }
        catch (error) {
            if (error?.code === 11000) {
                this.logger.warn('Duplicate key error on conversation creation, fetching existing conversation');
                const existing = await this.findExistingConversation(userId, dto.participantId, dto.propertyId);
                if (existing)
                    return existing;
            }
            this.logger.error('Error creating conversation:', error);
            throw error;
        }
    }
    async findExistingConversation(userId1, userId2, propertyId) {
        const u1 = new mongoose_2.Types.ObjectId(userId1);
        const u2 = new mongoose_2.Types.ObjectId(userId2);
        if (propertyId) {
            const propConv = await this.conversationModel
                .findOne({
                'participants.userId': { $all: [u1, u2] },
                propertyId: new mongoose_2.Types.ObjectId(propertyId),
            })
                .populate('participants.userId', 'name profilePicture email phoneNumber')
                .populate('propertyId', 'title images price address city')
                .exec();
            if (propConv)
                return propConv;
        }
        return this.conversationModel
            .findOne({
            'participants.userId': { $all: [u1, u2] },
        })
            .populate('participants.userId', 'name profilePicture email phoneNumber')
            .populate('propertyId', 'title images price address city')
            .exec();
    }
    async getConversations(userId, query) {
        try {
            const { page = 1, limit = 20, includeArchived = false, filter } = query;
            const skip = (page - 1) * limit;
            const matchQuery = {
                'participants.userId': new mongoose_2.Types.ObjectId(userId),
            };
            if (!includeArchived) {
                matchQuery.$or = [
                    { isArchived: false },
                    { archivedBy: { $ne: new mongoose_2.Types.ObjectId(userId) } },
                ];
            }
            if (filter === 'unread') {
                matchQuery['participants'] = {
                    $elemMatch: {
                        userId: new mongoose_2.Types.ObjectId(userId),
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
            const resolveId = (raw) => {
                if (!raw)
                    return '';
                if (typeof raw === 'string')
                    return raw;
                if (raw._id)
                    return raw._id.toString();
                if (typeof raw.toString === 'function')
                    return raw.toString();
                return '';
            };
            const formattedConversations = conversations.map(conv => {
                const currentUserParticipant = conv.participants.find(p => resolveId(p.userId) === userId);
                const otherParticipant = conv.participants.find(p => resolveId(p.userId) !== userId);
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
        }
        catch (error) {
            this.logger.error('Error getting conversations:', error);
            throw error;
        }
    }
    async getConversation(conversationId, userId) {
        const conversation = await this.conversationModel
            .findById(conversationId)
            .populate('participants.userId', 'name profilePicture email phoneNumber')
            .populate('propertyId', 'title images price address city')
            .exec();
        if (!conversation) {
            throw new common_1.NotFoundException('Conversation not found');
        }
        const isParticipant = conversation.participants.some(p => p.userId._id.toString() === userId);
        if (!isParticipant) {
            throw new common_1.ForbiddenException('You are not a participant in this conversation');
        }
        return conversation;
    }
    async sendMessage(userId, dto) {
        try {
            const { conversationId, content, type = message_schema_1.MessageType.TEXT, attachments = [], propertyId, replyTo } = dto;
            const conversation = await this.getConversation(conversationId, userId);
            let recipient = conversation.participants.find(p => p.userId._id.toString() !== userId);
            if (!recipient && conversation.participants.length > 0) {
                recipient = conversation.participants[0];
            }
            if (!recipient) {
                throw new common_1.BadRequestException('Recipient not found');
            }
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
            const message = await this.messageModel.create({
                conversationId: new mongoose_2.Types.ObjectId(conversationId),
                senderId: new mongoose_2.Types.ObjectId(userId),
                recipientId: recipient.userId._id,
                type,
                content,
                attachments: attachments || [],
                propertyReference,
                replyTo: replyTo ? new mongoose_2.Types.ObjectId(replyTo) : undefined,
                status: message_schema_1.MessageStatus.SENT,
            });
            await this.conversationModel.findByIdAndUpdate(conversationId, {
                $set: {
                    lastMessage: {
                        content: content || `Sent a ${type}`,
                        senderId: new mongoose_2.Types.ObjectId(userId),
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
            await message.populate('senderId', 'name profilePicture');
            return message;
        }
        catch (error) {
            this.logger.error('Error sending message:', error);
            throw error;
        }
    }
    async getMessages(conversationId, userId, query) {
        try {
            await this.getConversation(conversationId, userId);
            const { page = 1, limit = 50, before } = query;
            const skip = (page - 1) * limit;
            const matchQuery = {
                conversationId: new mongoose_2.Types.ObjectId(conversationId),
                isDeleted: false,
            };
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
                messages: messages.reverse(),
                total,
                page,
                totalPages: Math.ceil(total / limit),
                hasMore: skip + messages.length < total,
            };
        }
        catch (error) {
            this.logger.error('Error getting messages:', error);
            throw error;
        }
    }
    async markMessagesAsRead(conversationId, userId, messageIds) {
        try {
            await this.getConversation(conversationId, userId);
            const now = new Date();
            await this.messageModel.updateMany({
                _id: { $in: messageIds.map(id => new mongoose_2.Types.ObjectId(id)) },
                recipientId: new mongoose_2.Types.ObjectId(userId),
                status: { $ne: message_schema_1.MessageStatus.READ },
            }, {
                $set: {
                    status: message_schema_1.MessageStatus.READ,
                    readAt: now,
                },
            });
            await this.conversationModel.updateOne({
                _id: new mongoose_2.Types.ObjectId(conversationId),
                'participants.userId': new mongoose_2.Types.ObjectId(userId),
            }, {
                $set: {
                    'participants.$.unreadCount': 0,
                    'participants.$.lastReadAt': now,
                },
            });
            this.logger.log(`Marked ${messageIds.length} messages as read in ${conversationId}`);
        }
        catch (error) {
            this.logger.error('Error marking messages as read:', error);
            throw error;
        }
    }
    async updateMessageStatus(messageId, status) {
        await this.messageModel.findByIdAndUpdate(messageId, {
            status,
            ...(status === message_schema_1.MessageStatus.DELIVERED && { deliveredAt: new Date() }),
            ...(status === message_schema_1.MessageStatus.READ && { readAt: new Date() }),
        });
    }
    async editMessage(messageId, userId, dto) {
        const message = await this.messageModel.findById(messageId);
        if (!message) {
            throw new common_1.NotFoundException('Message not found');
        }
        if (message.senderId.toString() !== userId) {
            throw new common_1.ForbiddenException('You can only edit your own messages');
        }
        const updatedMessage = await this.messageModel.findByIdAndUpdate(messageId, {
            content: dto.content,
            isEdited: true,
            editedAt: new Date(),
        }, { new: true });
        if (!updatedMessage) {
            throw new common_1.NotFoundException('Message not found after update');
        }
        return updatedMessage;
    }
    async deleteMessage(messageId, userId) {
        const message = await this.messageModel.findById(messageId);
        if (!message) {
            throw new common_1.NotFoundException('Message not found');
        }
        if (message.senderId.toString() !== userId) {
            throw new common_1.ForbiddenException('You can only delete your own messages');
        }
        await this.messageModel.findByIdAndUpdate(messageId, {
            isDeleted: true,
            deletedAt: new Date(),
        });
    }
    async archiveConversation(conversationId, userId, archive) {
        const conversation = await this.getConversation(conversationId, userId);
        const userObjectId = new mongoose_2.Types.ObjectId(userId);
        if (archive) {
            await this.conversationModel.findByIdAndUpdate(conversationId, { $addToSet: { archivedBy: userObjectId } });
        }
        else {
            await this.conversationModel.findByIdAndUpdate(conversationId, { $pull: { archivedBy: userObjectId } });
        }
        const updatedConversation = await this.conversationModel
            .findById(conversationId)
            .populate('participants.userId', 'name profilePicture email phoneNumber')
            .populate('propertyId', 'title images price address city')
            .exec();
        if (!updatedConversation) {
            throw new common_1.NotFoundException('Conversation not found after update');
        }
        return updatedConversation;
    }
    async deleteConversation(conversationId, userId) {
        await this.archiveConversation(conversationId, userId, true);
    }
    async getUnreadCount(userId) {
        const conversations = await this.conversationModel.find({
            'participants.userId': new mongoose_2.Types.ObjectId(userId),
        });
        let totalUnread = 0;
        for (const conv of conversations) {
            const userParticipant = conv.participants.find(p => p.userId.toString() === userId);
            if (userParticipant) {
                totalUnread += userParticipant.unreadCount;
            }
        }
        return totalUnread;
    }
    async updateTypingIndicator(conversationId, userId, isTyping) {
        await this.conversationModel.findByIdAndUpdate(conversationId, {
            $set: {
                [`typingUsers.${userId}`]: isTyping,
            },
        });
    }
    async updateOnlineStatus(userId, status) {
        await this.conversationModel.updateMany({ 'participants.userId': new mongoose_2.Types.ObjectId(userId) }, {
            $set: {
                [`onlineStatus.${userId}`]: status,
            },
        });
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = ChatService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(conversation_schema_1.Conversation.name)),
    __param(1, (0, mongoose_1.InjectModel)(message_schema_1.Message.name)),
    __param(2, (0, mongoose_1.InjectModel)(property_schema_1.Property.name)),
    __param(3, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], ChatService);
//# sourceMappingURL=chat.service.js.map