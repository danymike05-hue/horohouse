import { Document, Types } from 'mongoose';
export declare enum ReviewType {
    PROPERTY = "property",
    AGENT = "agent",
    STAY = "stay",
    GUEST = "guest",
    INSIGHT = "insight"
}
export declare enum ReviewerRole {
    GUEST = "guest",
    HOST = "host"
}
export declare class Review {
    userId: Types.ObjectId;
    userName: string;
    reviewType: ReviewType;
    reviewerRole: ReviewerRole;
    propertyId?: Types.ObjectId;
    agentId?: Types.ObjectId;
    bookingId?: Types.ObjectId;
    insightId?: Types.ObjectId;
    reviewedUserId?: Types.ObjectId;
    rating: number;
    staySubRatings?: {
        cleanliness?: number;
        accuracy?: number;
        checkIn?: number;
        communication?: number;
        location?: number;
        value?: number;
    };
    guestSubRatings?: {
        communication?: number;
        cleanliness?: number;
        rules?: number;
    };
    comment?: string;
    images?: string[];
    verified: boolean;
    bookingVerified: boolean;
    isPublished: boolean;
    isActive: boolean;
    publishDeadline?: Date;
    response?: string;
    respondedBy?: Types.ObjectId;
    respondedAt?: Date;
    helpfulBy?: Types.ObjectId[];
    helpfulCount?: number;
}
export type ReviewDocument = Review & Document;
export declare const ReviewSchema: import("mongoose").Schema<Review, import("mongoose").Model<Review, any, any, any, Document<unknown, any, Review, any, {}> & Review & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Review, Document<unknown, {}, import("mongoose").FlatRecord<Review>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Review> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
export type NotificationDocument = Notification & Document;
export declare enum NotificationType {
    INQUIRY = "inquiry",
    FAVORITE = "favorite",
    PROPERTY_UPDATE = "property_update",
    MESSAGE = "message",
    SYSTEM = "system",
    BOOKING_REQUEST = "booking_request",
    BOOKING_CONFIRMED = "booking_confirmed",
    BOOKING_REJECTED = "booking_rejected",
    BOOKING_CANCELLED = "booking_cancelled",
    BOOKING_REMINDER = "booking_reminder",
    BOOKING_COMPLETED = "booking_completed",
    REVIEW_REQUEST = "review_request",
    REVIEW_RECEIVED = "review_received",
    REVIEW_PUBLISHED = "review_published",
    REVIEW_RESPONSE = "review_response",
    PAYMENT_RECEIVED = "payment_received",
    REFUND_PROCESSED = "refund_processed"
}
export declare class Notification {
    userId: Types.ObjectId;
    type: NotificationType;
    title: string;
    message: string;
    read: boolean;
    link?: string;
    metadata?: {
        propertyId?: string;
        inquiryId?: string;
        senderId?: string;
        bookingId?: string;
        reviewId?: string;
        checkIn?: string;
        checkOut?: string;
        guestName?: string;
        hostName?: string;
        propertyTitle?: string;
        amount?: number;
        currency?: string;
        [key: string]: any;
    };
    createdAt?: Date;
    updatedAt?: Date;
}
export declare const NotificationSchema: import("mongoose").Schema<Notification, import("mongoose").Model<Notification, any, any, any, Document<unknown, any, Notification, any, {}> & Notification & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Notification, Document<unknown, {}, import("mongoose").FlatRecord<Notification>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Notification> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
