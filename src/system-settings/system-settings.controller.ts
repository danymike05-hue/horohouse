import {
    Controller,
    Get,
    Patch,
    Body,
    UseGuards,
    UnauthorizedException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { SystemSettingsService } from './system-settings.service';
import { SystemSettings } from './schemas/system-settings.schema';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard, Roles, Public } from '../auth/guards/roles.guard';
import { UserRole } from '../users/schemas/user.schema';

@ApiTags('System Settings')
@Controller('system-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SystemSettingsController {
    constructor(private readonly settingsService: SystemSettingsService) { }

    @Get()
    @Public() // Allow public access to certain settings (e.g. site name)
    @ApiOperation({ summary: 'Get current system settings' })
    @ApiResponse({ status: 200, description: 'Settings retrieved successfully' })
    async getSettings(): Promise<SystemSettings> {
        return this.settingsService.getSettings();
    }

    @Patch()
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Update system settings (Admin only)' })
    @ApiResponse({ status: 200, description: 'Settings updated successfully' })
    async updateSettings(@Body() updateDto: Partial<SystemSettings>): Promise<SystemSettings> {
        return this.settingsService.updateSettings(updateDto);
    }
}
