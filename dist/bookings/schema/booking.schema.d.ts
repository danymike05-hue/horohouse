import { Document, Types } from 'mongoose';
export type BookingDocument = Booking & Document;
export declare enum BookingStatus {
    PENDING = "pending",
    CONFIRMED = "confirmed",
    CANCELLED = "cancelled",
    COMPLETED = "completed",
    REJECTED = "rejected",
    NO_SHOW = "no_show"
}
export declare enum PaymentStatus {
    UNPAID = "unpaid",
    PAID = "paid",
    REFUNDED = "refunded",
    PARTIAL = "partial"
}
export declare enum CancellationPolicy {
    FLEXIBLE = "flexible",
    MODERATE = "moderate",
    STRICT = "strict",
    NO_REFUND = "no_refund"
}
export declare enum CancelledBy {
    GUEST = "guest",
    HOST = "host",
    ADMIN = "admin",
    SYSTEM = "system"
}
export interface BookingGuest {
    adults: number;
    children?: number;
    infants?: number;
}
export interface BookingPriceBreakdown {
    pricePerNight: number;
    nights: number;
    subtotal: number;
    cleaningFee: number;
    serviceFee: number;
    taxAmount: number;
    discountAmount: number;
    totalAmount: number;
}
export interface BookingCancellation {
    cancelledBy: CancelledBy;
    cancelledAt: Date;
    reason?: string;
    refundAmount?: number;
    refundStatus?: 'pending' | 'processed' | 'failed';
}
export declare class Booking {
    _id: Types.ObjectId;
    propertyId: Types.ObjectId;
    roomId?: Types.ObjectId;
    guestId: Types.ObjectId;
    hostId: Types.ObjectId;
    checkIn: Date;
    checkOut: Date;
    nights: number;
    guests: BookingGuest;
    priceBreakdown: BookingPriceBreakdown;
    currency: string;
    status: BookingStatus;
    paymentStatus: PaymentStatus;
    paymentReference?: string;
    paymentMethod?: string;
    paidAt?: Date;
    guestNote?: string;
    hostNote?: string;
    isInstantBook: boolean;
    confirmedAt?: Date;
    expiresAt?: Date;
    cancellation?: BookingCancellation;
    actualCheckIn?: Date;
    actualCheckOut?: Date;
    guestReviewLeft: boolean;
    hostReviewLeft: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const BookingSchema: import("mongoose").Schema<Booking, import("mongoose").Model<Booking, any, any, any, Document<unknown, any, Booking, any, {}> & Booking & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Booking, Document<unknown, {}, import("mongoose").FlatRecord<Booking>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Booking> & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>;
