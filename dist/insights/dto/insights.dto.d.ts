import { PostType } from '../schemas/post.schema';
declare class CoverImageDto {
    url: string;
    publicId: string;
    alt?: string;
    caption?: string;
    width?: number;
    height?: number;
}
declare class SeoDto {
    metaTitle?: string;
    metaDescription?: string;
    ogImage?: string;
    ogTitle?: string;
    ogDescription?: string;
    canonicalUrl?: string;
    noIndex?: boolean;
}
declare class NeighborhoodDto {
    name: string;
    city: string;
    country?: string;
    coordinates?: {
        lat: number;
        lng: number;
    };
}
declare class MarketDataDto {
    averagePrice?: number;
    priceChange?: number;
    demandIndex?: number;
    currency?: string;
    dataDate?: string;
    source?: string;
}
declare class CtaDto {
    type: string;
    label: string;
    url?: string;
    propertyId?: string;
}
export declare class CreatePostDto {
    title: string;
    excerpt: string;
    content: Record<string, any>;
    author: string;
    coAuthors?: string[];
    category: string;
    tags?: string[];
    postType?: PostType;
    coverImage?: CoverImageDto;
    seo?: SeoDto;
    relatedListings?: string[];
    neighborhood?: NeighborhoodDto;
    marketData?: MarketDataDto;
    cta?: CtaDto;
    isFeatured?: boolean;
    isPinned?: boolean;
}
declare const UpdatePostDto_base: import("@nestjs/mapped-types").MappedType<Partial<CreatePostDto>>;
export declare class UpdatePostDto extends UpdatePostDto_base {
}
export declare class SchedulePostDto {
    scheduledAt: string;
}
export declare class ReviewPostDto {
    decision: 'approve' | 'reject';
    note?: string;
}
export declare class QueryPostsDto {
    category?: string;
    tag?: string;
    postType?: PostType;
    city?: string;
    author?: string;
    q?: string;
    status?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export declare class CreateCategoryDto {
    name: string;
    description?: string;
    icon?: string;
    coverImage?: string;
    accentColor?: string;
    metaTitle?: string;
    metaDescription?: string;
    sortOrder?: number;
    isActive?: boolean;
}
export declare class CreateAuthorProfileDto {
    userId?: string;
    displayName: string;
    bio?: string;
    title?: string;
    specialties?: string[];
    social?: {
        twitter?: string;
        linkedin?: string;
        website?: string;
    };
    role?: string;
    isActive?: boolean;
    avatar?: string;
}
export {};
