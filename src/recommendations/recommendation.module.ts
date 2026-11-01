import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RecommendationController } from './recommendation.controller';
import { RecommendationService } from './recommendation.service';
import { ContentBasedRecommendationService } from './content-based.service';
import { HybridRecommendationService } from './hybrid.service';
import { FlaskMLService } from './flask-ml.service';
import { MLSyncService } from './ml-sync.service';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UserInteraction, UserInteractionSchema } from '../user-interactions/schemas/user-interaction.schema';
import { UserInteractionsModule } from '../user-interactions/user-interactions.module';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        timeout: configService.get<number>('FLASK_TIMEOUT', 10000),
        maxRedirects: 5,
        baseURL: configService.get<string>('FLASK_ML_URL', 'http://localhost:5001'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: Property.name, schema: PropertySchema },
      { name: User.name, schema: UserSchema },
      { name: UserInteraction.name, schema: UserInteractionSchema },
    ]),
    UserInteractionsModule,
  ],
  controllers: [RecommendationController],
  providers: [
    RecommendationService,
    ContentBasedRecommendationService,
    HybridRecommendationService,
    FlaskMLService,
    MLSyncService,
  ],
  exports: [
    RecommendationService,
    ContentBasedRecommendationService,
    HybridRecommendationService,
    FlaskMLService,
    MLSyncService,
  ],
})
export class RecommendationModule {}