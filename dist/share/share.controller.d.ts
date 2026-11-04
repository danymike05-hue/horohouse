import { ShareService } from './share.service';
export declare class ShareController {
    private readonly share;
    constructor(share: ShareService);
    property(id: string, lang?: string): Promise<import("./share.service").ShareInfo>;
    host(id: string, lang?: string): Promise<import("./share.service").ShareInfo>;
    propertyPoster(id: string, lang?: string): Promise<string>;
    hostPoster(id: string, lang?: string): Promise<string>;
}
