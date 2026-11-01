import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PropertyDocument = Property & Document;

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum PropertyType {
  APARTMENT = 'apartment',
  HOUSE = 'house',
  VILLA = 'villa',
  STUDIO = 'studio',
  DUPLEX = 'duplex',
  BUNGALOW = 'bungalow',
  PENTHOUSE = 'penthouse',
  LAND = 'land',
  COMMERCIAL = 'commercial',
  OFFICE = 'office',
  SHOP = 'shop',
  WAREHOUSE = 'warehouse',
  HOTEL = 'hotel',
  MOTEL = 'motel',
  VACATION_RENTAL = 'vacation_rental',
  GUESTHOUSE = 'guesthouse',
  HOSTEL = 'hostel',
  RESORT = 'resort',
  SERVICED_APARTMENT = 'serviced_apartment',
}

export enum PropertyStatus {
  ACTIVE = 'active',
  SOLD = 'sold',
  RENTED = 'rented',
  PENDING = 'pending',
  DRAFT = 'draft',
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum ListingType {
  SALE = 'sale',
  RENT = 'rent',
  SHORT_TERM = 'short_term',
}

export enum PricingUnit {
  NIGHTLY = 'nightly',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export enum CancellationPolicy {
  FLEXIBLE = 'flexible',
  MODERATE = 'moderate',
  STRICT = 'strict',
  NO_REFUND = 'no_refund',
}

// ─── Student-specific enums (NEW) ────────────────────────────────────────────

export enum WaterSource {
  /** CAMWATER — municipal supply (unreliable in many areas) */
  CAMWATER = 'camwater',
  /** Private borehole on the compound */
  BOREHOLE = 'borehole',
  /** Open well */
  WELL = 'well',
  /** Delivery by tanker truck */
  TANKER = 'tanker',
  /** Both CAMWATER and a borehole backup */
  CAMWATER_AND_BOREHOLE = 'camwater_and_borehole',
}

export enum ElectricityBackup {
  /** No backup — fully dependent on ENEO grid */
  NONE = 'none',
  /** Solar panels on site */
  SOLAR = 'solar',
  /** Shared or private generator */
  GENERATOR = 'generator',
  /** Both solar and generator */
  SOLAR_AND_GENERATOR = 'solar_and_generator',
}

export enum FurnishingStatus {
  /** Empty — student brings everything */
  UNFURNISHED = 'unfurnished',
  /** Bed frame and wardrobe only */
  SEMI_FURNISHED = 'semi_furnished',
  /** Bed, wardrobe, desk, basic appliances */
  FURNISHED = 'furnished',
}

export enum GenderRestriction {
  /** Any gender */
  NONE = 'none',
  /** Women-only compound */
  WOMEN_ONLY = 'women_only',
  /** Men-only compound */
  MEN_ONLY = 'men_only',
}

// ─── Sub-document interfaces ──────────────────────────────────────────────────

export interface PropertyAmenities {
  bedrooms?: number;
  bathrooms?: number;
  parkingSpaces?: number;
  hasGarden?: boolean;
  hasPool?: boolean;
  hasGym?: boolean;
  hasSecurity?: boolean;
  hasElevator?: boolean;
  hasBalcony?: boolean;
  hasAirConditioning?: boolean;
  hasInternet?: boolean;
  hasGenerator?: boolean;
  furnished?: boolean;
}

export interface ShortTermAmenities {
  hasWifi?: boolean;
  hasBreakfast?: boolean;   // Hotel: breakfast included
  hasParking?: boolean;
  hasTv?: boolean;
  hasKitchen?: boolean;
  hasKitchenette?: boolean;
  hasWasher?: boolean;
  hasDryer?: boolean;
  hasAirConditioning?: boolean;
  hasHeating?: boolean;
  petsAllowed?: boolean;
  smokingAllowed?: boolean;
  partiesAllowed?: boolean;
  maxGuests?: number;
  checkInTime?: string;
  checkOutTime?: string;
  selfCheckIn?: boolean;
  wheelchairAccessible?: boolean;
  airportTransfer?: boolean;
  conciergeService?: boolean;
  dailyHousekeeping?: boolean;
}

/**
 * Student-specific property details (NEW).
 * Only populated when isStudentFriendly === true.
 * All fields are optional so existing properties are never affected.
 */
export interface StudentDetails {
  // ── Location intelligence ─────────────────────────────────────────────────
  /** Straight-line distance in metres from property to nearest campus gate */
  campusProximityMeters?: number;
  /** Name of the nearest university or campus */
  nearestCampus?: string;
  /** Estimated walking time in minutes */
  walkingMinutes?: number;
  /** Estimated taxi/moto time in minutes */
  taxiMinutes?: number;

