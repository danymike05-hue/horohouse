export declare class BookingGuestsDto {
    adults: number;
    children?: number;
    infants?: number;
}
export declare class CreateBookingDto {
    propertyId: string;
    checkIn: string;
    checkOut: string;
    guests: BookingGuestsDto;
    currency?: string;
    guestNote?: string;
    roomId?: string;
}
export declare class CancelBookingDto {
    reason?: string;
}
export declare class RespondToBookingDto {
    hostNote?: string;
    reason?: string;
}
export declare class UpdatePaymentDto {
    paymentStatus: string;
    paymentReference?: string;
    paymentMethod?: string;
}
export declare class BookingQueryDto {
    page?: number;
    limit?: number;
    status?: string;
    fromDate?: string;
    toDate?: string;
    sortOrder?: 'asc' | 'desc';
}
export declare class AvailabilityQueryDto {
    from: string;
    to: string;
    roomId?: string;
}
