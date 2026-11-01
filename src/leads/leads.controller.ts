import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leads')
export class LeadsController {
    constructor(private readonly leadsService: LeadsService) { }

    @Post()
    @ApiOperation({ summary: 'Create new lead' })
    @ApiResponse({ status: 201, description: 'The lead has been successfully created.' })
    create(@Body() createLeadDto: CreateLeadDto) {
        return this.leadsService.create(createLeadDto);
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get lead statistics' })
    getStats() {
        return this.leadsService.getStats();
    }

    @Get()
    @ApiOperation({ summary: 'Get all leads' })
    findAll() {
        return this.leadsService.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a lead by id' })
    findOne(@Param('id') id: string) {
        return this.leadsService.findOne(id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update a lead' })
    update(@Param('id') id: string, @Body() updateLeadDto: UpdateLeadDto) {
        return this.leadsService.update(id, updateLeadDto);
    }

    @Post(':id/notes')
    @ApiOperation({ summary: 'Add a note to a lead' })
    addNote(@Param('id') id: string, @Body('content') content: string) {
        return this.leadsService.addNote(id, content);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a lead' })
    remove(@Param('id') id: string) {
        return this.leadsService.remove(id);
    }
}