  // ── Infrastructure (critical for Cameroon) ────────────────────────────────
  waterSource?: WaterSource;
  electricityBackup?: ElectricityBackup;
  furnishingStatus?: FurnishingStatus;

  // ── House rules ───────────────────────────────────────────────────────────
  genderRestriction?: GenderRestriction;
  /** Time the gate locks at night, e.g. "22:00" */
  curfewTime?: string;
  /** Whether visitors are allowed on the compound */
  visitorsAllowed?: boolean;
  /** Whether cooking is allowed in the room */
  cookingAllowed?: boolean;

  // ── Security ──────────────────────────────────────────────────────────────
  hasGatedCompound?: boolean;
  hasNightWatchman?: boolean;
  hasFence?: boolean;

  // ── Landlord student-friendliness ─────────────────────────────────────────
  /**
   * Awarded by HoroHouse after the landlord passes the Student-Approved program.
   * Boosts listing rank in student search results.
   */
  isStudentApproved?: boolean;
  /**
   * Maximum advance months the landlord accepts.
   * The legal maximum is 12 in Cameroon; student-friendly landlords use 3–6.
   */
  maxAdvanceMonths?: number;
  /** Whether the landlord accepts the HoroHouse rent-advance microfinance scheme */
  acceptsRentAdvanceScheme?: boolean;

  // ── Colocation ────────────────────────────────────────────────────────────
  /** Number of beds available for colocation */
  availableBeds?: number;
  /** Total beds in the unit (e.g. 2-bed shared flat) */
  totalBeds?: number;
  /** Price per person per month when split by the number of beds */
  pricePerPersonMonthly?: number;
}

export interface PropertyImages {
  url: string;
  publicId: string;
  caption?: string;
  isMain?: boolean;
}

export interface PropertyMediaItem {
  url: string;
  publicId: string;
  caption?: string;
}

export interface UnavailableDateRange {
  from: Date;
  to: Date;
  reason?: string;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

@Schema({ timestamps: true })
export class Property {
  _id!: Types.ObjectId;

  // ── Core ──────────────────────────────────────────────────────────────────

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true })
  price: number;

  @Prop({ type: Number, default: null })
  originalPrice?: number | null;

  @Prop({ default: 'XAF' })
  currency?: string;

  @Prop({ type: String, enum: Object.values(PropertyType), required: true })
  type: PropertyType;

  @Prop({ type: String, enum: Object.values(ListingType), required: true })
  listingType: ListingType;

  @Prop({ required: true })
  description: string;

  // ── Location ──────────────────────────────────────────────────────────────

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  address: string;

  @Prop()
  state?: string;

  @Prop()
  neighborhood?: string;

