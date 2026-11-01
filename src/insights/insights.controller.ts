import {
  Controller, Get, Param, Query, UseGuards,
  Post as PostDecorator, Body, Req, Patch,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from 'src/auth/guards/jwt.auth.guard';
import { InsightsService } from './(JWT-guarded)/insights.service';
import { QueryPostsDto } from './dto/insights.dto';

@Controller('insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  // Feed
  @Get()
  @SkipThrottle()
  findAll(@Query() query: QueryPostsDto) {
    return this.insightsService.findPublished(query);
  }

  @Get('featured')
  @SkipThrottle()
  featured(@Query('limit') limit?: number) {
    return this.insightsService.findFeatured(limit);
  }

  @Get('trending')
  @SkipThrottle()
  trending(@Query('limit') limit?: number) {
    return this.insightsService.findTrending(limit);
  }

  @Get('search')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  search(@Query('q') q: string, @Query() query: QueryPostsDto) {
    return this.insightsService.searchInsights(q, query);
  }

  @Get('categories')
  @SkipThrottle()
  getCategories() {
    return this.insightsService.getCategories();
  }

  @Get('tags/popular')
  @SkipThrottle()
  popularTags(@Query('limit') limit?: number) {
    return this.insightsService.getPopularTags(limit);
  }

  @Get('market')
  @SkipThrottle()
  marketInsights(@Query() query: QueryPostsDto) {
    return this.insightsService.getMarketInsights(query);
  }

  @Get('category/:slug')
  @SkipThrottle()
  byCategory(@Param('slug') slug: string, @Query() query: QueryPostsDto) {
    return this.insightsService.findByCategory(slug, query);
  }

  @Get('tag/:slug')
  @SkipThrottle()
  byTag(@Param('slug') slug: string, @Query() query: QueryPostsDto) {
    return this.insightsService.findByTag(slug, query);
  }

  @Get('author/:slug')
  @SkipThrottle()
  authorPage(@Param('slug') slug: string, @Query() query: QueryPostsDto) {
    return this.insightsService.getAuthorWithPosts(slug, query);
  }

  @Get('neighborhood/:slug')
  @SkipThrottle()
  neighborhoodGuide(@Param('slug') slug: string) {
    return this.insightsService.getNeighborhoodGuide(slug);
  }

  // NOTE: slug route must come AFTER all named routes above
  @Get(':slug')
  @SkipThrottle()
  findOne(@Param('slug') slug: string) {
    return this.insightsService.findBySlug(slug);
  }

  @Get(':slug/related')
  @SkipThrottle()
  related(@Param('slug') slug: string, @Query('limit') limit?: number) {
    return this.insightsService.getRelated(slug, limit);
  }

  // ── Contributor routes (JWT required) ──────────────────────────────────────

  @PostDecorator('contribute')
  @UseGuards(JwtAuthGuard)
  submitDraft(@Body() dto: any, @Req() req: any) {
    return this.insightsService.submitDraft(req.user.id, dto);
  }

  @Get('my-submissions')
  @UseGuards(JwtAuthGuard)
  mySubmissions(@Query() query: QueryPostsDto, @Req() req: any) {
    return this.insightsService.getMySubmissions(req.user.id, query);
  }
}