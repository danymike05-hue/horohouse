import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  Logger,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { InquiryService, CreateInquiryDto, UpdateInquiryDto, InquiryFilters, InquiryOptions } from './inquiry.service';
import { Request } from 'express';
import { User } from '../users/schemas/user.schema';

@Controller('inquiries')
@UseGuards(JwtAuthGuard)
export class InquiryController {
  private readonly logger = new Logger(InquiryController.name);

  constructor(private readonly inquiryService: InquiryService) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  // Create a new inquiry for a property
  @Post()
  async create(
    @Body() body: any,
    @Req() req: Request,
  ) {
    const user = req.user as User;
    
    // Log what we received
    this.logger.log('=== INQUIRY CREATE REQUEST ===');
    this.logger.log('Raw body:', JSON.stringify(body, null, 2));
    this.logger.log('Body type:', typeof body);
    this.logger.log('Body keys:', body ? Object.keys(body) : 'null');
    this.logger.log('PropertyId:', body?.propertyId);
    
    // Check if body is null or undefined
    if (!body) {
      this.logger.error('Request body is null or undefined');
      throw new Error('Request body is required');
    }
    
    // Create the DTO manually to ensure all fields are properly mapped
    const createInquiryDto: CreateInquiryDto = {
      propertyId: body.propertyId,
      message: body.message,
      type: body.type,
      preferredContactMethod: body.preferredContactMethod,
      preferredContactTime: body.preferredContactTime,
      viewingDate: body.viewingDate,
      budget: body.budget,
      moveInDate: body.moveInDate,
      contactEmail: body.email || body.contactEmail,
      contactPhone: body.phone || body.contactPhone,
    };
    
    this.logger.log('Constructed DTO:', JSON.stringify(createInquiryDto, null, 2));
    
    // Validate required fields
    if (!createInquiryDto.propertyId) {
      this.logger.error('PropertyId is missing from request');
      throw new Error('PropertyId is required');
    }
    
    if (!createInquiryDto.message) {
      this.logger.error('Message is missing from request');
      throw new Error('Message is required');
    }
    
    return this.inquiryService.create(createInquiryDto, user);
  }

  // Rest of the controller remains the same...
  @Get()
  async findAll(
    @Query('propertyId') propertyId: string,
    @Query('agentId') agentId: string,
    @Query('userId') userId: string,
    @Query('status') status: string,
    @Query('type') type: string,
    @Query('isRead') isRead: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('sortBy') sortBy = 'createdAt',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'desc',
    @Req() req: Request,
  ) {
    const user = req.user as User;

    const filters: InquiryFilters = {
      propertyId: propertyId || undefined,
      agentId: agentId || undefined,
      userId: userId || undefined,
      status: status as any,
      type: type as any,
      isRead: typeof isRead !== 'undefined' ? isRead === 'true' : undefined,
    };

    const options: InquiryOptions = {
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 20, 100),
      sortBy,
      sortOrder,
    };

    return this.inquiryService.findAll(filters, options, user);
  }

  @Get('stats')
  async stats(@Req() req: Request) {
    const user = req.user as User;
    return this.inquiryService.getInquiryStats(user);
  }

  @Get('property/:propertyId')
  async forProperty(
    @Param('propertyId') propertyId: string,
    @Req() req: Request,
  ) {
    const user = req.user as User;
    return this.inquiryService.getInquiriesForProperty(propertyId, user);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as User;
    return this.inquiryService.findOne(id, user);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateInquiryDto: UpdateInquiryDto,
    @Req() req: Request,
  ) {
    const user = req.user as User;
    return this.inquiryService.update(id, updateInquiryDto, user);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as User;
    return this.inquiryService.markAsRead(id, user);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as User;
    await this.inquiryService.remove(id, user);
    return { success: true };
  }
}