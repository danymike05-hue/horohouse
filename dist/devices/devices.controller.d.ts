import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
export declare class DevicesController {
    private readonly devicesService;
    constructor(devicesService: DevicesService);
    register(req: any, dto: RegisterDeviceDto): Promise<{
        success: boolean;
    }>;
}
