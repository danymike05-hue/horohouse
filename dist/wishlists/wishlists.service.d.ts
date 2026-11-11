import { Model } from 'mongoose';
import { WishlistDocument } from './wishlist.schema';
import { PropertyDocument } from '../properties/schemas/property.schema';
import { UserDocument } from '../users/schemas/user.schema';
export declare class WishlistsService {
    private readonly wishlistModel;
    private readonly propertyModel;
    private readonly userModel;
    constructor(wishlistModel: Model<WishlistDocument>, propertyModel: Model<PropertyDocument>, userModel: Model<UserDocument>);
    private webBase;
    private shareLink;
    myLists(userId: string): Promise<{
        id: string;
        name: string;
        count: number;
        coverUrls: any[];
        propertyIds: string[];
        shareLink: string | null;
        updatedAt: Date | undefined;
    }[]>;
    create(userId: string, name: string, propertyId?: string): Promise<{
        id: string;
        name: string;
        count: number;
    }>;
    rename(userId: string, id: string, name: string): Promise<{
        id: string;
        name: string;
    }>;
    remove(userId: string, id: string): Promise<{
        deleted: boolean;
    }>;
    private assertListing;
    addProperty(userId: string, id: string, propertyId: string): Promise<{
        added: boolean;
    }>;
    removeProperty(userId: string, id: string, propertyId: string): Promise<{
        removed: boolean;
    }>;
    private unsaveOrphans;
    listsContaining(userId: string, propertyId: string): Promise<string[]>;
    private cards;
    detail(userId: string, id: string): Promise<{
        id: string;
        name: string;
        shareLink: string | null;
        properties: any[];
    }>;
    share(userId: string, id: string): Promise<{
        shareLink: string | null;
        token: string;
    }>;
    stopSharing(userId: string, id: string): Promise<{
        shareLink: null;
    }>;
    shared(token: string): Promise<{
        name: string;
        ownerFirstName: string | null;
        ownerPicture: any;
        properties: any[];
    }>;
}
