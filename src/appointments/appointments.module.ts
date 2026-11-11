import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { ViewingsService } from './viewings.service';
import { Appointment, AppointmentSchema } from './schemas/appointment.schema';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Appointment.name, schema: AppointmentSchema },
            { name: Property.name, schema: PropertySchema }
        ]),
        NotificationsModule,
    ],
    controllers: [AppointmentsController],
    providers: [AppointmentsService, ViewingsService],
    exports: [AppointmentsService, ViewingsService],
})
export class AppointmentsModule { }
