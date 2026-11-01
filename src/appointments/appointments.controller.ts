import {
    Controller, Get, Post, Body, Param, Put, Delete,
    UseGuards, Req, Query,
} from '@nestjs/common';
import { AppointmentsService, AppointmentFilters } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { ScheduleTourDto } from './dto/schedule-tour.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { User, UserRole } from '../users/schemas/user.schema';
import { AppointmentStatus, AppointmentType } from './schemas/appointment.schema';

@ApiTags('appointments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('appointments')
export class AppointmentsController {
    constructor(private readonly appointmentsService: AppointmentsService) { }

    @Post()
    @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
    @ApiOperation({ summary: 'Create a new appointment (agents & admins only)' })
    @ApiResponse({ status: 201, description: 'Appointment created' })
    @ApiResponse({ status: 400, description: 'Scheduling conflict or validation error' })
    create(
        @Body() dto: CreateAppointmentDto,
        @Req() req: FastifyRequest & { user: User },
    ) {
        return this.appointmentsService.create(dto, req.user);
    }

    @Post('schedule')
    @Roles(UserRole.REGISTERED_USER, UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
    @ApiOperation({ summary: 'Schedule a property tour (all authenticated users)' })
    @ApiResponse({ status: 201, description: 'Tour scheduled successfully' })
    @ApiResponse({ status: 400, description: 'Scheduling conflict or validation error' })
    scheduleTour(
        @Body() dto: ScheduleTourDto,
        @Req() req: FastifyRequest & { user: User },
    ) {
        return this.appointmentsService.scheduleTour(dto, req.user);
    }

    @Get('stats')
    @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
    @ApiOperation({ summary: 'Get appointment statistics (scoped to current user)' })
    getStats(@Req() req: FastifyRequest & { user: User }) {
        return this.appointmentsService.getStats(req.user);
    }

    @Get('my-tours')
    @Roles(UserRole.REGISTERED_USER, UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
    @ApiOperation({ summary: 'Get tours scheduled by the current user (as client)' })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    getMyTours(
        @Req() req: FastifyRequest & { user: User },
        @Query('limit') limit?: string,
    ) {
        return this.appointmentsService.findMyTours(req.user, limit ? parseInt(limit) : 10);
    }

    @Get()
    @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
    @ApiOperation({ summary: 'Get appointments (scoped to agent; admin can view all)' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'status', required: false, enum: AppointmentStatus })
    @ApiQuery({ name: 'type', required: false, enum: AppointmentType })
    @ApiQuery({ name: 'startDate', required: false, type: String, description: 'ISO date string' })
    @ApiQuery({ name: 'endDate', required: false, type: String, description: 'ISO date string' })
    @ApiQuery({ name: 'search', required: false, type: String })
    @ApiQuery({ name: 'agentId', required: false, type: String, description: 'Admin only: filter by agent' })
    findAll(
        @Req() req: FastifyRequest & { user: User },
        @Query() query: any,
    ) {
        const filters: AppointmentFilters = {
            page: query.page ? parseInt(query.page) : 1,
            limit: query.limit ? parseInt(query.limit) : 50,
            status: query.status,
            type: query.type,
            startDate: query.startDate ? new Date(query.startDate) : undefined,
            endDate: query.endDate ? new Date(query.endDate) : undefined,
            search: query.search,
            agentId: query.agentId,
        };
        return this.appointmentsService.findAll(req.user, filters);
    }

    @Get(':id')
    @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
    @ApiOperation({ summary: 'Get a single appointment (owner or admin only)' })
    findOne(
        @Param('id') id: string,
        @Req() req: FastifyRequest & { user: User },
    ) {
        return this.appointmentsService.findOne(id, req.user);
    }

    @Put(':id')
    @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
    @ApiOperation({ summary: 'Update an appointment (owner or admin only)' })
    update(
        @Param('id') id: string,
        @Body() dto: UpdateAppointmentDto,
        @Req() req: FastifyRequest & { user: User },
    ) {
        return this.appointmentsService.update(id, dto, req.user);
    }

    @Post(':id/notes')
    @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
    @ApiOperation({ summary: 'Add a note to an appointment' })
    addNote(
        @Param('id') id: string,
        @Body('content') content: string,
        @Req() req: FastifyRequest & { user: User },
    ) {
        return this.appointmentsService.addNote(id, content, req.user);
    }

    @Delete(':id')
    @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
    @ApiOperation({ summary: 'Delete an appointment (owner or admin only)' })
    remove(
        @Param('id') id: string,
        @Req() req: FastifyRequest & { user: User },
    ) {
        return this.appointmentsService.remove(id, req.user);
    }
}
