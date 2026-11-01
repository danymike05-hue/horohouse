import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt.auth.guard';
import { SavedSearchesService } from './saved-searches.service';
import { CreateSavedSearchDto, UpdateSavedSearchDto } from './dto/saved-search.dto';

@Controller('saved-searches')
@UseGuards(JwtAuthGuard)
export class SavedSearchesController {
  constructor(private readonly savedSearchesService: SavedSearchesService) {}

  /**
   * Create a new saved search
   * POST /api/v1/saved-searches
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDto: CreateSavedSearchDto, @Request() req: any) {
    return this.savedSearchesService.create(createDto, req.user._id.toString());
  }

  /**
   * Get all saved searches for current user
   * GET /api/v1/saved-searches
   */
  @Get()
  async findAll(@Request() req: any) {
    return this.savedSearchesService.findAllByUser(req.user._id.toString());
  }

  /**
   * Get statistics for user's saved searches
   * GET /api/v1/saved-searches/statistics
   * IMPORTANT: This MUST come before the :id route
   */
  @Get('statistics')
  async getStatistics(@Request() req: any) {
    return this.savedSearchesService.getStatistics(req.user._id.toString());
  }

  /**
   * Get matching properties for a saved search
   * GET /api/v1/saved-searches/:id/properties
   * IMPORTANT: This MUST come before the plain :id route
   */
  @Get(':id/properties')
  async getMatchingProperties(
    @Param('id') id: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Request() req: any,
  ) {
    return this.savedSearchesService.getMatchingProperties(
      id,
      req.user._id.toString(),
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  /**
   * Get a specific saved search
   * GET /api/v1/saved-searches/:id
   * IMPORTANT: This MUST come AFTER all specific routes
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.savedSearchesService.findOne(id, req.user._id.toString());
  }

  /**
   * Update a saved search
   * PATCH /api/v1/saved-searches/:id
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateSavedSearchDto,
    @Request() req: any,
  ) {
    return this.savedSearchesService.update(id, updateDto, req.user._id.toString());
  }

  /**
   * Delete a saved search
   * DELETE /api/v1/saved-searches/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @Request() req: any) {
    await this.savedSearchesService.remove(id, req.user._id.toString());
  }
}