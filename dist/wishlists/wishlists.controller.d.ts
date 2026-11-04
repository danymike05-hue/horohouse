import { WishlistsService } from './wishlists.service';
declare class CreateWishlistDto {
    name: string;
    propertyId?: string;
}
declare class RenameWishlistDto {
    name: string;
}
export declare class WishlistsController {
    private readonly service;
    constructor(service: WishlistsService);
    mine(req: any): Promise<{
        id: string;
        name: string;
        count: number;
        coverUrls: any[];
        propertyIds: string[];
        shareLink: string | null;
        updatedAt: Date | undefined;
    }[]>;
    create(req: any, dto: CreateWishlistDto): Promise<{
        id: string;
        name: string;
        count: number;
    }>;
    shared(token: string): Promise<{
        name: string;
        ownerFirstName: string | null;
        ownerPicture: any;
        properties: any[];
    }>;
    containing(req: any, propertyId: string): Promise<string[]>;
    detail(req: any, id: string): Promise<{
        id: string;
        name: string;
        shareLink: string | null;
        properties: any[];
    }>;
    rename(req: any, id: string, dto: RenameWishlistDto): Promise<{
        id: string;
        name: string;
    }>;
    remove(req: any, id: string): Promise<{
        deleted: boolean;
    }>;
    add(req: any, id: string, propertyId: string): Promise<{
        added: boolean;
    }>;
    removeProperty(req: any, id: string, propertyId: string): Promise<{
        removed: boolean;
    }>;
    share(req: any, id: string): Promise<{
        shareLink: string | null;
        token: string;
    }>;
    stopSharing(req: any, id: string): Promise<{
        shareLink: null;
    }>;
}
export {};
