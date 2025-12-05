// cloudinary.js (CommonJS)
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadOnCloudinary(localFilepath) {
  if (!localFilepath) throw new Error('File path is required for upload');

  // Verify Cloudinary config
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary credentials not configured in .env');
  }

  console.log('Uploading file to Cloudinary:', localFilepath);

  try {
    // Determine resource type based on file extension
    const fileExtension = localFilepath.split('.').pop().toLowerCase();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'];
    const videoExtensions = ['mp4', 'mov', 'avi', 'wmv', 'flv', 'mkv', 'webm'];
    
    let resourceType = 'raw'; // Default for documents, PDFs, etc.
    
    if (imageExtensions.includes(fileExtension)) {
      resourceType = 'image';
    } else if (videoExtensions.includes(fileExtension)) {
      resourceType = 'video';
    }

    const result = await cloudinary.uploader.upload(localFilepath, {
      resource_type: resourceType,
      folder: 'edusphere_uploads',
      // For non-image files, preserve original filename
      use_filename: true,
      unique_filename: true,
    });

    // For PDFs and documents (raw type), create a proper viewing URL
    let finalUrl = result.secure_url || result.url;
    
    // If it's a PDF or raw resource, add flags to allow inline viewing
    if (fileExtension === 'pdf' || resourceType === 'raw') {
      // Add flags parameter to URL for inline viewing instead of download
      finalUrl = finalUrl.replace('/upload/', '/upload/fl_attachment:inline/');
    }

    console.log('Cloudinary upload successful:', {
      url: finalUrl,
      publicId: result.public_id,
      format: result.format,
      resourceType: result.resource_type,
      originalUrl: result.secure_url
    });

    // remove temp file after successful upload (if exists)
    try {
      if (fs.existsSync(localFilepath)) {
        fs.unlinkSync(localFilepath);
      }
    } catch (e) {
      console.warn('Failed to remove temp file:', e.message);
    }

    return finalUrl;
  } catch (error) {
    console.error('Cloudinary upload failed:', error.message);
    
    // try to remove file on error too (safe check)
    try {
      if (fs.existsSync(localFilepath)) {
        fs.unlinkSync(localFilepath);
      }
    } catch (e) {
      console.warn('Failed to remove temp file on error:', e.message);
    }

    // rethrow so caller can handle it
    throw error;
  }
}

module.exports = { uploadOnCloudinary };
