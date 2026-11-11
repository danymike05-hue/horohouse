import { Document, Types } from 'mongoose';
export type ComparisonDocument = Comparison & Document;
export declare class Comparison {
    userId: Types.ObjectId;
    name: string;
    propertyIds: Types.ObjectId[];
    isPublic: boolean;
    shareToken?: string;
    viewsCount: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare const ComparisonSchema: import("mongoose").Schema<Comparison, import("mongoose").Model<Comparison, any, any, any, Document<unknown, any, Comparison, any, {}> & Comparison & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Comparison, Document<unknown, {}, import("mongoose").FlatRecord<Comparison>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Comparison> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
