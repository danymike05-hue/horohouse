import { Document, Types } from 'mongoose';
export type CategoryDocument = Category & Document;
export declare class Category {
    name: string;
    slug: string;
    description: string;
    icon: string;
    coverImage: string;
    accentColor: string;
    metaTitle: string;
    metaDescription: string;
    postCount: number;
    isActive: boolean;
    sortOrder: number;
}
export declare const CategorySchema: import("mongoose").Schema<Category, import("mongoose").Model<Category, any, any, any, Document<unknown, any, Category, any, {}> & Category & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Category, Document<unknown, {}, import("mongoose").FlatRecord<Category>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Category> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
