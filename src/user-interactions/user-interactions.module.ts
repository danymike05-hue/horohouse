import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserInteractionsController } from './user-interactions.controller';
import { UserInteractionsService } from './user-interactions.service';
import { UserInteraction, UserInteractionSchema } from './schemas/user-interaction.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserInteraction.name, schema: UserInteractionSchema },
    ]),
  ],
  controllers: [UserInteractionsController],
  providers: [UserInteractionsService],
  exports: [UserInteractionsService],
})
export class UserInteractionsModule {}
