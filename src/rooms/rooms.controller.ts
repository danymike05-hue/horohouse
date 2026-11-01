import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Body,
    Query,
    Req,
    UseGuards,
    HttpCode,
    HttpStatus,
    BadRequestException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiQuery,
} from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';

import { RoomsService } from './rooms.service';
import {
    CreateRoomDto,
    UpdateRoomDto,
    BlockRoomDatesDto,
    UnblockRoomDatesDto,
    SetIcalUrlDto,
    RoomAvailabilityQueryDto,
} from './dto/room.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard, Roles, Public } from '../auth/guards/roles.guard';
import { User, UserRole } from '../users/schemas/user.schema';

@ApiTags('Rooms')
@Controller('rooms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoomsController {
    constructor(private readonly roomsService: RoomsService) { }

    // ════════════════════════════════════════════════════════════════════════════
    // ROOM MANAGEMENT (Host / Admin)
    // ════════════════════════════════════════════════════════════════════════════

    @Post()
    @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a room for a hotel/hostel/motel property' })
    @ApiResponse({ status: 201, description: 'Room created' })
    @ApiResponse({ status: 400, description: 'Property does not support rooms (non hotel/hostel type)' })
    @ApiResponse({ status: 403, description: 'Not your property' })
    async createRoom(
        @Body() dto: CreateRoomDto,
        @Req() req: FastifyRequest & { user: User },
    ) {
        return this.roomsService.createRoom(dto, req.user);
    }

    @Get('property/:propertyId')
    @Public()
    @ApiOperation({ summary: 'List all active rooms for a property' })
    @ApiParam({ name: 'propertyId', description: 'Property ID' })
    @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
    @ApiResponse({ status: 200, description: 'Array of rooms' })
    async getRoomsByProperty(
        @Param('propertyId') propertyId: string,
        @Query('includeInactive') includeInactive?: string,
    ) {
        return this.roomsService.getRoomsByProperty(propertyId, includeInactive === 'true');
    }

    @Get(':id')
    @Public()
    @ApiOperation({ summary: 'Get a single room by ID' })
    @ApiParam({ name: 'id', description: 'Room ID' })
    @ApiResponse({ status: 200, description: 'Room details' })
    @ApiResponse({ status: 404, description: 'Room not found' })
    async getRoomById(@Param('id') id: string) {
        return this.roomsService.getRoomById(id);
    }

    @Patch(':id')
    @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update a room' })
    @ApiParam({ name: 'id', description: 'Room ID' })
    @ApiResponse({ status: 200, description: 'Room updated' })
    async updateRoom(
        @Param('id') id: string,
        @Body() dto: UpdateRoomDto,
        @Req() req: FastifyRequest & { user: User },
    ) {
        return this.roomsService.updateRoom(id, dto, req.user);
    }

    @Delete(':id')
    @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Soft-delete a room (marks isActive = false)' })
    @ApiParam({ name: 'id', description: 'Room ID' })
    @ApiResponse({ status: 204, description: 'Room deactivated' })
    async deleteRoom(
        @Param('id') id: string,
        @Req() req: FastifyRequest & { user: User },
    ) {
        return this.roomsService.deleteRoom(id, req.user);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // MEDIA (Images)
    // ════════════════════════════════════════════════════════════════════════════

    @Post(':id/images')
    @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Upload images to a specific room' })
    @ApiParam({ name: 'id', description: 'Room ID' })
    @ApiResponse({ status: 200, description: 'Images uploaded successfully', type: Object })
    async uploadImages(
        @Param('id') id: string,
        @Req() req: FastifyRequest & { user: User },
    ) {
        const files: { buffer: Buffer }[] = [];
        // @ts-ignore fastify types
        const parts = req.parts();
        for await (const part of parts as AsyncIterable<any>) {
            if (part.type === 'file') {
                const chunks: Buffer[] = [];
                for await (const chunk of part.file) {
                    chunks.push(Buffer.from(chunk));
                }
                files.push({ buffer: Buffer.concat(chunks) });
            }
        }
        const room = await this.roomsService.uploadImages(id, files, req.user);
        return { message: 'Images uploaded successfully', room };
    }

    @Delete(':id/images/:imageId')
    @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete a specific room image' })
    @ApiParam({ name: 'id', description: 'Room ID' })
    @ApiParam({ name: 'imageId', description: 'Cloudinary Public ID' })
    @ApiResponse({ status: 200, description: 'Image deleted successfully', type: Object })
    async deleteImage(
        @Param('id') id: string,
        @Param('imageId') imageId: string,
        @Req() req: FastifyRequest & { user: User },
    ) {
        // publicId's often contain slashes from folders like "horohouse/rooms/images/123", so they need decoding
        const decodedImageId = decodeURIComponent(imageId);
        const room = await this.roomsService.deleteImage(id, decodedImageId, req.user);
        return { message: 'Image deleted successfully', room };
    }

    // ════════════════════════════════════════════════════════════════════════════
    // DATE BLOCKING
    // ════════════════════════════════════════════════════════════════════════════

    @Post(':id/block-dates')
    @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Block date ranges on a specific room (manual)' })
    @ApiParam({ name: 'id', description: 'Room ID' })
    @ApiResponse({ status: 200, description: 'Dates blocked' })
    async blockDates(
        @Param('id') id: string,
        @Body() dto: BlockRoomDatesDto,
        @Req() req: FastifyRequest & { user: User },
    ) {
        return this.roomsService.blockRoomDates(id, dto, req.user);
    }

    @Post(':id/unblock-dates')
    @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Unblock manually blocked date ranges from a room' })
    @ApiParam({ name: 'id', description: 'Room ID' })
    @ApiResponse({ status: 200, description: 'Dates unblocked' })
    async unblockDates(
        @Param('id') id: string,
        @Body() dto: UnblockRoomDatesDto,
        @Req() req: FastifyRequest & { user: User },
    ) {
        return this.roomsService.unblockRoomDates(id, dto, req.user);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // iCAL SYNC (off-platform booking management)
    // ════════════════════════════════════════════════════════════════════════════

    @Patch(':id/ical-url')
    @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Set the iCal feed URL for a room (Airbnb, Booking.com, etc.)' })
    @ApiParam({ name: 'id', description: 'Room ID' })
    @ApiResponse({ status: 200, description: 'iCal URL saved' })
    async setIcalUrl(
        @Param('id') id: string,
        @Body() dto: SetIcalUrlDto,
        @Req() req: FastifyRequest & { user: User },
    ) {
        return this.roomsService.setIcalUrl(id, dto, req.user);
    }

    @Post(':id/sync-ical')
    @Roles(UserRole.HOST, UserRole.AGENT, UserRole.LANDLORD, UserRole.ADMIN)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Manually trigger iCal sync for a room' })
    @ApiParam({ name: 'id', description: 'Room ID' })
    @ApiResponse({ status: 200, description: 'Sync result with number of imported ranges' })
    async syncIcal(@Param('id') id: string) {
        return this.roomsService.syncIcal(id);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // AVAILABILITY (Public)
    // ════════════════════════════════════════════════════════════════════════════

    @Get(':id/availability')
    @Public()
    @ApiOperation({ summary: 'Get blocked and booked date ranges for a specific room' })
    @ApiParam({ name: 'id', description: 'Room ID' })
    @ApiQuery({ name: 'from', required: true, type: String, description: 'Range start (ISO date)' })
    @ApiQuery({ name: 'to', required: true, type: String, description: 'Range end (ISO date)' })
    @ApiResponse({ status: 200, description: 'Room availability result' })
    async getRoomAvailability(
        @Param('id') id: string,
        @Query() query: RoomAvailabilityQueryDto,
    ) {
        if (!query.from || !query.to) {
            throw new BadRequestException('Both "from" and "to" query params are required');
        }
        return this.roomsService.getRoomAvailability(id, new Date(query.from), new Date(query.to));
    }
}
