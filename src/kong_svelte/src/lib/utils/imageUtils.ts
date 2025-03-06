/**
 * Utility functions for image compression and processing
 */
import imageCompression from 'browser-image-compression';

/**
 * Compresses an image file by resizing and reducing quality
 * 
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns Promise resolving to the compressed image as a data URL
 */
export async function compressImage(
  file: File,
  options: {
    maxWidthOrHeight?: number;
    maxSizeMB?: number;
    useWebWorker?: boolean;
    preserveExif?: boolean;
  } = {}
): Promise<string> {
  try {
    // Default options
    const compressionOptions = {
      maxSizeMB: options.maxSizeMB || 1, // Default max size: 1MB
      maxWidthOrHeight: options.maxWidthOrHeight || 800, // Default max dimension: 800px
      useWebWorker: options.useWebWorker !== false, // Default to true
      preserveExif: options.preserveExif || false, // Don't preserve EXIF data by default
    };

    console.log(`Compressing image: ${(file.size / 1024 / 1024).toFixed(2)}MB, type: ${file.type}`);
    
    // Compress the image
    const compressedFile = await imageCompression(file, compressionOptions);
    console.log(`Compressed to: ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
    
    // Convert to data URL
    const dataUrl = await fileToDataUrl(compressedFile);
    return dataUrl;
  } catch (error) {
    console.error('Image compression failed:', error);
    // Fall back to original file if compression fails
    return fileToDataUrl(file);
  }
}

/**
 * Converts a File object to a data URL
 * 
 * @param file - The file to convert
 * @returns Promise resolving to the data URL
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Converts a data URL to a Blob object
 * 
 * @param dataUrl - The data URL to convert
 * @returns The Blob object
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new Blob([u8arr], { type: mime });
}

/**
 * Gets the file size in KB from a data URL
 * 
 * @param dataUrl - The data URL
 * @returns Size in KB
 */
export function getDataUrlSizeKB(dataUrl: string): number {
  const base64Data = dataUrl.split(',')[1];
  const byteCharacters = atob(base64Data);
  return byteCharacters.length / 1024;
} 