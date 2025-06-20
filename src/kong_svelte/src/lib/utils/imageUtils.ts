export async function validateAndReadImageFile(
  file: File,
  maxSize: number,
  minDimension: number
): Promise<{ error: string | null; dataUrl?: string }> {
  // Validate file type
  if (!file.type.startsWith('image/')) {
    return { error: 'Please upload an image file' };
  }

  // Validate file size
  if (file.size > maxSize) {
    return { error: `Image size should be less than ${Math.round(maxSize / 1024 / 1024)}MB` };
  }

  // Read as Data URL
  let dataUrl: string;
  try {
    dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (!e.target || typeof e.target.result !== 'string') {
          reject(new Error('Failed to load image preview'));
        } else {
          resolve(e.target.result);
        }
      };
      reader.onerror = () => reject(new Error('Failed to process image'));
      reader.readAsDataURL(file);
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to process image' };
  }

  // Validate dimensions
  try {
    const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => reject(new Error('Failed to process image'));
      img.src = dataUrl;
    });
    if (width < minDimension || height < minDimension) {
      return { error: `Image dimensions should be at least ${minDimension}x${minDimension} pixels` };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to process image' };
  }

  return { error: null, dataUrl };
} 