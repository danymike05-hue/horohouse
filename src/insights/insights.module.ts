import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { MulterModule } from '@nestjs/platform-express';

import { Post, PostSchema } from './schemas/post.schema';
import { Category, CategorySchema } from './schemas/category.schema';
import { Tag, TagSchema } from './schemas/tag.schema';
import { AuthorProfile, AuthorProfileSchema } from './schemas/author-profile.schema';
import { InsightsController } from './insights.controller';
import { InsightsAdminController } from './insights-admin.controller';
import { InsightsService } from './(JWT-guarded)/insights.service';
import { InsightsAdminService } from './(JWT-guarded)/insights-admin.service';
import { InsightsSeoService } from './(JWT-guarded)/insights-seo.service';
import { InsightsRecommendationService } from './(JWT-guarded)/insights-recommendation.service';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Tag.name, schema: TagSchema },
      { name: AuthorProfile.name, schema: AuthorProfileSchema },
    ]),
    CloudinaryModule,    // reuse your existing Cloudinary module
    MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } }), // 10MB
  ],
  controllers: [InsightsController, InsightsAdminController],
  providers: [
    InsightsService,
    InsightsAdminService,
    InsightsSeoService,
    InsightsRecommendationService,
  ],
  exports: [InsightsService], // export for newsletter / ai-chat integration
})
export class InsightsModule {}