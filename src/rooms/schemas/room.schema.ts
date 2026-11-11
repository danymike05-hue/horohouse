import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RoomDocument = Room & Document;

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum RoomType {
    SINGLE = 'single',
    DOUBLE = 'double',
    TWIN = 'twin',
    SUITE = 'suite',
    DORMITORY = 'dormitory',
    DELUXE = 'deluxe',
    FAMILY = 'family',
    PENTHOUSE = 'penthouse',
    STUDIO = 'studio',
}

export enum BedType {
    SINGLE = 'single',
    DOUBLE = 'double',
    QUEEN = 'queen',
    KING = 'king',
    BUNK = 'bunk',
    SOFA = 'sofa_bed',
}

// ─── Sub-document interfaces ──────────────────────────────────────────────────

export interface RoomImage {
    url: string;
    publicId: string;
    caption?: string;
}

/** A date range blocked on this specific room (off-platform booking or maintenance). */
export interface RoomUnavailableDateRange {
    from: Date;
    to: Date;
    reason?: string;    // 'external_booking' | 'maintenance' | 'owner_use' | custom
    source?: string;    // 'manual' | 'ical' | 'platform_booking'
}

// ─── Schema ───────────────────────────────────────────────────────────────────

@Schema({ timestamps: true })
export class Room {
    _id!: Types.ObjectId;

    // ── Parent property ──────────────────────────────────────────────────────

    /** The hotel / hostel / motel this room belongs to */
    @Prop({ type: Types.ObjectId, ref: 'Property', required: true, index: true })
    propertyId: Types.ObjectId;

    // ── Identity ─────────────────────────────────────────────────────────────

    /** Human-readable name, e.g. "Deluxe Double — Sea View" */
    @Prop({ required: true, trim: true })
    name: string;

    /** Physical room identifier, e.g. "101", "2B", "Dorm-3" */
    @Prop({ trim: true })
    roomNumber?: string;

    @Prop({
        type: String,
        enum: Object.values(RoomType),
        required: true,
    })
    roomType: RoomType;

    // ── Capacity & bedding ────────────────────────────────────────────────────

    /** Maximum number of guests this room can accommodate */
    @Prop({ required: true, min: 1, default: 2 })
    maxGuests: number;

    /** Number of beds in the room */
    @Prop({ default: 1, min: 1 })
    bedCount: number;

    /**
     * How many identical rooms of this type the hotel has (e.g. 10 "Standard Double").
     * Availability allows that many overlapping bookings per night. Older rooms = 1.
     */
    @Prop({ default: 1, min: 1 })
    quantity: number;

    /** Short guest-facing description, e.g. "City view, recently renovated, minibar" */
    @Prop({ trim: true, maxlength: 500 })
    description?: string;

    @Prop({
        type: String,
        enum: Object.values(BedType),
        default: BedType.DOUBLE,
    })
    bedType: BedType;

    // ── Pricing ───────────────────────────────────────────────────────────────

    /**
     * Per-night price for this specific room.
     * If undefined, falls back to Property.price.
     */
    @Prop({ min: 0 })
    price?: number;

    /** One-time cleaning fee specific to this room (overrides property-level if set). */
    @Prop({ min: 0 })
    cleaningFee?: number;

    /** Room size in m² (shown to guests as "25 m²") */
    @Prop({ min: 0, max: 5000 })
    sizeSqm?: number;

    /**
     * Breakfast, per guest per night (XAF). When set, guests can pick the
     * "Includes breakfast" rate; 0 / unset = no breakfast option.
     */
    @Prop({ min: 0 })
    breakfastPrice?: number;

    // ── Amenities ─────────────────────────────────────────────────────────────

    @Prop({ type: Object, default: {} })
    amenities: {
        hasWifi?: boolean;
        hasAirConditioning?: boolean;
        hasHeating?: boolean;
        hasTv?: boolean;
        hasBalcony?: boolean;
        hasPrivateBathroom?: boolean;
        hasKitchenette?: boolean;
        hasDesk?: boolean;
        hasSafe?: boolean;
        hasMinibar?: boolean;
        wheelchairAccessible?: boolean;
        selfCheckIn?: boolean;
        checkInTime?: string;    // "14:00"
        checkOutTime?: string;   // "11:00"
    };

    // ── Media ─────────────────────────────────────────────────────────────────

    @Prop({ type: [Object], default: [] })
    images: RoomImage[];

    // ── Availability ─────────────────────────────────────────────────────────

    /**
     * Date ranges blocked on this specific room — either manually or synced
     * from an iCal feed (off-platform bookings).
     */
    @Prop({
        type: [
            {
                from: { type: Date, required: true },
                to: { type: Date, required: true },
                reason: { type: String },
                source: { type: String, default: 'manual' },
            },
        ],
        default: [],
    })
    unavailableDates: RoomUnavailableDateRange[];

    // ── iCal sync (off-platform booking import) ───────────────────────────────

    /**
     * Public iCal feed URL from an external platform (Airbnb, Booking.com, etc.).
     * Example: https://www.airbnb.com/calendar/ical/XXXXX.ics
     */
    @Prop({ trim: true })
    icalUrl?: string;

    /** Timestamp of the last successful iCal sync */
    @Prop()
    icalLastSyncedAt?: Date;

    /** Number of date ranges imported in the last sync */
    @Prop({ default: 0 })
    icalSyncedRangesCount: number;

    // ── Status ────────────────────────────────────────────────────────────────

    @Prop({ default: true })
    isActive: boolean;

    // ── Analytics ─────────────────────────────────────────────────────────────

    @Prop({ default: 0 })
    bookingsCount: number;

    // ── Timestamps ───────────────────────────────────────────────────────────

    createdAt: Date;
    updatedAt: Date;
}

// ─── Schema factory & indexes ─────────────────────────────────────────────────

export const RoomSchema = SchemaFactory.createForClass(Room);

// Fast lookups by property
RoomSchema.index({ propertyId: 1, isActive: 1 });
RoomSchema.index({ propertyId: 1, roomType: 1 });
// Blocked-date range queries
RoomSchema.index({ 'unavailableDates.from': 1, 'unavailableDates.to': 1 });
// iCal sync job — find all rooms with a URL
RoomSchema.index({ icalUrl: 1 }, { sparse: true });
