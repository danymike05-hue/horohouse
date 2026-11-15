import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/schemas/user.schema';
import { LanguagesService } from './languages.service';
import {
  BuyDto, CompleteLessonDto, CourseDto, DraftDto, ExplainDto, LessonDto, ResultsDto, SpendLivesDto, StoryCompleteDto, UnitDto,
  UpdateCourseDto, UpdateLanguageProfileDto, UpdateLessonDto,
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

  @Get('shop')
  shop(@Req() req: any) { return this.service.shop(uid(req)); }

  @Post('shop/buy')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  buy(@Req() req: any, @Body() dto: BuyDto) { return this.service.buy(uid(req), dto.item); }

  @Post('lives/spend')
  spendLives(@Req() req: any, @Body() dto: SpendLivesDto) { return this.service.spendLives(uid(req), dto.count); }

  @Get('badges')
  badges(@Req() req: any) { return this.service.badges(uid(req)); }

  @Get('friends')
  friends(@Req() req: any) { return this.service.friends(uid(req)); }

  @Post('follow/:userId')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  follow(@Req() req: any, @Param('userId') followId: string) { return this.service.follow(uid(req), followId); }

  @Delete('follow/:userId')
  unfollow(@Req() req: any, @Param('userId') followId: string) { return this.service.unfollow(uid(req), followId); }

  @Post('explain')
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'AI: a short explanation of a wrong answer' })
  explain(@Body() dto: ExplainDto) { return this.service.explain(dto); }

  @Get('league')
  @ApiOperation({ summary: "This week's league: my campus, and campus against campus" })
  league(@Req() req: any) { return this.service.league(uid(req)); }

  @Get('courses')
  courses(@Req() req: any, @Headers('accept-language') lang?: string) { return this.service.courses(uid(req), uiLang(lang)); }

  @Get('courses/:courseId')
  path(@Req() req: any, @Param('courseId') courseId: string, @Headers('accept-language') lang?: string) {
    return this.service.path(uid(req), courseId, uiLang(lang));
  }

  @Get('courses/:courseId/practice')
  @ApiOperation({ summary: 'Review session: due and weak exercises from finished lessons' })
  practice(@Req() req: any, @Param('courseId') courseId: string, @Query('kind') kind?: string) {
    return this.service.practice(uid(req), courseId, kind === 'mistakes' ? 'mistakes' : 'review');
  }

  @Post('courses/:courseId/practice/complete')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  completePractice(@Req() req: any, @Param('courseId') courseId: string, @Body() dto: ResultsDto) {
    return this.service.completePractice(uid(req), courseId, dto);
  }

  @Get('courses/:courseId/placement')
  @ApiOperation({ summary: 'Placement test: a few questions per unit' })
  placement(@Req() req: any, @Param('courseId') courseId: string) { return this.service.placement(uid(req), courseId); }

  @Post('courses/:courseId/placement')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  submitPlacement(@Req() req: any, @Param('courseId') courseId: string, @Body() dto: ResultsDto) {
    return this.service.submitPlacement(uid(req), courseId, dto);
  }

  @Get('courses/:courseId/units/:unitId/checkpoint')
  checkpoint(@Req() req: any, @Param('courseId') courseId: string, @Param('unitId') unitId: string) {
    return this.service.checkpoint(uid(req), courseId, unitId);
  }

  @Post('courses/:courseId/units/:unitId/checkpoint')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  completeCheckpoint(@Req() req: any, @Param('courseId') courseId: string, @Param('unitId') unitId: string, @Body() dto: ResultsDto) {
    return this.service.completeCheckpoint(uid(req), courseId, unitId, dto);
  }

  @Get('courses/:courseId/mock')
  mock(@Req() req: any, @Param('courseId') courseId: string) { return this.service.mock(uid(req), courseId); }

  @Post('courses/:courseId/mock')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  completeMock(@Req() req: any, @Param('courseId') courseId: string, @Body() dto: ResultsDto) {
    return this.service.completeMock(uid(req), courseId, dto);
  }

  @Get('courses/:courseId/words')
  words(@Req() req: any, @Param('courseId') courseId: string) { return this.service.words(uid(req), courseId); }

  @Get('courses/:courseId/stories/:storyId')
  story(@Req() req: any, @Param('courseId') courseId: string, @Param('storyId') storyId: string) {
    return this.service.story(uid(req), courseId, storyId);
  }

  @Post('courses/:courseId/stories/:storyId/complete')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  completeStory(@Req() req: any, @Param('courseId') courseId: string, @Param('storyId') storyId: string, @Body() dto: StoryCompleteDto) {
    return this.service.completeStory(uid(req), courseId, storyId, dto);
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
