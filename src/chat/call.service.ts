// src/chat/call.service.ts - FIXED VERSION
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Call, CallDocument, CallStatus, CallType, CallEndReason } from './schemas/call.schema';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';
import {
  InitiateCallDto,
  AnswerCallDto,
  DeclineCallDto,
  EndCallDto,
  UpdateCallQualityDto,
} from './dto/call.dto';

@Injectable()
export class CallService {
  private readonly logger = new Logger(CallService.name);

  constructor(
    @InjectModel(Call.name) private callModel: Model<CallDocument>,
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
  ) {}

  /**
   * Initiate a new call
   */
  async initiateCall(userId: string, dto: InitiateCallDto & { forceNew?: boolean }): Promise<Call> {
    try {
      const { conversationId, type, sdpOffer, forceNew } = dto;

      // Get conversation and validate user is participant
      const conversation = await this.conversationModel
        .findById(conversationId)
        .populate('participants.userId', 'name profilePicture');

      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      const isParticipant = conversation.participants.some(
        p => p.userId._id.toString() === userId,
      );

      if (!isParticipant) {
        throw new ForbiddenException('You are not a participant in this conversation');
      }

      // Get recipient
      const recipient = conversation.participants.find(
        p => p.userId._id.toString() !== userId,
      );

      if (!recipient) {
        throw new BadRequestException('Recipient not found');
      }

      // Check if there's an active call
      const activeCall = await this.callModel.findOne({
        conversationId: new Types.ObjectId(conversationId),
        status: { $in: [CallStatus.INITIATING, CallStatus.RINGING, CallStatus.CONNECTING, CallStatus.CONNECTED] },
      });

      if (activeCall) {
        if (forceNew) {
          // Force end the existing call
          this.logger.warn(`Force ending existing call ${activeCall._id} to start new call`);
          await this.callModel.findByIdAndUpdate(activeCall._id, {
            status: CallStatus.CANCELLED,
            endedAt: new Date(),
            endReason: CallEndReason.CANCELLED,
          });
        } else {
          throw new BadRequestException('There is already an active call in this conversation');
        }
      }

      // ADDITIONAL CHECK: Auto-cleanup stale calls (calls stuck in non-final states for >2 minutes)
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const staleCalls = await this.callModel.find({
        conversationId: new Types.ObjectId(conversationId),
        status: { $in: [CallStatus.INITIATING, CallStatus.RINGING, CallStatus.CONNECTING] },
        createdAt: { $lt: twoMinutesAgo },
      });

      if (staleCalls.length > 0) {
        this.logger.warn(`Found ${staleCalls.length} stale calls, cleaning up...`);
        await this.callModel.updateMany(
          {
            _id: { $in: staleCalls.map(c => c._id) },
          },
          {
            status: CallStatus.FAILED,
            endedAt: new Date(),
            endReason: CallEndReason.FAILED,
          },
        );
      }

      // Create call
      const call = await this.callModel.create({
        conversationId: new Types.ObjectId(conversationId),
        initiatorId: new Types.ObjectId(userId),
        recipientId: recipient.userId._id,
        type,
        status: CallStatus.INITIATING,
        participants: [
          {
            userId: new Types.ObjectId(userId),
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
    } catch (error) {
      this.logger.error('Error initiating call:', error);
      throw error;
    }
  }
  

  /**
   * Update call status to ringing
   */
  async setCallRinging(callId: string): Promise<Call> {
    const call = await this.callModel.findByIdAndUpdate(
      callId,
      { status: CallStatus.RINGING },
      { new: true },
    );

    if (!call) {
      throw new NotFoundException('Call not found');
    }

    return call;
  }

  /**
   * Answer a call
   */
  async answerCall(userId: string, dto: AnswerCallDto): Promise<Call> {
    try {
      const { callId, sdpAnswer } = dto;

      const call = await this.callModel.findById(callId);

      if (!call) {
        throw new NotFoundException('Call not found');
      }

      // Verify user is the recipient
      if (call.recipientId.toString() !== userId) {
        throw new ForbiddenException('You are not the recipient of this call');
      }

      // Check if call is in a valid state to be answered
      if (![CallStatus.INITIATING, CallStatus.RINGING].includes(call.status)) {
        throw new BadRequestException(`Cannot answer call in status: ${call.status}`);
      }

      // Update call status
      const updatedCall = await this.callModel.findByIdAndUpdate(
        callId,
        {
          status: CallStatus.CONNECTING,
          startedAt: new Date(),
          $push: {
            participants: {
              userId: new Types.ObjectId(userId),
              joinedAt: new Date(),
              status: 'connected',
            },
          },
          $set: {
            'metadata.sdp': sdpAnswer,
          },
        },
        { new: true },
      );

      this.logger.log(`Call answered: ${callId} by user ${userId}`);
      return updatedCall!;
    } catch (error) {
      this.logger.error('Error answering call:', error);
      throw error;
    }
  }

  /**
   * Mark call as connected
   */
  async setCallConnected(callId: string): Promise<Call> {
    const call = await this.callModel.findByIdAndUpdate(
      callId,
      {
        status: CallStatus.CONNECTED,
        'participants.$[elem].status': 'connected',
        'participants.$[elem].joinedAt': new Date(),
      },
      {
        new: true,
        arrayFilters: [{ 'elem.status': 'joining' }],
      },
    );

    if (!call) {
      throw new NotFoundException('Call not found');
    }

    this.logger.log(`Call connected: ${callId}`);
    return call;
  }

  /**
   * Decline a call
   */
  async declineCall(userId: string, dto: DeclineCallDto): Promise<Call> {
    try {
      const { callId, reason } = dto;

      const call = await this.callModel.findById(callId);

      if (!call) {
        throw new NotFoundException('Call not found');
      }

      // Verify user is the recipient
      if (call.recipientId.toString() !== userId) {
        throw new ForbiddenException('You are not the recipient of this call');
      }

      const updatedCall = await this.callModel.findByIdAndUpdate(
        callId,
        {
          status: CallStatus.DECLINED,
          endedAt: new Date(),
          endReason: CallEndReason.DECLINED,
        },
        { new: true },
      );

      this.logger.log(`Call declined: ${callId} by user ${userId}`);
      return updatedCall!;
    } catch (error) {
      this.logger.error('Error declining call:', error);
      throw error;
    }
  }

  /**
   * End a call
   */
  async endCall(userId: string, dto: EndCallDto): Promise<Call> {
    try {
      const { callId, reason = CallEndReason.COMPLETED, duration } = dto;

      const call = await this.callModel.findById(callId);

      if (!call) {
        throw new NotFoundException('Call not found');
      }

      // Verify user is participant
      const isParticipant =
        call.initiatorId.toString() === userId ||
        call.recipientId.toString() === userId;

      if (!isParticipant) {
        throw new ForbiddenException('You are not a participant in this call');
      }

      // Calculate duration if not provided
      let callDuration = duration;
      if (!callDuration && call.startedAt) {
        callDuration = Math.floor((Date.now() - call.startedAt.getTime()) / 1000);
      }

      const updatedCall = await this.callModel.findByIdAndUpdate(
        callId,
        {
          status: CallStatus.ENDED,
          endedAt: new Date(),
          endReason: reason,
          duration: callDuration || 0,
          'participants.$[elem].leftAt': new Date(),
          'participants.$[elem].status': 'disconnected',
        },
        {
          new: true,
          arrayFilters: [{ 'elem.userId': new Types.ObjectId(userId) }],
        },
      );

      this.logger.log(`Call ended: ${callId} by user ${userId}, reason: ${reason}`);
      return updatedCall!;
    } catch (error) {
      this.logger.error('Error ending call:', error);
      throw error;
    }
  }

  /**
   * Add ICE candidate
   */
  async addIceCandidate(callId: string, candidate: any): Promise<void> {
    await this.callModel.findByIdAndUpdate(callId, {
      $push: { 'metadata.candidates': candidate },
    });
  }

  /**
   * Update call quality metrics
   */
  async updateCallQuality(dto: UpdateCallQualityDto): Promise<Call> {
    const { callId, audioQuality, videoQuality, networkIssues } = dto;

    const updateData: any = {};
    if (audioQuality !== undefined) updateData['quality.audioQuality'] = audioQuality;
    if (videoQuality !== undefined) updateData['quality.videoQuality'] = videoQuality;
    if (networkIssues !== undefined) updateData['quality.networkIssues'] = networkIssues;

    const call = await this.callModel.findByIdAndUpdate(callId, updateData, { new: true });

    if (!call) {
      throw new NotFoundException('Call not found');
    }

    return call;
  }

  /**
   * Get call by ID
   */
  async getCall(callId: string): Promise<Call> {
    const call = await this.callModel
      .findById(callId)
      .populate('initiatorId', 'name profilePicture')
      .populate('recipientId', 'name profilePicture');

    if (!call) {
      throw new NotFoundException('Call not found');
    }

    return call;
  }

  /**
   * Get call history for a conversation
   */
  async getCallHistory(conversationId: string, userId: string, limit = 20): Promise<Call[]> {
    return this.callModel
      .find({
        conversationId: new Types.ObjectId(conversationId),
        $or: [
          { initiatorId: new Types.ObjectId(userId) },
          { recipientId: new Types.ObjectId(userId) },
        ],
      })
      .populate('initiatorId', 'name profilePicture')
      .populate('recipientId', 'name profilePicture')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Get user's call history
   */
  async getUserCallHistory(userId: string, limit = 50): Promise<Call[]> {
    return this.callModel
      .find({
        $or: [
          { initiatorId: new Types.ObjectId(userId) },
          { recipientId: new Types.ObjectId(userId) },
        ],
      })
      .populate('initiatorId', 'name profilePicture')
      .populate('recipientId', 'name profilePicture')
      .populate('conversationId')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Mark missed calls
   */
  async markCallAsMissed(callId: string): Promise<Call> {
    const call = await this.callModel.findByIdAndUpdate(
      callId,
      {
        status: CallStatus.MISSED,
        endedAt: new Date(),
        endReason: CallEndReason.MISSED,
      },
      { new: true },
    );

    if (!call) {
      throw new NotFoundException('Call not found');
    }

    return call;
  }

  /**
   * NEW: Clean up stale calls for a conversation
   * This is a utility method that can be called periodically or before initiating calls
   */
  async cleanupStaleCalls(conversationId: string): Promise<number> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const result = await this.callModel.updateMany(
      {
        conversationId: new Types.ObjectId(conversationId),
        status: { $in: [CallStatus.INITIATING, CallStatus.RINGING, CallStatus.CONNECTING] },
        createdAt: { $lt: fiveMinutesAgo },
      },
      {
        status: CallStatus.FAILED,
        endedAt: new Date(),
        endReason: CallEndReason.FAILED,
      },
    );

    if (result.modifiedCount > 0) {
      this.logger.log(`Cleaned up ${result.modifiedCount} stale calls for conversation ${conversationId}`);
    }

    return result.modifiedCount;
  }
}