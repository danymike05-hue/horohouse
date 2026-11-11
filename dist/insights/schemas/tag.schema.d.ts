import { Document, Types } from 'mongoose';
export type TagDocument = Tag & Document;
export declare class Tag {
    name: string;
    slug: string;
    description: string;
    usageCount: number;
    isActive: boolean;
}
export declare const TagSchema: import("mongoose").Schema<Tag, import("mongoose").Model<Tag, any, any, any, Document<unknown, any, Tag, any, {}> & Tag & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Tag, Document<unknown, {}, import("mongoose").FlatRecord<Tag>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Tag> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
