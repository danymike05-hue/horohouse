import { HostMessagesService } from './host-messages.service';
import { CheckInGuideDto, CreateTemplateDto, UpdateTemplateDto } from './dto/host-messages.dto';
import { TemplateKind } from './schemas/host-message.schema';
export declare class HostMessagesController {
    private readonly service;
    constructor(service: HostMessagesService);
    list(req: any, kind?: TemplateKind): Promise<(import("mongoose").FlattenMaps<import("./schemas/host-message.schema").HostMessageTemplateDocument> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    create(req: any, dto: CreateTemplateDto): Promise<import("./schemas/host-message.schema").HostMessageTemplate & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
    update(req: any, id: string, dto: UpdateTemplateDto): Promise<(import("mongoose").FlattenMaps<import("./schemas/host-message.schema").HostMessageTemplateDocument> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }) | null>;
    remove(req: any, id: string): Promise<{
        deleted: boolean;
    }>;
    quickReplies(req: any, guestId?: string, propertyId?: string): Promise<{
        id: string;
        title: string;
        text: string;
    }[]>;
    getGuide(req: any, propertyId: string): Promise<any>;
    putGuide(req: any, propertyId: string, dto: CheckInGuideDto): Promise<any>;
    addPhoto(req: any, propertyId: string, caption?: string): Promise<any>;
    removePhoto(req: any, propertyId: string, publicId: string): Promise<any>;
    guideForBooking(req: any, bookingId: string): Promise<{
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
    messages(req: any, bookingId: string): Promise<(import("mongoose").FlattenMaps<import("./schemas/host-message.schema").HostMessageDeliveryDocument> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
}
