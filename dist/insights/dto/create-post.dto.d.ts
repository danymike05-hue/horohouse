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
export {};
