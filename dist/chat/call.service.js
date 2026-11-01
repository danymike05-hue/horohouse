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
var CallService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const call_schema_1 = require("./schemas/call.schema");
const conversation_schema_1 = require("./schemas/conversation.schema");
let CallService = CallService_1 = class CallService {
    callModel;
    conversationModel;
    logger = new common_1.Logger(CallService_1.name);
    constructor(callModel, conversationModel) {
        this.callModel = callModel;
        this.conversationModel = conversationModel;
    }
    async initiateCall(userId, dto) {
        try {
            const { conversationId, type, sdpOffer, forceNew } = dto;
            const conversation = await this.conversationModel
                .findById(conversationId)
                .populate('participants.userId', 'name profilePicture');
            if (!conversation) {
                throw new common_1.NotFoundException('Conversation not found');
            }
            const isParticipant = conversation.participants.some(p => p.userId._id.toString() === userId);
            if (!isParticipant) {
                throw new common_1.ForbiddenException('You are not a participant in this conversation');
            }
            const recipient = conversation.participants.find(p => p.userId._id.toString() !== userId);
            if (!recipient) {
                throw new common_1.BadRequestException('Recipient not found');
            }
            const activeCall = await this.callModel.findOne({
                conversationId: new mongoose_2.Types.ObjectId(conversationId),
                status: { $in: [call_schema_1.CallStatus.INITIATING, call_schema_1.CallStatus.RINGING, call_schema_1.CallStatus.CONNECTING, call_schema_1.CallStatus.CONNECTED] },
            });
            if (activeCall) {
                if (forceNew) {
                    this.logger.warn(`Force ending existing call ${activeCall._id} to start new call`);
                    await this.callModel.findByIdAndUpdate(activeCall._id, {
                        status: call_schema_1.CallStatus.CANCELLED,
                        endedAt: new Date(),
                        endReason: call_schema_1.CallEndReason.CANCELLED,
                    });
                }
                else {
                    throw new common_1.BadRequestException('There is already an active call in this conversation');
                }
            }
            const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
            const staleCalls = await this.callModel.find({
                conversationId: new mongoose_2.Types.ObjectId(conversationId),
                status: { $in: [call_schema_1.CallStatus.INITIATING, call_schema_1.CallStatus.RINGING, call_schema_1.CallStatus.CONNECTING] },
                createdAt: { $lt: twoMinutesAgo },
            });
            if (staleCalls.length > 0) {
                this.logger.warn(`Found ${staleCalls.length} stale calls, cleaning up...`);
                await this.callModel.updateMany({
                    _id: { $in: staleCalls.map(c => c._id) },
                }, {
                    status: call_schema_1.CallStatus.FAILED,
                    endedAt: new Date(),
                    endReason: call_schema_1.CallEndReason.FAILED,
                });
            }
            const call = await this.callModel.create({
                conversationId: new mongoose_2.Types.ObjectId(conversationId),
                initiatorId: new mongoose_2.Types.ObjectId(userId),
                recipientId: recipient.userId._id,
                type,
                status: call_schema_1.CallStatus.INITIATING,
                participants: [
                    {
                        userId: new mongoose_2.Types.ObjectId(userId),
                        status: 'joining',
                    },
                ],
                metadata: {
                    sdp: sdpOffer,
                    candidates: [],
                },
            });
            this.logger.log(`Call initiated: ${call._id} by user ${userId}`);
            return call;
        }
        catch (error) {
            this.logger.error('Error initiating call:', error);
            throw error;
        }
    }
    async setCallRinging(callId) {
        const call = await this.callModel.findByIdAndUpdate(callId, { status: call_schema_1.CallStatus.RINGING }, { new: true });
        if (!call) {
            throw new common_1.NotFoundException('Call not found');
        }
        return call;
    }
    async answerCall(userId, dto) {
        try {
            const { callId, sdpAnswer } = dto;
            const call = await this.callModel.findById(callId);
            if (!call) {
                throw new common_1.NotFoundException('Call not found');
            }
            if (call.recipientId.toString() !== userId) {
                throw new common_1.ForbiddenException('You are not the recipient of this call');
            }
            if (![call_schema_1.CallStatus.INITIATING, call_schema_1.CallStatus.RINGING].includes(call.status)) {
                throw new common_1.BadRequestException(`Cannot answer call in status: ${call.status}`);
            }
            const updatedCall = await this.callModel.findByIdAndUpdate(callId, {
                status: call_schema_1.CallStatus.CONNECTING,
                startedAt: new Date(),
                $push: {
                    participants: {
                        userId: new mongoose_2.Types.ObjectId(userId),
                        joinedAt: new Date(),
                        status: 'connected',
                    },
                },
                $set: {
                    'metadata.sdp': sdpAnswer,
                },
            }, { new: true });
            this.logger.log(`Call answered: ${callId} by user ${userId}`);
            return updatedCall;
        }
        catch (error) {
            this.logger.error('Error answering call:', error);
            throw error;
        }
    }
    async setCallConnected(callId) {
        const call = await this.callModel.findByIdAndUpdate(callId, {
            status: call_schema_1.CallStatus.CONNECTED,
            'participants.$[elem].status': 'connected',
            'participants.$[elem].joinedAt': new Date(),
        }, {
            new: true,
            arrayFilters: [{ 'elem.status': 'joining' }],
        });
        if (!call) {
            throw new common_1.NotFoundException('Call not found');
        }
        this.logger.log(`Call connected: ${callId}`);
        return call;
    }
    async declineCall(userId, dto) {
        try {
            const { callId, reason } = dto;
            const call = await this.callModel.findById(callId);
            if (!call) {
                throw new common_1.NotFoundException('Call not found');
            }
            if (call.recipientId.toString() !== userId) {
                throw new common_1.ForbiddenException('You are not the recipient of this call');
            }
            const updatedCall = await this.callModel.findByIdAndUpdate(callId, {
                status: call_schema_1.CallStatus.DECLINED,
                endedAt: new Date(),
                endReason: call_schema_1.CallEndReason.DECLINED,
            }, { new: true });
            this.logger.log(`Call declined: ${callId} by user ${userId}`);
            return updatedCall;
        }
        catch (error) {
            this.logger.error('Error declining call:', error);
            throw error;
        }
    }
    async endCall(userId, dto) {
        try {
            const { callId, reason = call_schema_1.CallEndReason.COMPLETED, duration } = dto;
            const call = await this.callModel.findById(callId);
            if (!call) {
                throw new common_1.NotFoundException('Call not found');
            }
            const isParticipant = call.initiatorId.toString() === userId ||
                call.recipientId.toString() === userId;
            if (!isParticipant) {
                throw new common_1.ForbiddenException('You are not a participant in this call');
            }
            let callDuration = duration;
            if (!callDuration && call.startedAt) {
                callDuration = Math.floor((Date.now() - call.startedAt.getTime()) / 1000);
            }
            const updatedCall = await this.callModel.findByIdAndUpdate(callId, {
                status: call_schema_1.CallStatus.ENDED,
                endedAt: new Date(),
                endReason: reason,
                duration: callDuration || 0,
                'participants.$[elem].leftAt': new Date(),
                'participants.$[elem].status': 'disconnected',
            }, {
                new: true,
                arrayFilters: [{ 'elem.userId': new mongoose_2.Types.ObjectId(userId) }],
            });
            this.logger.log(`Call ended: ${callId} by user ${userId}, reason: ${reason}`);
            return updatedCall;
        }
        catch (error) {
            this.logger.error('Error ending call:', error);
            throw error;
        }
    }
    async addIceCandidate(callId, candidate) {
        await this.callModel.findByIdAndUpdate(callId, {
            $push: { 'metadata.candidates': candidate },
        });
    }
    async updateCallQuality(dto) {
        const { callId, audioQuality, videoQuality, networkIssues } = dto;
        const updateData = {};
        if (audioQuality !== undefined)
            updateData['quality.audioQuality'] = audioQuality;
        if (videoQuality !== undefined)
            updateData['quality.videoQuality'] = videoQuality;
        if (networkIssues !== undefined)
            updateData['quality.networkIssues'] = networkIssues;
        const call = await this.callModel.findByIdAndUpdate(callId, updateData, { new: true });
        if (!call) {
            throw new common_1.NotFoundException('Call not found');
        }
        return call;
    }
    async getCall(callId) {
        const call = await this.callModel
            .findById(callId)
            .populate('initiatorId', 'name profilePicture')
            .populate('recipientId', 'name profilePicture');
        if (!call) {
            throw new common_1.NotFoundException('Call not found');
        }
        return call;
    }
    async getCallHistory(conversationId, userId, limit = 20) {
        return this.callModel
            .find({
            conversationId: new mongoose_2.Types.ObjectId(conversationId),
            $or: [
                { initiatorId: new mongoose_2.Types.ObjectId(userId) },
                { recipientId: new mongoose_2.Types.ObjectId(userId) },
            ],
        })
            .populate('initiatorId', 'name profilePicture')
            .populate('recipientId', 'name profilePicture')
            .sort({ createdAt: -1 })
            .limit(limit)
            .exec();
    }
    async getUserCallHistory(userId, limit = 50) {
        return this.callModel
            .find({
            $or: [
                { initiatorId: new mongoose_2.Types.ObjectId(userId) },
                { recipientId: new mongoose_2.Types.ObjectId(userId) },
            ],
        })
            .populate('initiatorId', 'name profilePicture')
            .populate('recipientId', 'name profilePicture')
            .populate('conversationId')
            .sort({ createdAt: -1 })
            .limit(limit)
            .exec();
    }
    async markCallAsMissed(callId) {
        const call = await this.callModel.findByIdAndUpdate(callId, {
            status: call_schema_1.CallStatus.MISSED,
            endedAt: new Date(),
            endReason: call_schema_1.CallEndReason.MISSED,
        }, { new: true });
        if (!call) {
            throw new common_1.NotFoundException('Call not found');
        }
        return call;
    }
    async cleanupStaleCalls(conversationId) {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const result = await this.callModel.updateMany({
            conversationId: new mongoose_2.Types.ObjectId(conversationId),
            status: { $in: [call_schema_1.CallStatus.INITIATING, call_schema_1.CallStatus.RINGING, call_schema_1.CallStatus.CONNECTING] },
            createdAt: { $lt: fiveMinutesAgo },
        }, {
            status: call_schema_1.CallStatus.FAILED,
            endedAt: new Date(),
            endReason: call_schema_1.CallEndReason.FAILED,
        });
        if (result.modifiedCount > 0) {
            this.logger.log(`Cleaned up ${result.modifiedCount} stale calls for conversation ${conversationId}`);
        }
        return result.modifiedCount;
    }
};
exports.CallService = CallService;
exports.CallService = CallService = CallService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(call_schema_1.Call.name)),
    __param(1, (0, mongoose_1.InjectModel)(conversation_schema_1.Conversation.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], CallService);
//# sourceMappingURL=call.service.js.map