  @Prop()
  country?: string;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      default: undefined,
    },
  })
  location: {
    type: string;
    coordinates: [number, number];
  };

  @Prop()
  latitude?: number;

  @Prop()
  longitude?: number;

  // ── Media ─────────────────────────────────────────────────────────────────

  @Prop({ type: [Object], default: [] })
  images: PropertyImages[];

  @Prop({ type: [Object], default: [] })
  videos: PropertyMediaItem[];

  // ── Standard amenities (long-term) ───────────────────────────────────────

  @Prop({ type: Object, default: {} })
  amenities: PropertyAmenities;

  // ── Short-term specific fields ────────────────────────────────────────────

  @Prop({
    type: String,
    enum: Object.values(PricingUnit),
    default: PricingUnit.NIGHTLY,
  })
  pricingUnit: PricingUnit;

  @Prop({ default: 1, min: 1 })
  minNights: number;

  @Prop({ default: 365, min: 1 })
  maxNights: number;

  @Prop({ default: 0, min: 0 })
  cleaningFee: number;

  @Prop({ default: 0, min: 0 })
  serviceFee: number;

  @Prop({ default: 10, min: 0, max: 100 })
  weeklyDiscountPercent: number;

  @Prop({ default: 15, min: 0, max: 100 })
  monthlyDiscountPercent: number;

  @Prop({ type: Number, default: null })
  customDiscountNights?: number | null;

  @Prop({ type: Number, default: null })
  customDiscountPercent?: number | null;

  @Prop({
    type: [
      {
        from: { type: Date, required: true },
        to: { type: Date, required: true },
        reason: { type: String },
      },
    ],
    default: [],
  })
  unavailableDates: UnavailableDateRange[];

  // ── Calendar settings (host pricing & sync) ───────────────────────────────

  @Prop({ type: Number, default: null })
  weekendPrice?: number | null;

  @Prop({ type: Object, default: {} })
  priceOverrides: Record<string, number>;

  @Prop({ default: 0, min: 0 })
  noticeDays: number;

  @Prop({ type: Number, default: 12 })
  windowMonths?: number | null;

  @Prop({
    type: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        url: { type: String, required: true },
        lastSyncedAt: { type: Date, default: null },
      },
    ],
    default: [],
  })
  externalCalendars: Array<{
    id: string;
    name: string;
    url: string;
    lastSyncedAt?: Date | null;
  }>;

  @Prop({ type: Object, default: {} })
  shortTermAmenities: ShortTermAmenities;

  @Prop({ default: false })
  isInstantBookable: boolean;

  @Prop({
    type: String,
    enum: Object.values(CancellationPolicy),
    default: CancellationPolicy.FLEXIBLE,
  })
  cancellationPolicy: CancellationPolicy;

  @Prop({ default: 0, min: 0 })
  advanceNoticeDays: number;

  @Prop({ default: 365, min: 1 })
  bookingWindowDays: number;

  // ── Student-specific fields (NEW) ─────────────────────────────────────────

  /**
   * Master switch. Set to true when a landlord opts into the student housing
   * programme. Activates student filters in search and enables studentDetails.
   * Defaults to false — zero impact on existing listings.
   */
  @Prop({ default: false, index: true })
  isStudentFriendly: boolean;

  /**
   * Populated only when isStudentFriendly === true.
   * All fields are optional so partial data is acceptable during onboarding.
   */
  @Prop({
    type: {
      campusProximityMeters: { type: Number },
      nearestCampus: { type: String },
      walkingMinutes: { type: Number },
      taxiMinutes: { type: Number },
      waterSource: { type: String, enum: Object.values(WaterSource) },
      electricityBackup: { type: String, enum: Object.values(ElectricityBackup) },
      furnishingStatus: { type: String, enum: Object.values(FurnishingStatus) },
      genderRestriction: {
        type: String,
        enum: Object.values(GenderRestriction),
        default: GenderRestriction.NONE,
      },
      curfewTime: { type: String },
      visitorsAllowed: { type: Boolean },
      cookingAllowed: { type: Boolean },
      hasGatedCompound: { type: Boolean },
      hasNightWatchman: { type: Boolean },
      hasFence: { type: Boolean },
      isStudentApproved: { type: Boolean, default: false },
      maxAdvanceMonths: { type: Number },
      acceptsRentAdvanceScheme: { type: Boolean, default: false },
      availableBeds: { type: Number },
      totalBeds: { type: Number },
      pricePerPersonMonthly: { type: Number },
    },
    default: null,
  })
  studentDetails?: StudentDetails;

  // ── Owner / agent ─────────────────────────────────────────────────────────

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  ownerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  agentId?: Types.ObjectId;

  // ── Details ───────────────────────────────────────────────────────────────

  @Prop()
  area?: number;

  @Prop()
  yearBuilt?: number;

  @Prop()
  floorNumber?: number;

  @Prop()
  totalFloors?: number;

  // ── Pricing extras ────────────────────────────────────────────────────────

  @Prop()
  pricePerSqm?: number;

  @Prop()
  depositAmount?: number;

  @Prop()
  maintenanceFee?: number;

  // ── Contact ───────────────────────────────────────────────────────────────

  @Prop()
  contactPhone?: string;

  @Prop()
  contactWhatsApp?: string;

  @Prop()
  contactEmail?: string;

  // ── SEO ───────────────────────────────────────────────────────────────────

  @Prop({ type: [String], default: [] })
  keywords: string[];

  @Prop()
  slug?: string;

  @Prop({ type: [String], default: [] })
  nearbyAmenities: string[];

  @Prop({ type: [String], default: [] })
  transportAccess: string[];

  // ── Analytics ─────────────────────────────────────────────────────────────

  @Prop({ default: 0 })
  viewsCount: number;

  @Prop({ default: 0 })
  inquiriesCount: number;

  @Prop({ default: 0 })
  favoritesCount: number;

  @Prop({ default: 0 })
  sharesCount: number;

  // ── Status & approval ─────────────────────────────────────────────────────

  @Prop({ type: String, enum: Object.values(PropertyStatus), default: PropertyStatus.ACTIVE })
  availability: PropertyStatus;

  @Prop({ type: String, enum: Object.values(ApprovalStatus), default: ApprovalStatus.PENDING })
  approvalStatus: ApprovalStatus;

  @Prop()
  rejectionReason?: string;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ default: false })
  isActive: boolean;

  // ── Ratings ───────────────────────────────────────────────────────────────

  @Prop({ default: 0 })
  averageRating?: number;

  @Prop({ default: 0 })
  reviewCount?: number;

  // ── Hotel-specific ────────────────────────────────────────────────────────

  /** Star classification for hotels (1–5). Only relevant when type === 'hotel'. */
  @Prop({ min: 1, max: 5 })
  starRating?: number;

  // ── Virtual tour ──────────────────────────────────────────────────────────

  @Prop()
  virtualTourUrl?: string;

  @Prop()
  videoUrl?: string;

  @Prop({
    type: String,
    enum: ['kuula', 'youtube', 'images', 'none'],
    default: 'none',
  })
  tourType?: string;

  @Prop({ default: null })
  tourThumbnail?: string;     // Cloudinary URL used as the preview thumbnail

  @Prop({ default: 0 })
  tourViews: number;          // lightweight analytics counter

  // ── Timestamps ────────────────────────────────────────────────────────────

  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema factory & indexes ─────────────────────────────────────────────────

