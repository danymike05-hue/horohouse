export declare function uploadToCloudinary(buffer: Buffer, publicId: string, folder?: string): Promise<any>;
export declare function uploadBufferToCloudinary(buffer: Buffer, { publicId, folder, resourceType, overwrite, transformation, }: {
    publicId?: string;
    folder?: string;
    resourceType?: 'image' | 'video' | 'raw' | 'auto';
    overwrite?: boolean;
    transformation?: any;
}): Promise<any>;
export declare function deleteFromCloudinary(publicId: string, resourceType?: 'image' | 'video' | 'raw' | 'auto'): Promise<any>;
