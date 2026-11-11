import {
  Controller, Get, Post as PostDecorator, Patch, Delete,
  Param, Body, Query, Req, UseGuards, BadRequestException
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from 'src/auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';       // existing guard
import { Roles } from '../auth/guards/roles.guard';   // existing decorator
import { InsightsAdminService } from './(JWT-guarded)/insights-admin.service';
import { UserRole } from '../users/schemas/user.schema';
import {
  CreatePostDto, UpdatePostDto, SchedulePostDto, ReviewPostDto,
  QueryPostsDto, CreateCategoryDto, CreateAuthorProfileDto,
} from './dto/insights.dto';

@Controller('insights/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN) // reuse your existing role system
export class InsightsAdminController {
  constructor(private readonly adminService: InsightsAdminService) {}

  // ── Posts ─────────────────────────────────────────────────────────────────

  @Get('all')
  findAll(@Query() query: QueryPostsDto) {
    return this.adminService.findAll(query);
  }

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('analytics')
  getAnalytics(@Query() params: any) {
    return this.adminService.getAnalytics(params);
  }

  @PostDecorator()
  create(@Body() dto: CreatePostDto, @Req() req: any) {
    return this.adminService.create(dto, req.user.id);
  }

  @PostDecorator('upload-cover')
  async uploadCover(@Req() req: FastifyRequest) {
    // @ts-ignore - fastify-multipart appends parts()
    const parts = req.parts();
    for await (const part of parts as any) {
      if (part.type === 'file') {
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(Buffer.from(chunk));
        }
        const buffer = Buffer.concat(chunks);
        return this.adminService.uploadCover({ buffer } as any);
      }
    }
    throw new BadRequestException('No file uploaded');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminService.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePostDto, @Req() req: any) {
    return this.adminService.update(id, dto, req.user.id);
  }

  @Patch(':id/publish')
  publish(@Param('id') id: string, @Req() req: any) {
    return this.adminService.publish(id, req.user.id);
  }

  @Patch(':id/schedule')
  schedule(@Param('id') id: string, @Body() dto: SchedulePostDto, @Req() req: any) {
    return this.adminService.schedule(id, dto, req.user.id);
  }

  @Patch(':id/feature')
  feature(@Param('id') id: string, @Body('isFeatured') isFeatured: boolean, @Req() req: any) {
    return this.adminService.toggleFeatured(id, isFeatured, req.user.id);
  }

  @Patch(':id/review')
  review(@Param('id') id: string, @Body() dto: ReviewPostDto, @Req() req: any) {
    return this.adminService.reviewSubmission(id, dto, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.adminService.delete(id, req.user.id);
  }

  @PostDecorator('backfill-slugs')
  @Roles(UserRole.ADMIN)
  backfillSlugs() {
    return this.adminService.backfillSlugs();
  }

  // ── Categories ────────────────────────────────────────────────────────────

  @Get('categories')
  @Roles(UserRole.ADMIN, UserRole.AGENT) // broader access for reading
  getCategories() {
    return this.adminService.getAllCategories();
  }

  @PostDecorator('categories')
  @Roles(UserRole.ADMIN)
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.adminService.createCategory(dto);
  }

  @Patch('categories/:id')
  @Roles(UserRole.ADMIN)
  updateCategory(@Param('id') id: string, @Body() dto: Partial<CreateCategoryDto>) {
    return this.adminService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @Roles(UserRole.ADMIN)
  deleteCategory(@Param('id') id: string) {
    return this.adminService.deleteCategory(id);
  }

  // ── Tags ──────────────────────────────────────────────────────────────────

  @Get('tags')
  getAllTags(@Query() params: any) {
    return this.adminService.getAllTags(params);
  }

  @PostDecorator('tags')
  createTag(@Body('name') name: string) {
    return this.adminService.createTag(name);
  }

  @Delete('tags/:id')
  @Roles(UserRole.ADMIN)
  deleteTag(@Param('id') id: string) {
    return this.adminService.deleteTag(id);
  }

  // ── Authors ───────────────────────────────────────────────────────────────

  @Get('authors')
  getAuthors(@Query() params: any) {
    return this.adminService.getAuthors(params);
  }

  @PostDecorator('authors')
  createAuthor(@Body() dto: CreateAuthorProfileDto) {
    return this.adminService.createAuthorProfile(dto);
  }

  @Patch('authors/:id')
  updateAuthor(@Param('id') id: string, @Body() dto: Partial<CreateAuthorProfileDto>) {
    return this.adminService.updateAuthorProfile(id, dto);
  }
}
