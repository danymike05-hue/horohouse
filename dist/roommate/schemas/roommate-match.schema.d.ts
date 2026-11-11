import { Document, Types } from 'mongoose';
import { MatchStatus } from './roommate-profile.schema';
export type RoommateMatchDocument = RoommateMatch & Document;
export declare class RoommateMatch {
    initiatorId: Types.ObjectId;
    receiverId: Types.ObjectId;
    initiatorProfileId: Types.ObjectId;
    receiverProfileId: Types.ObjectId;
    status: MatchStatus;
    compatibilityScore: number;
    chatRoomId?: Types.ObjectId;
    matchedAt?: Date;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const RoommateMatchSchema: import("mongoose").Schema<RoommateMatch, import("mongoose").Model<RoommateMatch, any, any, any, Document<unknown, any, RoommateMatch, any, {}> & RoommateMatch & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, RoommateMatch, Document<unknown, {}, import("mongoose").FlatRecord<RoommateMatch>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<RoommateMatch> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
