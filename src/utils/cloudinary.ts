import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary from env variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export function uploadToCloudinary(buffer: Buffer, publicId: string, folder = 'profile_pictures'): Promise<any> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        overwrite: true,
        resource_type: 'image',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    uploadStream.end(buffer);
  });
}

// Generic upload helper that supports image/video/auto
export function uploadBufferToCloudinary(
  buffer: Buffer,
  {
    publicId,
    folder = 'horohouse/properties',
    resourceType = 'auto',
    overwrite = true,
    transformation,
    
  }: {
    publicId?: string;
    folder?: string;
    resourceType?: 'image' | 'video' | 'raw' | 'auto';
    overwrite?: boolean;
    transformation?: any;
  },
): Promise<any> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        overwrite,
        resource_type: resourceType,
        transformation,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    uploadStream.end(buffer);
  });
}

export function deleteFromCloudinary(publicId: string, resourceType: 'image' | 'video' | 'raw' | 'auto' = 'image'): Promise<any> {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}
