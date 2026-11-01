import { CallEndReason, CallType } from '../schemas/call.schema';
export declare class InitiateCallDto {
    conversationId: string;
    type: CallType;
    sdpOffer?: any;
}
export declare class AnswerCallDto {
    callId: string;
    sdpAnswer?: any;
}
export declare class DeclineCallDto {
    callId: string;
    reason?: string;
}
export declare class EndCallDto {
    callId: string;
    reason?: CallEndReason;
    duration?: number;
}
export declare class IceCandidateDto {
    callId: string;
    candidate: any;
}
export declare class UpdateCallQualityDto {
    callId: string;
    audioQuality?: number;
    videoQuality?: number;
    networkIssues?: number;
}
