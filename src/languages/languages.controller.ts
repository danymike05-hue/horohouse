import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/schemas/user.schema';
import { LanguagesService } from './languages.service';
import {
  CompleteLessonDto, CourseDto, DraftDto, LessonDto, UnitDto, UpdateCourseDto, UpdateLanguageProfileDto, UpdateLessonDto,
} from './dto/languages.dto';

class MoveDto { @IsIn(['up', 'down']) dir: 'up' | 'down'; }

const uid = (req: any): string => String(req.user?._id ?? req.user?.id ?? req.user?.userId ?? req.user?.sub);
/** "fr-FR,fr;q=0.9" → "fr" */
const uiLang = (h?: string) => (String(h ?? '').toLowerCase().startsWith('fr') ? 'fr' : 'en');

@ApiTags('Languages')
@ApiBearerAuth()
@Controller('languages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LanguagesController {
  constructor(private readonly service: LanguagesService) {}

  // ── Admins (first, so "admin" isn't read as a course id) ──

  @Get('admin/courses')
  @Roles(UserRole.ADMIN)
  adminCourses() { return this.service.adminCourses(); }

  @Post('admin/courses')
  @Roles(UserRole.ADMIN)
  createCourse(@Body() dto: CourseDto) { return this.service.createCourse(dto); }

  @Patch('admin/courses/:id')
  @Roles(UserRole.ADMIN)
  updateCourse(@Param('id') id: string, @Body() dto: UpdateCourseDto) { return this.service.updateCourse(id, dto); }

  @Delete('admin/courses/:id')
  @Roles(UserRole.ADMIN)
  deleteCourse(@Param('id') id: string) { return this.service.deleteCourse(id); }

  @Post('admin/courses/:id/units')
  @Roles(UserRole.ADMIN)
  addUnit(@Param('id') id: string, @Body() dto: UnitDto) { return this.service.addUnit(id, dto); }

  @Patch('admin/courses/:id/units/:unitId')
  @Roles(UserRole.ADMIN)
  updateUnit(@Param('id') id: string, @Param('unitId') unitId: string, @Body() dto: UnitDto) { return this.service.updateUnit(id, unitId, dto); }

  @Post('admin/courses/:id/units/:unitId/move')
  @Roles(UserRole.ADMIN)
  moveUnit(@Param('id') id: string, @Param('unitId') unitId: string, @Body() dto: MoveDto) { return this.service.moveUnit(id, unitId, dto.dir); }

  @Delete('admin/courses/:id/units/:unitId')
  @Roles(UserRole.ADMIN)
  deleteUnit(@Param('id') id: string, @Param('unitId') unitId: string) { return this.service.deleteUnit(id, unitId); }

  @Post('admin/courses/:id/units/:unitId/lessons')
  @Roles(UserRole.ADMIN)
  addLesson(@Param('id') id: string, @Param('unitId') unitId: string, @Body() dto: LessonDto) { return this.service.addLesson(id, unitId, dto); }

  @Patch('admin/courses/:id/units/:unitId/lessons/:lessonId')
  @Roles(UserRole.ADMIN)
  updateLesson(@Param('id') id: string, @Param('unitId') unitId: string, @Param('lessonId') lessonId: string, @Body() dto: UpdateLessonDto) {
    return this.service.updateLesson(id, unitId, lessonId, dto);
  }

  @Delete('admin/courses/:id/units/:unitId/lessons/:lessonId')
  @Roles(UserRole.ADMIN)
  deleteLesson(@Param('id') id: string, @Param('unitId') unitId: string, @Param('lessonId') lessonId: string) {
    return this.service.deleteLesson(id, unitId, lessonId);
  }

  @Post('admin/draft')
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'AI first draft of a lesson (admin reviews before saving)' })
  draft(@Body() dto: DraftDto) { return this.service.draft(dto); }

  // ── Learners ──

  @Get('me')
  me(@Req() req: any) { return this.service.me(uid(req)); }

  @Patch('me')
  updateMe(@Req() req: any, @Body() dto: UpdateLanguageProfileDto) { return this.service.updateMe(uid(req), dto); }

  @Get('courses')
  courses(@Req() req: any, @Headers('accept-language') lang?: string) { return this.service.courses(uid(req), uiLang(lang)); }

  @Get('courses/:courseId')
  path(@Req() req: any, @Param('courseId') courseId: string, @Headers('accept-language') lang?: string) {
    return this.service.path(uid(req), courseId, uiLang(lang));
  }

  @Get('courses/:courseId/lessons/:lessonId')
  lesson(@Req() req: any, @Param('courseId') courseId: string, @Param('lessonId') lessonId: string) {
    return this.service.lesson(uid(req), courseId, lessonId);
  }

  @Post('courses/:courseId/lessons/:lessonId/complete')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  complete(@Req() req: any, @Param('courseId') courseId: string, @Param('lessonId') lessonId: string, @Body() dto: CompleteLessonDto) {
    return this.service.complete(uid(req), courseId, lessonId, dto);
  }
}
