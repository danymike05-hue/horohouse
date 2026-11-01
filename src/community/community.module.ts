import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { CommunityPost, CommunityPostSchema } from './schemas/community-post.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CommunityPost.name, schema: CommunityPostSchema },
      { name: User.name,          schema: UserSchema },
    ]),
  ],
  controllers: [CommunityController],
  providers:   [CommunityService],
  exports:     [CommunityService],
})
export class CommunityModule {}
