import { Document, Types } from 'mongoose';
export type AuthorProfileDocument = AuthorProfile & Document;
export declare enum AuthorRole {
    ADMIN_EDITOR = "admin_editor",
    EDITOR = "editor",
    AGENT_AUTHOR = "agent_author",
    CONTRIBUTOR = "contributor"
}
export declare class AuthorProfile {
    user: Types.ObjectId;
    displayName: string;
    slug: string;
    bio: string;
    avatar: string;
    title: string;
    specialties: string[];
    social: {
        twitter: string;
        linkedin: string;
        website: string;
    };
    role: AuthorRole;
    isActive: boolean;
    publishedPostCount: number;
    totalViewCount: number;
}
export declare const AuthorProfileSchema: import("mongoose").Schema<AuthorProfile, import("mongoose").Model<AuthorProfile, any, any, any, Document<unknown, any, AuthorProfile, any, {}> & AuthorProfile & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, AuthorProfile, Document<unknown, {}, import("mongoose").FlatRecord<AuthorProfile>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<AuthorProfile> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
