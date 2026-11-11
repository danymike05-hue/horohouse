export declare class CreateAuthorProfileDto {
    userId: string;
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
