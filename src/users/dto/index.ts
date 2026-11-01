import {
  IsString,
  IsEmail,
  IsPhoneNumber,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  IsObject,
  IsDate,
  ValidateNested,
  Min,
  Max,
  ArrayMaxSize,
  Length,
  Matches,
  IsIn
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { UserRole, PayoutMethod } from '../schemas/user.schema';


// Location DTO for geospatial data
export class LocationDto {
  @ApiProperty({ example: 'Point' })
  @IsString()
  @IsOptional()
  type?: 'Point' = 'Point';

  @ApiProperty({
    example: [9.2, 45.4],
    description: 'Coordinates in [longitude, latitude] format'
  })
  @IsArray()
  @IsNumber({}, { each: true })
  @ArrayMaxSize(2)
  coordinates: [number, number];
}

export class GetViewedPropertiesDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  sortBy?: string = 'viewedAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

// User Preferences DTO
export class UserPreferencesDto {
  @ApiPropertyOptional({ example: 100000, description: 'Minimum price in currency units' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ example: 500000, description: 'Maximum price in currency units' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ example: 'XAF', description: 'Preferred currency code' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: ['Apartment', 'House'], description: 'Preferred property types' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  propertyTypes?: string[];

  @ApiPropertyOptional({ example: ['Douala', 'Yaoundé'], description: 'Preferred cities / areas' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cities?: string[];

  @ApiPropertyOptional({ example: ['Parking', 'Gym'], description: 'Preferred features / amenities' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @ApiPropertyOptional({ example: [2, 3], description: 'Preferred number of bedrooms (multi-select)' })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  bedrooms?: number[];

  @ApiPropertyOptional({ example: [1, 2], description: 'Preferred number of bathrooms (multi-select)' })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  bathrooms?: number[];

  @ApiPropertyOptional({ example: 10, description: 'Maximum search radius in kilometres' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  maxRadius?: number;

  @ApiPropertyOptional({ example: 50, description: 'Minimum area in m²' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minArea?: number;

  @ApiPropertyOptional({ example: 5000, description: 'Maximum area in m²' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxArea?: number;

  @ApiPropertyOptional({ type: LocationDto, description: 'Preferred location coordinates' })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  preferredLocation?: LocationDto;
}

// Create User DTO
export class CreateUserDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'Full name of the user'
  })
  @IsString()
  @Length(2, 100)
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiPropertyOptional({
    example: 'john.doe@example.com',
    description: 'Email address (optional)'
  })
  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase()?.trim())
  email?: string;

  @ApiProperty({
    example: '+237123456789',
    description: 'Phone number with country code'
  })
  @IsPhoneNumber()
  phoneNumber: string;

  @ApiPropertyOptional({
    enum: UserRole,
    example: UserRole.REGISTERED_USER,
    description: 'User role'
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiProperty({
    example: 'firebase-uid-123',
    description: 'Firebase UID for authentication'
  })
  @IsString()
  @Length(10, 128)
  firebaseUid: string;

  @ApiPropertyOptional({
    example: 'google-id-123',
    description: 'Google OAuth ID (optional)'
  })
  @IsOptional()
  @IsString()
  googleId?: string;

  // Agent-specific fields
  @ApiPropertyOptional({
    example: 'LIC123456789',
    description: 'Real estate license number (for agents)'
  })
  @IsOptional()
  @IsString()
  @Length(5, 50)
  licenseNumber?: string;

  @ApiPropertyOptional({
    example: 'Century 21',
    description: 'Real estate agency name (for agents)'
  })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  agency?: string;

  @ApiPropertyOptional({
    example: 'Experienced real estate agent with 10+ years in the field',
    description: 'Professional bio (for agents)'
  })
  @IsOptional()
  @IsString()
  @Length(10, 1000)
  bio?: string;

  @ApiPropertyOptional({
    example: 'https://www.myagency.com',
    description: 'Website URL (for agents)'
  })
  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/.+\..+$/i, {
    message: 'Website must be a valid URL'
  })
  website?: string;

  @ApiPropertyOptional({
    example: '123 Main Street, Downtown',
    description: 'Office or home address'
  })
  @IsOptional()
  @IsString()
  @Length(5, 200)
  address?: string;

  @ApiPropertyOptional({
    example: 'Douala',
    description: 'City'
  })
  @IsOptional()
  @IsString()
  @Length(2, 50)
  city?: string;

  @ApiPropertyOptional({
    example: 'Cameroon',
    description: 'Country'
  })
  @IsOptional()
  @IsString()
  @Length(2, 50)
  country?: string;

  @ApiPropertyOptional({
    type: LocationDto,
    description: 'Geographic location coordinates'
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @ApiPropertyOptional({
    type: UserPreferencesDto,
    description: 'User preferences for property searches'
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UserPreferencesDto)
  preferences?: UserPreferencesDto;

  // Notification preferences
  @ApiPropertyOptional({
    example: true,
    description: 'Enable email notifications'
  })
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Enable SMS notifications'
  })
  @IsOptional()
  @IsBoolean()
  smsNotifications?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Enable push notifications'
  })
  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;
}

// Update User DTO (partial version of CreateUserDto)
export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({
    example: false,
    description: 'Mark user as active/inactive'
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Email verification status'
  })
  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Phone verification status'
  })
  @IsOptional()
  @IsBoolean()
  phoneVerified?: boolean;

  @ApiPropertyOptional({
    example: 'https://example.com/profile.jpg',
    description: 'Profile picture URL'
  })
  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i, {
    message: 'Profile picture must be a valid image URL'
  })
  profilePicture?: string;

  @ApiPropertyOptional({
    example: 25,
    description: 'Number of properties listed (for agents)'
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  propertiesListed?: number;

  @ApiPropertyOptional({
    example: 12,
    description: 'Number of properties sold (for agents)'
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  propertiesSold?: number;
}

export class UpdateOwnProfileDto extends OmitType(UpdateUserDto, [
  'isActive',
  'emailVerified',
  'phoneVerified',
  'propertiesListed',
  'propertiesSold',
  'role',
  'firebaseUid',
  'googleId',
  'profilePicture', 
] as const) {}

// Update Preferences DTO
export class UpdatePreferencesDto extends UserPreferencesDto { }

// Search Query DTO (for search history)
export class SearchQueryDto {
  @ApiProperty({
    example: 'apartment in douala',
    description: 'Search query string'
  })
  @IsString()
  @Length(1, 200)
  query: string;

  @ApiProperty({
    example: { minPrice: 100000, maxPrice: 500000, type: 'apartment' },
    description: 'Search filters object'
  })
  @IsObject()
  filters: any;

  @ApiPropertyOptional({
    type: LocationDto,
    description: 'Search location coordinates'
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @ApiProperty({
    example: 25,
    description: 'Number of results returned'
  })
  @IsNumber()
  @Min(0)
  resultsCount: number;
}

// Query DTOs for filtering and pagination
export class GetUsersQueryDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Page number'
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 10,
    description: 'Number of items per page'
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    enum: UserRole,
    description: 'Filter by user role'
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    example: true,
    description: 'Filter by active status'
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 'john',
    description: 'Search term for name, email, or phone'
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  search?: string;
}

// Response DTOs for better API documentation
export class UserResponseDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  id: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiPropertyOptional({ example: 'john.doe@example.com' })
  email?: string;

  @ApiProperty({ example: '+237123456789' })
  phoneNumber: string;

  @ApiProperty({ enum: UserRole, example: UserRole.REGISTERED_USER })
  role: UserRole;

  @ApiPropertyOptional({ example: 'https://example.com/profile.jpg' })
  profilePicture?: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: false })
  emailVerified: boolean;

  @ApiProperty({ example: true })
  phoneVerified: boolean;

  @ApiProperty({ type: UserPreferencesDto })
  preferences: UserPreferencesDto;

  @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
  updatedAt: Date;

  // Agent-specific fields
  @ApiPropertyOptional({ example: 'LIC123456789' })
  licenseNumber?: string;

  @ApiPropertyOptional({ example: 'Century 21' })
  agency?: string;

  @ApiPropertyOptional({ example: 'Experienced agent...' })
  bio?: string;

  @ApiPropertyOptional({ example: 25 })
  propertiesListed?: number;

  @ApiPropertyOptional({ example: 12 })
  propertiesSold?: number;

  @ApiPropertyOptional({ example: 'Douala' })
  city?: string;

  @ApiPropertyOptional({ example: 'Cameroon' })
  country?: string;
}

export class PaginatedUsersResponseDto {
  @ApiProperty({ type: [UserResponseDto] })
  users: UserResponseDto[];

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 10 })
  totalPages: number;
}

// Agent-specific DTOs
export class AgentStatsDto {
  @ApiProperty({ example: 25 })
  totalProperties: number;

  @ApiProperty({ example: 20 })
  activeProperties: number;
}

export class AgentResponseDto extends UserResponseDto {
  @ApiProperty({ type: AgentStatsDto })
  stats: AgentStatsDto;
}

export class PaginatedAgentsResponseDto {
  @ApiProperty({ type: [AgentResponseDto] })
  agents: AgentResponseDto[];

  @ApiProperty({ example: 50 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 5 })
  totalPages: number;
}

// User Statistics DTO
export class UserStatsDto {
  @ApiProperty({ example: 1500 })
  total: number;

  @ApiProperty({ example: 1450 })
  active: number;

  @ApiProperty({ example: 50 })
  agents: number;

  @ApiProperty({ example: 30 })
  landlords: number;

  @ApiProperty({ example: 20 })
  hosts: number;

  @ApiProperty({ example: 80 })
  students: number;

  @ApiProperty({ example: 40 })
  guests: number;

  @ApiProperty({ example: 5 })
  superhosts: number;

  @ApiProperty({ example: 3 })
  pendingHostVerifications: number;

  @ApiProperty({ example: 1200 })
  verified: number;

  @ApiProperty({ example: 100 })
  recent: number;

  @ApiProperty({
    example: {
      registered_user: 1400,
      agent: 50,
      landlord: 30,
      host: 20,
      student: 80,
      guest: 40,
    },
  })
  byRole: Record<string, number>;
}

// ==========================================
// TENANT MANAGEMENT DTOs
// ==========================================

export class CreateTenantDto {
  @ApiProperty({ example: 'Jean Dupont', description: 'Full name of the tenant' })
  @IsString()
  @Length(2, 100)
  @Transform(({ value }) => value?.trim())
  tenantName: string;

  @ApiPropertyOptional({ example: 'jean.dupont@example.com', description: 'Tenant email address' })
  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase()?.trim())
  tenantEmail?: string;

  @ApiPropertyOptional({ example: '+237612345678', description: 'Tenant phone number' })
  @IsOptional()
  @IsString()
  @Length(5, 20)
  tenantPhone?: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'Property ObjectId the tenant is assigned to' })
  @IsString()
  @Length(24, 24, { message: 'propertyId must be a valid 24-character ObjectId' })
  propertyId: string;

  @ApiProperty({ example: '2026-01-01', description: 'Lease start date (ISO format)' })
  @IsString()
  leaseStart: string;

  @ApiProperty({ example: '2027-01-01', description: 'Lease end date (ISO format)' })
  @IsString()
  leaseEnd: string;

  @ApiProperty({ example: 150000, description: 'Monthly rent amount in XAF' })
  @IsNumber()
  @Min(0)
  monthlyRent: number;

  @ApiPropertyOptional({ example: 300000, description: 'Security deposit amount in XAF' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @ApiPropertyOptional({
    example: 'active',
    enum: ['active', 'ended', 'pending'],
    description: 'Lease status',
  })
  @IsOptional()
  @IsIn(['active', 'ended', 'pending'])
  status?: 'active' | 'ended' | 'pending';

  @ApiPropertyOptional({ example: 'Pays via mobile money on the 1st.', description: 'Additional notes' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}

export class UpdateTenantDto {
  @ApiPropertyOptional({ example: 'Jean Dupont', description: 'Full name of the tenant' })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  @Transform(({ value }) => value?.trim())
  tenantName?: string;

  @ApiPropertyOptional({ example: 'jean.dupont@example.com', description: 'Tenant email address' })
  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase()?.trim())
  tenantEmail?: string;

  @ApiPropertyOptional({ example: '+237612345678', description: 'Tenant phone number' })
  @IsOptional()
  @IsString()
  @Length(5, 20)
  tenantPhone?: string;

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011', description: 'Property ObjectId' })
  @IsOptional()
  @IsString()
  @Length(24, 24, { message: 'propertyId must be a valid 24-character ObjectId' })
  propertyId?: string;

  @ApiPropertyOptional({ example: '2026-01-01', description: 'Lease start date' })
  @IsOptional()
  @IsString()
  leaseStart?: string;

  @ApiPropertyOptional({ example: '2027-01-01', description: 'Lease end date' })
  @IsOptional()
  @IsString()
  leaseEnd?: string;

  @ApiPropertyOptional({ example: 150000, description: 'Monthly rent amount in XAF' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyRent?: number;

  @ApiPropertyOptional({ example: 300000, description: 'Security deposit amount in XAF' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @ApiPropertyOptional({
    example: 'active',
    enum: ['active', 'ended', 'pending'],
    description: 'Lease status',
  })
  @IsOptional()
  @IsIn(['active', 'ended', 'pending'])
  status?: 'active' | 'ended' | 'pending';

  @ApiPropertyOptional({ example: 'Updated notes.', description: 'Additional notes' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}

// ==========================================
// HOST DTOs
// ==========================================

/**
 * Body for PATCH /users/me/role — explicitly set the caller's role.
 */
export class SetRoleDto {
  @ApiProperty({
    enum: UserRole,
    example: UserRole.HOST,
    description: 'Target role to assign. ADMIN cannot be set via this endpoint.',
  })
  @IsEnum(UserRole)
  role: UserRole;
}

/**
 * Nested DTO for a single payout account entry.
 */
export class PayoutAccountDto {
  @ApiProperty({ enum: PayoutMethod, example: PayoutMethod.MOBILE_MONEY })
  @IsEnum(PayoutMethod)
  method: PayoutMethod;

  @ApiProperty({ example: '+237670000000', description: 'Phone / account number / PayPal email' })
  @IsString()
  @Length(3, 100)
  accountIdentifier: string;

  @ApiPropertyOptional({ example: 'MTN Cameroon' })
  @IsOptional()
  @IsString()
  @Length(2, 80)
  providerName?: string;

  @ApiPropertyOptional({ example: true, description: 'Mark as the default payout method' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ example: 'XAF', description: 'ISO 4217 currency code' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;
}

/**
 * PATCH /users/hosts/:id/profile
 * All fields are optional — only supplied fields are written.
 */
export class UpdateHostProfileDto {
  // ── Booking preferences ───────────────────────────────────────────────
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  instantBookEnabled?: boolean;

  @ApiPropertyOptional({ example: 1, description: 'Min nights (default 1)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minNightsDefault?: number;

  @ApiPropertyOptional({ example: 0, description: 'Max nights (0 = no cap)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxNightsDefault?: number;

  @ApiPropertyOptional({ example: 24, description: 'Advance notice in hours before check-in' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  advanceNoticeHours?: number;

  @ApiPropertyOptional({ example: 12, description: 'Months ahead the calendar stays open (0 = no limit)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  bookingWindowMonths?: number;

  // ── House rules ───────────────────────────────────────────────────────
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  petsAllowedDefault?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  smokingAllowedDefault?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  eventsAllowedDefault?: boolean;

  @ApiPropertyOptional({ example: '15:00', description: '24 h check-in time, e.g. "15:00"' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Must be HH:MM in 24-hour format' })
  checkInTimeDefault?: string;

  @ApiPropertyOptional({ example: '11:00', description: '24 h check-out time' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Must be HH:MM in 24-hour format' })
  checkOutTimeDefault?: string;

  // ── Payout account operations ─────────────────────────────────────────
  @ApiPropertyOptional({ type: PayoutAccountDto, description: 'Add a new payout account' })
  @IsOptional()
  @ValidateNested()
  @Type(() => PayoutAccountDto)
  addPayoutAccount?: PayoutAccountDto;

  @ApiPropertyOptional({
    example: '+237670000000',
    description: 'accountIdentifier of the payout account to remove',
  })
  @IsOptional()
  @IsString()
  removePayoutAccountIdentifier?: string;

  // ── Co-host operations ────────────────────────────────────────────────
  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011', description: 'User ID to add as co-host' })
  @IsOptional()
  @IsString()
  @Length(24, 24, { message: 'Must be a valid 24-character ObjectId' })
  addCoHostId?: string;

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011', description: 'User ID to remove from co-hosts' })
  @IsOptional()
  @IsString()
  @Length(24, 24, { message: 'Must be a valid 24-character ObjectId' })
  removeCoHostId?: string;

  // ── Bio / presentation ────────────────────────────────────────────────
  @ApiPropertyOptional({ example: 'Passionate host in Douala with 3 cosy apartments.' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  hostBio?: string;

  @ApiPropertyOptional({ example: ['fr', 'en'], description: 'ISO 639-1 language codes spoken by the host' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hostLanguages?: string[];

  @ApiPropertyOptional({ example: 'Douala' })
  @IsOptional()
  @IsString()
  @Length(2, 80)
  operatingCity?: string;
}

/**
 * PATCH /users/hosts/:id/verify (Admin only)
 */
export class VerifyHostDto {
  @ApiProperty({ enum: ['approve', 'reject'], example: 'approve' })
  @IsIn(['approve', 'reject'])
  decision: 'approve' | 'reject';

  @ApiPropertyOptional({ example: 'ID document was expired.' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  rejectionReason?: string;
}

/**
 * POST /users/hosts/:id/payouts (Admin / payments service only)
 */
export class RecordHostPayoutDto {
  @ApiProperty({ example: 55000, description: 'Gross payout amount' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ example: 'XAF', description: 'ISO 4217 currency code' })
  @IsString()
  @Length(3, 3)
  currency: string;

  @ApiProperty({ enum: PayoutMethod, example: PayoutMethod.MOBILE_MONEY })
  @IsEnum(PayoutMethod)
  method: PayoutMethod;

  @ApiPropertyOptional({ example: 'BOOKING-2026-001', description: 'Booking or period reference' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  reference?: string;

  @ApiProperty({ enum: ['pending', 'processing', 'paid', 'failed'], example: 'paid' })
  @IsIn(['pending', 'processing', 'paid', 'failed'])
  status: 'pending' | 'processing' | 'paid' | 'failed';

  @ApiProperty({ example: '2026-04-13T00:00:00.000Z' })
  @Type(() => Date)
  initiatedAt: Date;

  @ApiPropertyOptional({ example: '2026-04-14T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  completedAt?: Date;

  @ApiPropertyOptional({ example: 'Insufficient balance.' })
  @IsOptional()
  @IsString()
  @Length(1, 300)
  failureReason?: string;
}