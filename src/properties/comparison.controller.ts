import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';

import { ComparisonService, CreateComparisonDto, UpdateComparisonDto } from './comparison.service';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard, Roles, Public } from '../auth/guards/roles.guard';
import { User, UserRole } from '../users/schemas/user.schema';

@ApiTags('comparisons')
@Controller('comparisons')
export class ComparisonController {
  constructor(private readonly comparisonService: ComparisonService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.REGISTERED_USER, UserRole.AGENT, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new property comparison' })
  @ApiResponse({ status: 201, description: 'Comparison created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid property IDs or count' })
  async create(
    @Body() createComparisonDto: CreateComparisonDto,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.comparisonService.create(createComparisonDto, req.user);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.REGISTERED_USER, UserRole.AGENT, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all comparisons for the authenticated user' })
  async findAll(@Req() req: FastifyRequest & { user: User }) {
    return this.comparisonService.findAll(req.user);
  }

  @Get('public')
  @Public()
  @ApiOperation({ summary: 'Get public property comparisons' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getPublicComparisons(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit) : 10;
    return this.comparisonService.getPublicComparisons(limitNum);
  }

  @Get('share/:shareToken')
  @Public()
  @ApiOperation({ summary: 'Get a comparison by share token' })
  @ApiParam({ name: 'shareToken', type: String })
  async findByShareToken(@Param('shareToken') shareToken: string) {
    return this.comparisonService.findByShareToken(shareToken);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a specific comparison by ID' })
  @ApiParam({ name: 'id', type: String })
  async findOne(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user?: User },
  ) {
    return this.comparisonService.findOne(id, req.user);
  }

  @Post(':id/share')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.REGISTERED_USER, UserRole.AGENT, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate share URL for a comparison' })
  @ApiParam({ name: 'id', type: String })
  async generateShareUrl(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.comparisonService.generateShareUrl(id, req.user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.REGISTERED_USER, UserRole.AGENT, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a comparison' })
  @ApiParam({ name: 'id', type: String })
  async update(
    @Param('id') id: string,
    @Body() updateComparisonDto: UpdateComparisonDto,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.comparisonService.update(id, updateComparisonDto, req.user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.REGISTERED_USER, UserRole.AGENT, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a comparison' })
  @ApiParam({ name: 'id', type: String })
  async remove(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    await this.comparisonService.remove(id, req.user);
    return { message: 'Comparison deleted successfully' };
  }
}
