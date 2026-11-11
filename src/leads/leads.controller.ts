import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Req } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/schemas/user.schema';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

/**
 * Leads: an agent's (or landlord's, or host's) own client list. Professionals and admins
 * only, and each sees just their own leads (admins see all).
 */
@ApiTags('leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.AGENT, UserRole.LANDLORD, UserRole.HOST, UserRole.ADMIN)
@Controller('leads')
export class LeadsController {
    constructor(private readonly leadsService: LeadsService) { }

    @Post()
    @ApiOperation({ summary: 'Create new lead' })
    @ApiResponse({ status: 201, description: 'The lead has been successfully created.' })
    create(@Body() createLeadDto: CreateLeadDto, @Req() req: any) {
        return this.leadsService.create(createLeadDto, req.user);
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get lead statistics (your own leads)' })
    getStats(@Req() req: any) {
        return this.leadsService.getStats(req.user);
    }

    @Get()
    @ApiOperation({ summary: 'Get your leads' })
    findAll(@Req() req: any) {
        return this.leadsService.findAll(req.user);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get one of your leads' })
    findOne(@Param('id') id: string, @Req() req: any) {
        return this.leadsService.findOne(id, req.user);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update one of your leads' })
    update(@Param('id') id: string, @Body() updateLeadDto: UpdateLeadDto, @Req() req: any) {
        return this.leadsService.update(id, updateLeadDto, req.user);
    }

    @Post(':id/notes')
    @ApiOperation({ summary: 'Add a note to one of your leads' })
    addNote(@Param('id') id: string, @Body('content') content: string, @Req() req: any) {
        return this.leadsService.addNote(id, content, req.user);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete one of your leads' })
    remove(@Param('id') id: string, @Req() req: any) {
        return this.leadsService.remove(id, req.user);
    }
}
