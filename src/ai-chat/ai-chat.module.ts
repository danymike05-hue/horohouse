import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';

import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';

// Import schemas
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

// Import required modules
import { PropertiesModule } from '../properties/properties.module';
import { UserInteractionsModule } from '../user-interactions/user-interactions.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Property.name, schema: PropertySchema },
      { name: User.name, schema: UserSchema },
    ]),
    PropertiesModule,
    UserInteractionsModule,
  ],
  controllers: [AiChatController],
  providers: [AiChatService],
  exports: [AiChatService],
})
export class AiChatModule {}