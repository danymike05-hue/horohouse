import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Room, RoomSchema } from './schemas/room.schema';
import { Booking, BookingSchema } from '../bookings/schema/booking.schema';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { IcalSyncService } from './ical-sync.service';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Room.name, schema: RoomSchema },
            { name: Booking.name, schema: BookingSchema },
            { name: Property.name, schema: PropertySchema },
            { name: User.name, schema: UserSchema },
        ]),
        forwardRef(() => BookingsModule), // prevents circular dep: Rooms <-> Bookings
    ],
    controllers: [RoomsController],
    providers: [RoomsService, IcalSyncService],
    exports: [RoomsService],
})
export class RoomsModule { }

