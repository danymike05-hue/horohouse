import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

import { CommunityService } from './community.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostCategory } from './schemas/community-post.schema';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard, Roles, Public } from '../auth/guards/roles.guard';
import { UserRole } from '../users/schemas/user.schema';

@ApiTags('Community')
@Controller('community')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  // ══════════════════════════════════════════════════════════════════════════
  // POSTS — list & create
  // ══════════════════════════════════════════════════════════════════════════

  @Get('posts')
  @Public()
  @ApiOperation({ summary: 'List community posts (paginated, filterable)' })
  @ApiQuery({ name: 'page',      required: false, type: Number })
  @ApiQuery({ name: 'limit',     required: false, type: Number })
  @ApiQuery({ name: 'category',  required: false, enum: PostCategory })
  @ApiQuery({ name: 'tag',       required: false, type: String })
  @ApiQuery({ name: 'pinned',    required: false, type: Boolean })
  @ApiQuery({ name: 'authorId',  required: false, type: String })
  @ApiQuery({ name: 'search',    required: false, type: String })
  @ApiQuery({ name: 'sortBy',    required: false, type: String, description: '"default" | "likes" | "views" | "createdAt"' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200, description: 'Posts retrieved' })
  async findAll(@Query() query: any) {
    const filters = {
      category:  query.category,
      tag:       query.tag,
      pinned:    query.pinned === 'true' ? true : query.pinned === 'false' ? false : undefined,
      authorId:  query.authorId,
      search:    query.search,
    };
    const options = {
      page:      query.page  ? parseInt(query.page)   : 1,
      limit:     query.limit ? parseInt(query.limit)  : 20,
      sortBy:    query.sortBy    ?? 'default',
      sortOrder: (query.sortOrder ?? 'desc') as 'asc' | 'desc',
    };
    return this.communityService.findAllPosts(filters, options);
  }

  @Post('posts')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a community post' })
  @ApiResponse({ status: 201, description: 'Post created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createPost(@Body() dto: CreatePostDto, @Req() req: any) {
    return this.communityService.createPost(dto, req.user);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // POSTS — single post (slug-based for SEO)
  // ══════════════════════════════════════════════════════════════════════════

  @Get('posts/by-slug/:slug')
  @Public()
  @ApiOperation({ summary: 'Get a post by slug' })
  @ApiParam({ name: 'slug' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async findBySlug(@Param('slug') slug: string) {
    return this.communityService.findPostBySlug(slug);
  }

  @Get('posts/:id')
  @Public()
  @ApiOperation({ summary: 'Get a post by ID' })
  @ApiParam({ name: 'id' })
  async findById(@Param('id') id: string) {
    return this.communityService.findPostById(id);
  }

  @Patch('posts/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a post (author or admin)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 403, description: 'Not the post author or admin' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
    @Req() req: any,
  ) {
    return this.communityService.updatePost(id, dto, req.user);
  }

  @Delete('posts/:id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a post (author or admin)' })
  @ApiParam({ name: 'id' })
  async remove(@Param('id') id: string, @Req() req: any) {
    await this.communityService.deletePost(id, req.user);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ENGAGEMENT
  // ══════════════════════════════════════════════════════════════════════════

  @Post('posts/:id/like')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle like on a post' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: '{ liked: boolean, likes: number }' })
  async toggleLike(@Param('id') id: string, @Req() req: any) {
    return this.communityService.toggleLike(id, req.user);
  }

  @Post('posts/:id/view')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Increment view count (called on detail page load)' })
  @ApiParam({ name: 'id' })
  async incrementView(@Param('id') id: string) {
    await this.communityService.incrementViews(id);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // REPLIES
  // ══════════════════════════════════════════════════════════════════════════

  @Get('posts/:id/replies')
  @Public()
  @ApiOperation({ summary: 'Get replies for a post (paginated)' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'page',  required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getReplies(@Param('id') id: string, @Query() query: any) {
    return this.communityService.getPostReplies(id, {
      page:  query.page  ? parseInt(query.page)  : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ADMIN — pin / hard delete
  // ══════════════════════════════════════════════════════════════════════════

  @Patch('posts/:id/pin')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pin or unpin a post (admin only)' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'pinned', required: true, type: Boolean })
  async pinPost(@Param('id') id: string, @Query('pinned') pinned: string) {
    return this.communityService.pinPost(id, pinned === 'true');
  }

  @Delete('posts/:id/hard')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hard-delete a post (admin only)' })
  @ApiParam({ name: 'id' })
  async hardDelete(@Param('id') id: string) {
    await this.communityService.hardDelete(id);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STATS & REPORTING
  // ══════════════════════════════════════════════════════════════════════════

  @Get('stats')
  @Public()
  @ApiOperation({ summary: 'Get overall community stats' })
  async getStats() {
    return this.communityService.getStats();
  }

  @Get('admin/flagged-posts')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Get flagged posts' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getFlaggedPosts(@Query() query: any) {
    return this.communityService.getFlaggedPosts(query);
  }

  @Post('posts/:id/flag')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Flag a post' })
  @ApiParam({ name: 'id' })
  async flagPost(@Param('id') id: string, @Req() req: any) {
    return this.communityService.flagPost(id, req.user);
  }

  @Patch('posts/:id/unflag')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Unflag a post (dismiss reports)' })
  @ApiParam({ name: 'id' })
  async unflagPost(@Param('id') id: string) {
    return this.communityService.unflagPost(id);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AUTHORS
  // ══════════════════════════════════════════════════════════════════════════

  @Get('authors/:userId')
  @Public()
  @ApiOperation({ summary: 'Get community author profile + stats' })
  @ApiParam({ name: 'userId' })
  @ApiResponse({ status: 404, description: 'Author not found' })
  async getAuthorProfile(@Param('userId') userId: string) {
    return this.communityService.getAuthorProfile(userId);
  }

  @Get('authors/:userId/posts')
  @Public()
  @ApiOperation({ summary: "Get all posts by an author" })
  @ApiParam({ name: 'userId' })
  @ApiQuery({ name: 'page',      required: false, type: Number })
  @ApiQuery({ name: 'limit',     required: false, type: Number })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  async getAuthorPosts(@Param('userId') userId: string, @Query() query: any) {
    return this.communityService.getPostsByAuthor(userId, {
      page:      query.page  ? parseInt(query.page)  : 1,
      limit:     query.limit ? parseInt(query.limit) : 20,
      sortOrder: (query.sortOrder ?? 'desc') as 'asc' | 'desc',
    });
  }
}
