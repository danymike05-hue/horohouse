import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { EmailService } from './email.service';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  // Users: to write each email in the recipient's app language
  imports: [ConfigModule, MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
