/**
 * Cloudinary Integration for CertVault
 * Handles PDF certificate uploads to Cloudinary CDN.
 */
import { v2 as cloudinary } from 'cloudinary';

function getCloudinaryConfig() {
  const cloudinaryUrl = process.env.CLOUDINARY_URL?.trim();
  if (cloudinaryUrl) {
    try {
      const parsed = new URL(cloudinaryUrl);
      return {
        cloud_name: parsed.hostname,
        api_key: decodeURIComponent(parsed.username),
        api_secret: decodeURIComponent(parsed.password),
      };
    } catch (error) {
      console.error('[Cloudinary] Invalid CLOUDINARY_URL:', error.message);
    }
  }

  return {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  };
}

const config = getCloudinaryConfig();

cloudinary.config({
  ...config,
  secure: true,
});

export async function uploadCertificate(filePath, organizationSlug, eventSlug, certificateId) {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: 'raw',
      folder: `certvault/${organizationSlug}/${eventSlug}`,
      public_id: certificateId,
      overwrite: false,
      invalidate: true
    });
    return { secure_url: result.secure_url, public_id: result.public_id };
  } catch (error) {
    console.error('[Cloudinary] Upload error:', error);
    throw new Error(`Failed to upload certificate: ${error.message}`);
  }
}

export async function uploadTemplateImage(dataUrl, organizationSlug, eventSlug) {
  try {
    const result = await cloudinary.uploader.upload(dataUrl, {
      resource_type: 'image',
      folder: `certvault/${organizationSlug}/${eventSlug}/templates`,
      public_id: `template_${Date.now()}`,
      overwrite: true,
      invalidate: true,
    });
    return { secure_url: result.secure_url, public_id: result.public_id };
  } catch (error) {
    console.error('[Cloudinary] Template upload error:', error);
    throw new Error(`Failed to upload template image: ${error.message}`);
  }
}

export async function deleteCertificate(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: 'raw',
      invalidate: true
    });
  } catch (error) {
    console.error('[Cloudinary] Delete error:', error);
    throw new Error(`Failed to delete certificate: ${error.message}`);
  }
}

export function getCertificateUrl(publicId) {
  return cloudinary.url(publicId, { resource_type: 'raw', secure: true });
}

export function isCloudinaryConfigured() {
  return !!(
    config.cloud_name &&
    config.api_key &&
    config.api_secret
  );
}

export default cloudinary;
