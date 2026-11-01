import { Document } from 'mongoose';
export type NewsletterDocument = Newsletter & Document;
export declare class Newsletter {
    email: string;
    isActive: boolean;
}
export declare const NewsletterSchema: import("mongoose").Schema<Newsletter, import("mongoose").Model<Newsletter, any, any, any, Document<unknown, any, Newsletter, any, {}> & Newsletter & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Newsletter, Document<unknown, {}, import("mongoose").FlatRecord<Newsletter>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Newsletter> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