export const PropertySchema = SchemaFactory.createForClass(Property);

// Geospatial
PropertySchema.index({ location: '2dsphere' });
PropertySchema.index({ location: '2dsphere', type: 1, availability: 1 });

// Full-text search
PropertySchema.index({
  title: 'text',
  description: 'text',
  city: 'text',
  neighborhood: 'text',
  keywords: 'text',
});

// Common filter combinations (existing)
PropertySchema.index({ city: 1, type: 1, listingType: 1 });
PropertySchema.index({ price: 1, city: 1 });
PropertySchema.index({ availability: 1, isActive: 1 });
PropertySchema.index({ ownerId: 1, createdAt: -1 });
PropertySchema.index({ viewsCount: -1 });
PropertySchema.index({ createdAt: -1 });

// Short-term specific (existing)
PropertySchema.index({ listingType: 1, isInstantBookable: 1, isActive: 1 });
PropertySchema.index({ listingType: 1, cancellationPolicy: 1 });
PropertySchema.index({ 'unavailableDates.from': 1, 'unavailableDates.to': 1 });

// Student-specific indexes (NEW)
// Powers the main student housing search — city + student flag + approval status
PropertySchema.index({ isStudentFriendly: 1, city: 1, isActive: 1, approvalStatus: 1 });
// Sort by campus proximity in student search results
PropertySchema.index({ isStudentFriendly: 1, 'studentDetails.campusProximityMeters': 1 });
// Filter for Student-Approved landlord badge
PropertySchema.index({ isStudentFriendly: 1, 'studentDetails.isStudentApproved': 1 });
// Filter by water source and electricity backup
PropertySchema.index({ 'studentDetails.waterSource': 1 });
PropertySchema.index({ 'studentDetails.electricityBackup': 1 });
// Colocation: find properties with available beds
PropertySchema.index({ isStudentFriendly: 1, 'studentDetails.availableBeds': 1 });
// Price per person search
PropertySchema.index({ isStudentFriendly: 1, 'studentDetails.pricePerPersonMonthly': 1 });
PropertySchema.index({ tourType: 1, isActive: 1 }); // tour browse filter