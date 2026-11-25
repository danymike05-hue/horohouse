import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Report, ReportSchema } from './schemas/report.schema';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Conversation, ConversationSchema } from '../chat/schemas/conversation.schema';
import { Message, MessageSchema } from '../chat/schemas/message.schema';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Report.name, schema: ReportSchema },
            { name: Property.name, schema: PropertySchema },
            { name: User.name, schema: UserSchema },
            { name: Conversation.name, schema: ConversationSchema },
            { name: Message.name, schema: MessageSchema },
        ]),
        EmailModule,
        NotificationsModule,
    ],
    controllers: [ReportsController],
    providers: [ReportsService],
    exports: [ReportsService],
})
export class ReportsModule {}