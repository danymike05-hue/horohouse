import { HostMessagesService } from './host-messages.service';
export declare class HostMessagesScheduler {
    private readonly service;
    private readonly logger;
    private running;
    constructor(service: HostMessagesService);
    tick(): Promise<void>;
}
