"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadToCloudinary = uploadToCloudinary;
exports.uploadBufferToCloudinary = uploadBufferToCloudinary;
exports.deleteFromCloudinary = deleteFromCloudinary;
const cloudinary_1 = require("cloudinary");
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
function uploadToCloudinary(buffer, publicId, folder = 'profile_pictures') {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary_1.v2.uploader.upload_stream({
            folder,
            public_id: publicId,
            overwrite: true,
            resource_type: 'image',
        }, (error, result) => {
            if (error)
                return reject(error);
            resolve(result);
        });
        uploadStream.end(buffer);
    });
}
function uploadBufferToCloudinary(buffer, { publicId, folder = 'horohouse/properties', resourceType = 'auto', overwrite = true, transformation, }) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary_1.v2.uploader.upload_stream({
            folder,
            public_id: publicId,
            overwrite,
            resource_type: resourceType,
            transformation,
        }, (error, result) => {
            if (error)
                return reject(error);
            resolve(result);
        });
        uploadStream.end(buffer);
    });
}
function deleteFromCloudinary(publicId, resourceType = 'image') {
    return cloudinary_1.v2.uploader.destroy(publicId, { resource_type: resourceType });
}
//# sourceMappingURL=cloudinary.js.map