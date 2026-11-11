import { Model } from 'mongoose';
import { Call, CallDocument } from './schemas/call.schema';
import { ConversationDocument } from './schemas/conversation.schema';
import { InitiateCallDto, AnswerCallDto, DeclineCallDto, EndCallDto, UpdateCallQualityDto } from './dto/call.dto';
export declare class CallService {
    private callModel;
    private conversationModel;
    private readonly logger;
    constructor(callModel: Model<CallDocument>, conversationModel: Model<ConversationDocument>);
    initiateCall(userId: string, dto: InitiateCallDto & {
        forceNew?: boolean;
    }): Promise<Call>;
    setCallRinging(callId: string): Promise<Call>;
    answerCall(userId: string, dto: AnswerCallDto): Promise<Call>;
    setCallConnected(callId: string): Promise<Call>;
    declineCall(userId: string, dto: DeclineCallDto): Promise<Call>;
    endCall(userId: string, dto: EndCallDto): Promise<Call>;
    addIceCandidate(callId: string, candidate: any): Promise<void>;
    updateCallQuality(dto: UpdateCallQualityDto): Promise<Call>;
    getCall(callId: string): Promise<Call>;
    getCallHistory(conversationId: string, userId: string, limit?: number): Promise<Call[]>;
    getUserCallHistory(userId: string, limit?: number): Promise<Call[]>;
    markCallAsMissed(callId: string): Promise<Call>;
    cleanupStaleCalls(conversationId: string): Promise<number>;
}
