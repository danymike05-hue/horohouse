"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const rooms_service_1 = require("./rooms.service");
const room_dto_1 = require("./dto/room.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const user_schema_1 = require("../users/schemas/user.schema");
let RoomsController = class RoomsController {
    roomsService;
    constructor(roomsService) {
        this.roomsService = roomsService;
    }
    async createRoom(dto, req) {
        return this.roomsService.createRoom(dto, req.user);
    }
    async getRoomsByProperty(propertyId, includeInactive) {
        return this.roomsService.getRoomsByProperty(propertyId, includeInactive === 'true');
    }
    async getRoomById(id) {
        return this.roomsService.getRoomById(id);
    }
    async updateRoom(id, dto, req) {
        return this.roomsService.updateRoom(id, dto, req.user);
    }
    async deleteRoom(id, req) {
        return this.roomsService.deleteRoom(id, req.user);
    }
    async uploadImages(id, req) {
        const files = [];
        const parts = req.parts();
        for await (const part of parts) {
            if (part.type === 'file') {
                const chunks = [];
                for await (const chunk of part.file) {
                    chunks.push(Buffer.from(chunk));
                }
                files.push({ buffer: Buffer.concat(chunks) });
            }
        }
        const room = await this.roomsService.uploadImages(id, files, req.user);
        return { message: 'Images uploaded successfully', room };
    }
    async deleteImage(id, imageId, req) {
        const decodedImageId = decodeURIComponent(imageId);
        const room = await this.roomsService.deleteImage(id, decodedImageId, req.user);
        return { message: 'Image deleted successfully', room };
    }
    async blockDates(id, dto, req) {
        return this.roomsService.blockRoomDates(id, dto, req.user);
    }
    async unblockDates(id, dto, req) {
        return this.roomsService.unblockRoomDates(id, dto, req.user);
    }
    async setIcalUrl(id, dto, req) {
        return this.roomsService.setIcalUrl(id, dto, req.user);
    }
    async syncIcal(id) {
        return this.roomsService.syncIcal(id);
    }
    async getRoomAvailability(id, query) {
        if (!query.from || !query.to) {
            throw new common_1.BadRequestException('Both "from" and "to" query params are required');
        }
        return this.roomsService.getRoomAvailability(id, new Date(query.from), new Date(query.to));
    }
};
exports.RoomsController = RoomsController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create a room for a hotel/hostel/motel property' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Room created' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Property does not support rooms (non hotel/hostel type)' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Not your property' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [room_dto_1.CreateRoomDto, Object]),
    __metadata("design:returntype", Promise)
], RoomsController.prototype, "createRoom", null);
__decorate([
    (0, common_1.Get)('property/:propertyId'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'List all active rooms for a property' }),
    (0, swagger_1.ApiParam)({ name: 'propertyId', description: 'Property ID' }),
    (0, swagger_1.ApiQuery)({ name: 'includeInactive', required: false, type: Boolean }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Array of rooms' }),
    __param(0, (0, common_1.Param)('propertyId')),
    __param(1, (0, common_1.Query)('includeInactive')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], RoomsController.prototype, "getRoomsByProperty", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get a single room by ID' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Room ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Room details' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Room not found' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RoomsController.prototype, "getRoomById", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Update a room' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Room ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Room updated' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, room_dto_1.UpdateRoomDto, Object]),
    __metadata("design:returntype", Promise)
], RoomsController.prototype, "updateRoom", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Soft-delete a room (marks isActive = false)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Room ID' }),
    (0, swagger_1.ApiResponse)({ status: 204, description: 'Room deactivated' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], RoomsController.prototype, "deleteRoom", null);
__decorate([
    (0, common_1.Post)(':id/images'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Upload images to a specific room' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Room ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Images uploaded successfully', type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], RoomsController.prototype, "uploadImages", null);
__decorate([
    (0, common_1.Delete)(':id/images/:imageId'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a specific room image' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Room ID' }),
    (0, swagger_1.ApiParam)({ name: 'imageId', description: 'Cloudinary Public ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Image deleted successfully', type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('imageId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], RoomsController.prototype, "deleteImage", null);
__decorate([
    (0, common_1.Post)(':id/block-dates'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Block date ranges on a specific room (manual)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Room ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Dates blocked' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, room_dto_1.BlockRoomDatesDto, Object]),
    __metadata("design:returntype", Promise)
], RoomsController.prototype, "blockDates", null);
__decorate([
    (0, common_1.Post)(':id/unblock-dates'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Unblock manually blocked date ranges from a room' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Room ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Dates unblocked' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, room_dto_1.UnblockRoomDatesDto, Object]),
    __metadata("design:returntype", Promise)
], RoomsController.prototype, "unblockDates", null);
__decorate([
    (0, common_1.Patch)(':id/ical-url'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Set the iCal feed URL for a room (Airbnb, Booking.com, etc.)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Room ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'iCal URL saved' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, room_dto_1.SetIcalUrlDto, Object]),
    __metadata("design:returntype", Promise)
], RoomsController.prototype, "setIcalUrl", null);
__decorate([
    (0, common_1.Post)(':id/sync-ical'),
    (0, roles_guard_1.Roles)(user_schema_1.UserRole.HOST, user_schema_1.UserRole.AGENT, user_schema_1.UserRole.LANDLORD, user_schema_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Manually trigger iCal sync for a room' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Room ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Sync result with number of imported ranges' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RoomsController.prototype, "syncIcal", null);
__decorate([
    (0, common_1.Get)(':id/availability'),
    (0, roles_guard_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get blocked and booked date ranges for a specific room' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Room ID' }),
    (0, swagger_1.ApiQuery)({ name: 'from', required: true, type: String, description: 'Range start (ISO date)' }),
    (0, swagger_1.ApiQuery)({ name: 'to', required: true, type: String, description: 'Range end (ISO date)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Room availability result' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, room_dto_1.RoomAvailabilityQueryDto]),
    __metadata("design:returntype", Promise)
], RoomsController.prototype, "getRoomAvailability", null);
exports.RoomsController = RoomsController = __decorate([
    (0, swagger_1.ApiTags)('Rooms'),
    (0, common_1.Controller)('rooms'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [rooms_service_1.RoomsService])
], RoomsController);
//# sourceMappingURL=rooms.controller.js.map