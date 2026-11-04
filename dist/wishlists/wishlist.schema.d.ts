import { Document, Types } from 'mongoose';
export type WishlistDocument = Wishlist & Document;
export declare class Wishlist {
    _id: Types.ObjectId;
    ownerId: Types.ObjectId;
    name: string;
    propertyIds: Types.ObjectId[];
    shareToken?: string;
    createdAt?: Date;
    updatedAt?: Date;
}
export declare const WishlistSchema: import("mongoose").Schema<Wishlist, import("mongoose").Model<Wishlist, any, any, any, Document<unknown, any, Wishlist, any, {}> & Wishlist & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Wishlist, Document<unknown, {}, import("mongoose").FlatRecord<Wishlist>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Wishlist> & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>;
