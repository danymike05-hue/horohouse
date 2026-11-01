import {
    Controller, Get, Post, Body, Patch, Param, Delete,
    UseGuards, Query, Req,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { SendWarningDto } from './dto/send-warning.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { UserRole } from '../users/schemas/user.schema';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) {}

    // ── User: submit a report ─────────────────────────────────────────────────

    @Post('property/:propertyId')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new report for a property' })
    create(
        @Param('propertyId') propertyId: string,
        @Body() createReportDto: CreateReportDto,
        @Req() req: any,
    ) {
        return this.reportsService.create(createReportDto, req.user._id, propertyId);
    }

    // ── Admin: list & stats ───────────────────────────────────────────────────

    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get all reports (Admin only)' })
    findAll(@Query() query: any) {
        return this.reportsService.findAll(query);
    }

    @Get('stats')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get report statistics (Admin only)' })
    getStats() {
        return this.reportsService.getStats();
    }

    @Get(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get a specific report by ID (Admin only)' })
    findOne(@Param('id') id: string) {
        return this.reportsService.findOne(id);
    }

    // ── Admin: update status ──────────────────────────────────────────────────

    @Patch(':id/status')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update report status (Admin only)' })
    updateStatus(
        @Param('id') id: string,
        @Body() updateReportStatusDto: UpdateReportStatusDto,
    ) {
        return this.reportsService.updateStatus(id, updateReportStatusDto);
    }

    // ── Admin: delete the report record itself ────────────────────────────────

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete a report record (Admin only)' })
    remove(@Param('id') id: string) {
        return this.reportsService.remove(id);
    }

    // ── Admin: delete the reported property ───────────────────────────────────

    @Delete(':id/property')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'Delete the property associated with a report (Admin only)',
        description:
            'Permanently removes the reported property from the platform and marks the report as resolved.',
    })
    @ApiParam({ name: 'id', description: 'Report ID' })
    deleteReportedProperty(
        @Param('id') id: string,
        @Req() req: any,
    ) {
        return this.reportsService.deleteReportedProperty(id, req.user);
    }

    // ── Admin: send warning email to property owner ───────────────────────────

    @Post(':id/warn-owner')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'Send a warning email/notification to the property owner (Admin only)',
        description:
            'Sends a customisable warning message via email and an in-app notification to the owner of the reported property.',
    })
    @ApiParam({ name: 'id', description: 'Report ID' })
    warnOwner(
        @Param('id') id: string,
        @Body() sendWarningDto: SendWarningDto,
        @Req() req: any,
    ) {
        return this.reportsService.warnOwner(id, sendWarningDto, req.user);
    }
}