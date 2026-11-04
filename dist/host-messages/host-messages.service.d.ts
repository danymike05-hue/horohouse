import { Model, Types } from 'mongoose';
import { HostMessageDeliveryDocument, HostMessageTemplate, HostMessageTemplateDocument, TemplateKind } from './schemas/host-message.schema';
import { CheckInGuideDto, CreateTemplateDto, UpdateTemplateDto } from './dto/host-messages.dto';
import { PropertyDocument } from '../properties/schemas/property.schema';
import { BookingDocument } from '../bookings/schema/booking.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { ModuleRef } from '@nestjs/core';
export declare const GUIDE_DAYS_BEFORE = 2;
export declare const TEMPLATE_TOKENS: readonly ["guest_name", "host_name", "listing", "check_in_date", "check_out_date", "check_in_time", "check_out_time", "nights", "guests", "address", "wifi_name", "wifi_password"];
export declare function renderTemplate(body: string, ctx: Partial<Record<(typeof TEMPLATE_TOKENS)[number], string>>): string;
export declare function dueAt(date: Date, shiftDays: number, hhmm: string): Date;
export declare function dueFor(t: Pick<HostMessageTemplate, 'trigger' | 'daysOffset' | 'sendTime'>, b: any): Date | null;
export declare class HostMessagesService {
    private readonly templateModel;
    private readonly deliveryModel;
    private readonly propertyModel;
    private readonly bookingModel;
    private readonly userModel;
    private readonly moduleRef;
    private readonly notifications?;
    private readonly logger;
    constructor(templateModel: Model<HostMessageTemplateDocument>, deliveryModel: Model<HostMessageDeliveryDocument>, propertyModel: Model<PropertyDocument>, bookingModel: Model<BookingDocument>, userModel: Model<UserDocument>, moduleRef: ModuleRef, notifications?: NotificationsService | undefined);
    private postToChat;
    listTemplates(user: User, kind?: TemplateKind): Promise<(import("mongoose").FlattenMaps<HostMessageTemplateDocument> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    private assertOwnListings;
    private checkScheduled;
    createTemplate(user: User, dto: CreateTemplateDto): Promise<HostMessageTemplate & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }>;
    updateTemplate(user: User, id: string, dto: UpdateTemplateDto): Promise<(import("mongoose").FlattenMaps<HostMessageTemplateDocument> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }) | null>;
    deleteTemplate(user: User, id: string): Promise<{
        deleted: boolean;
    }>;
    private contextFor;
    quickReplies(user: User, guestId?: string, propertyId?: string): Promise<{
        id: string;
        title: string;
        text: string;
    }[]>;
    private loadOwnedProperty;
    private signPhotos;
    static guideHasContent(g: any): boolean;
    getGuideForHost(propertyId: string, user: User): Promise<any>;
    updateGuide(propertyId: string, dto: CheckInGuideDto, user: User): Promise<any>;
    addGuidePhoto(propertyId: string, buffer: Buffer, caption: string | undefined, user: User): Promise<any>;
    removeGuidePhoto(propertyId: string, publicId: string, user: User): Promise<any>;
    private loadBookingFor;
    getGuideForBooking(bookingId: string, user: User): Promise<{
        reason: string;
        available: boolean;
        hasGuide: boolean;
        availableFrom: Date;
        listing: {
            title: any;
        };
        checkInTime: any;
        checkOutTime: any;
    } | {
        address: string;
        latitude: any;
        longitude: any;
        checkInMethod: any;
        guide: any;
        available: boolean;
        hasGuide: boolean;
        availableFrom: Date;
        listing: {
            title: any;
        };
        checkInTime: any;
        checkOutTime: any;
    }>;
    messagesForBooking(bookingId: string, user: User): Promise<(import("mongoose").FlattenMaps<HostMessageDeliveryDocument> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    runScheduledMessages(now?: Date): Promise<number>;
    private deliver;
    sendCheckInGuideNotices(now?: Date): Promise<number>;
}
