import {
    IsString,
    IsNumber,
    IsOptional,
    IsBoolean,
    IsEnum,
    IsArray,
    IsDateString,
    IsUrl,
    IsObject,
    ValidateNested,
    Min,
    Max,
    Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { RoomType, BedType } from '../schemas/room.schema';

// ─── Sub-DTOs ─────────────────────────────────────────────────────────────────

export class RoomAmenitiesDto {
    @ApiPropertyOptional() @IsOptional() @IsBoolean() hasWifi?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() hasAirConditioning?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() hasHeating?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() hasTv?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() hasBalcony?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() hasPrivateBathroom?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() hasKitchenette?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() hasDesk?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() hasSafe?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() hasMinibar?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() wheelchairAccessible?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() selfCheckIn?: boolean;

    @ApiPropertyOptional({ example: '14:00' })
    @IsOptional() @IsString() @Length(5, 5)
    checkInTime?: string;

    @ApiPropertyOptional({ example: '11:00' })
    @IsOptional() @IsString() @Length(5, 5)
    checkOutTime?: string;
}

export class RoomDateRangeDto {
    @ApiProperty({ example: '2026-04-01' })
    @IsDateString()
    from: string;

    @ApiProperty({ example: '2026-04-07' })
    @IsDateString()
    to: string;

    @ApiPropertyOptional({ example: 'maintenance' })
    @IsOptional() @IsString() @Length(0, 100)
    reason?: string;
}

// ─── Create Room ──────────────────────────────────────────────────────────────

export class CreateRoomDto {
    @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'Parent property ID (must be a hotel/hostel/motel)' })
    @IsString()
    @Length(24, 24, { message: 'propertyId must be a valid 24-character ObjectId' })
    propertyId: string;

    @ApiProperty({ example: 'Deluxe Double — Pool View' })
    @IsString()
    @Length(2, 100)
    name: string;

    @ApiPropertyOptional({ example: '101' })
    @IsOptional() @IsString() @Length(1, 20)
    roomNumber?: string;

    @ApiProperty({ enum: RoomType, example: RoomType.DOUBLE })
    @IsEnum(RoomType)
    roomType: RoomType;

    @ApiProperty({ example: 2, description: 'Maximum guests allowed in this room' })
    @IsNumber() @Min(1) @Max(50)
    maxGuests: number;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional() @IsNumber() @Min(1) @Max(10)
    bedCount?: number;

    @ApiPropertyOptional({ enum: BedType, example: BedType.QUEEN })
    @IsOptional() @IsEnum(BedType)
    bedType?: BedType;

    @ApiPropertyOptional({ example: 35000, description: 'Nightly price for this room (overrides property price)' })
    @IsOptional() @IsNumber() @Min(0)
    price?: number;

    @ApiPropertyOptional({ example: 3000 })
    @IsOptional() @IsNumber() @Min(0)
    cleaningFee?: number;

    @ApiPropertyOptional({ type: RoomAmenitiesDto })
    @IsOptional() @IsObject() @ValidateNested() @Type(() => RoomAmenitiesDto)
    amenities?: RoomAmenitiesDto;
}

// ─── Update Room ──────────────────────────────────────────────────────────────

export class UpdateRoomDto extends PartialType(CreateRoomDto) {
    @ApiPropertyOptional()
    @IsOptional() @IsBoolean()
    isActive?: boolean;
}

// ─── Block / Unblock dates ────────────────────────────────────────────────────

export class BlockRoomDatesDto {
    @ApiProperty({ type: [RoomDateRangeDto], description: 'Date ranges to block on this room' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => RoomDateRangeDto)
    ranges: RoomDateRangeDto[];
}

export class UnblockRoomDatesDto {
    @ApiProperty({
        example: ['2026-04-01'],
        description: 'Block start dates (ISO) identifying ranges to remove',
    })
    @IsArray()
    @IsDateString({}, { each: true })
    fromDates: string[];
}

// ─── iCal URL ────────────────────────────────────────────────────────────────

export class SetIcalUrlDto {
    @ApiProperty({
        example: 'https://www.airbnb.com/calendar/ical/XXXXXX.ics',
        description: 'Public iCal (.ics) feed URL from an external booking platform',
    })
    @IsUrl({ protocols: ['http', 'https'] })
    icalUrl: string;
}

// ─── Query ────────────────────────────────────────────────────────────────────

export class RoomAvailabilityQueryDto {
    @ApiProperty({ example: '2026-04-01' })
    @IsDateString()
    from: string;

    @ApiProperty({ example: '2026-04-30' })
    @IsDateString()
    to: string;
}
