import { PropertiesService } from './properties.service';
export declare class PropertyCalendarScheduler {
    private readonly propertiesService;
    private readonly logger;
    private running;
    constructor(propertiesService: PropertiesService);
    syncExternalCalendars(): Promise<void>;
}
