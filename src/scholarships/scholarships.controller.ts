import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/schemas/user.schema';
import { ScholarshipsService } from './scholarships.service';
import { CreateScholarshipDto, ScholarshipQueryDto, UpdateScholarshipDto } from './dto/scholarship.dto';

class AdminScholarshipQueryDto {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @IsIn(['published', 'draft', 'expired']) status?: 'published' | 'draft' | 'expired';
}

const uid = (req: any): string => String(req.user?._id ?? req.user?.id ?? req.user?.userId ?? req.user?.sub);

@ApiTags('Scholarships')
@ApiBearerAuth()
@Controller('scholarships')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScholarshipsController {
  constructor(private readonly service: ScholarshipsService) {}

  // ── Admins (before ":id" so these paths aren't read as an id) ──

  @Get('admin/all')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'All scholarships, drafts and expired included (admin)' })
  adminList(@Query() q: AdminScholarshipQueryDto) {
    return this.service.adminList(q);
  }

  @Post('admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Add a scholarship (admin)' })
  create(@Req() req: any, @Body() dto: CreateScholarshipDto) {
    return this.service.create(uid(req), dto);
  }

  @Patch('admin/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Edit, publish or unpublish a scholarship (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateScholarshipDto) {
    return this.service.update(id, dto);
  }

  @Delete('admin/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a scholarship (admin)' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ── Signed-in users ──

  @Get()
  @ApiOperation({ summary: 'Open scholarships, with filters; matched=true sorts by fit with my profile' })
  list(@Req() req: any, @Query() q: ScholarshipQueryDto) {
    return this.service.list(uid(req), q);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Open count, closing within 30 days, and the next five deadlines' })
  summary(@Req() req: any) {
    return this.service.summary(uid(req));
  }

  @Get('saved')
  @ApiOperation({ summary: 'Scholarships I saved' })
  saved(@Req() req: any) {
    return this.service.saved(uid(req));
  }

  @Get(':id')
  @ApiOperation({ summary: 'One scholarship' })
  detail(@Req() req: any, @Param('id') id: string) {
    return this.service.detail(uid(req), id);
  }

  @Post(':id/save')
  @ApiOperation({ summary: 'Save a scholarship (deadline reminders 14 and 3 days before)' })
  save(@Req() req: any, @Param('id') id: string) {
    return this.service.save(uid(req), id);
  }

  @Delete(':id/save')
  @ApiOperation({ summary: 'Remove a saved scholarship' })
  unsave(@Req() req: any, @Param('id') id: string) {
    return this.service.unsave(uid(req), id);
  }
}
