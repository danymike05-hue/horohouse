import { Model } from 'mongoose';
import { PropertyDocument } from '../properties/schemas/property.schema';
import { UserDocument } from '../users/schemas/user.schema';
type Lang = 'en' | 'fr';
export interface ShareInfo {
    kind: 'property' | 'host';
    id: string;
    title: string;
    subtitle: string;
    imageUrl: string | null;
    link: string;
    qrLink: string;
    qrDataUrl: string;
    posterUrl: string;
    isLive: boolean;
}
export declare class ShareService {
    private readonly propertyModel;
    private readonly userModel;
    constructor(propertyModel: Model<PropertyDocument>, userModel: Model<UserDocument>);
    private webBase;
    private apiBase;
    private qr;
    private qrSvg;
    private loadProperty;
    private loadHost;
    getPropertyShare(id: string, lang?: Lang): Promise<ShareInfo>;
    getHostShare(id: string, lang?: Lang): Promise<ShareInfo>;
    propertyPoster(id: string, lang?: Lang): Promise<string>;
    hostPoster(id: string, lang?: Lang): Promise<string>;
    private poster;
}
export {};
