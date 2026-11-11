import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { Public, RolesGuard } from '../auth/guards/roles.guard';
import { WishlistsService } from './wishlists.service';

class CreateWishlistDto {
  @IsString() @MinLength(1) @MaxLength(50) name: string;
  @IsOptional() @IsMongoId() propertyId?: string;
}
class RenameWishlistDto {
  @IsString() @MinLength(1) @MaxLength(50) name: string;
}

const uid = (req: any) => String(req.user?._id ?? req.user?.id);

@ApiTags('Wishlists')
@ApiBearerAuth('JWT-auth')
@Controller('wishlists')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WishlistsController {
  constructor(private readonly service: WishlistsService) {}

  @Get()
  @ApiOperation({ summary: 'My wishlists' })
  mine(@Req() req: any) {
    return this.service.myLists(uid(req));
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateWishlistDto) {
    return this.service.create(uid(req), dto.name, dto.propertyId);
  }

  // Declared before ':id' routes so "shared" / "containing" aren't read as ids
  @Get('shared/:token')
  @Public()
  @ApiOperation({ summary: 'A wishlist shared by link (no login)' })
  shared(@Param('token') token: string) {
    return this.service.shared(token);
  }

  @Get('containing/:propertyId')
  containing(@Req() req: any, @Param('propertyId') propertyId: string) {
    return this.service.listsContaining(uid(req), propertyId);
  }

  @Get(':id')
  detail(@Req() req: any, @Param('id') id: string) {
    return this.service.detail(uid(req), id);
  }

  @Patch(':id')
  rename(@Req() req: any, @Param('id') id: string, @Body() dto: RenameWishlistDto) {
    return this.service.rename(uid(req), id, dto.name);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(uid(req), id);
  }

  @Post(':id/properties/:propertyId')
  add(@Req() req: any, @Param('id') id: string, @Param('propertyId') propertyId: string) {
    return this.service.addProperty(uid(req), id, propertyId);
  }

  @Delete(':id/properties/:propertyId')
  removeProperty(@Req() req: any, @Param('id') id: string, @Param('propertyId') propertyId: string) {
    return this.service.removeProperty(uid(req), id, propertyId);
  }

  @Post(':id/share')
  share(@Req() req: any, @Param('id') id: string) {
    return this.service.share(uid(req), id);
  }

  @Delete(':id/share')
  stopSharing(@Req() req: any, @Param('id') id: string) {
    return this.service.stopSharing(uid(req), id);
  }
}
