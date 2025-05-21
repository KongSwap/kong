/**
 * Converts RGB to HSL
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }

    h /= 6;
  }

  return [h * 360, s * 100, l * 100];
}

/**
 * Converts HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Calculates the relative luminance of a color
 * Based on WCAG 2.0 guidelines
 */
function calculateLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculates the contrast ratio between two colors
 * Based on WCAG 2.0 guidelines
 */
function calculateContrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Generates a vibrant contrasting color
 */
function generateContrastingColor(r: number, g: number, b: number): [number, number, number] {
  // Convert to HSL
  const [h, s, l] = rgbToHsl(r, g, b);
  
  // Calculate the original color's luminance
  const originalLuminance = calculateLuminance(r, g, b);
  
  // Define vibrant color combinations
  const vibrantColors: [number, number, number][] = [
    // Vibrant complementary
    [h + 180, 85, 45],
    // Vibrant split complementary
    [h + 150, 80, 40],
    [h + 210, 80, 40],
    // Vibrant triadic
    [h + 120, 75, 35],
    [h + 240, 75, 35],
    // Vibrant analogous
    [h + 60, 90, 50],
    [h - 60, 90, 50],
    // High contrast vibrant
    [h + 180, 95, 30],
    [h + 180, 95, 70],
  ].map(([hue, sat, light]): [number, number, number] => {
    // Normalize hue to 0-360 range
    const normalizedHue = ((hue % 360) + 360) % 360;
    return hslToRgb(normalizedHue, sat, light);
  });

  // Add some predefined vibrant colors as fallbacks
  const fallbackColors: [number, number, number][] = [
    [255, 87, 51],    // Vibrant Orange
    [29, 233, 182],   // Vibrant Teal
    [255, 45, 85],    // Vibrant Pink
    [88, 86, 214],    // Vibrant Purple
    [255, 204, 0],    // Vibrant Yellow
    [52, 199, 89],    // Vibrant Green
    [0, 122, 255],    // Vibrant Blue
  ];

  // Combine all potential colors
  const allColors = [...vibrantColors, ...fallbackColors];

  // Find the color with the best contrast ratio
  let bestColor = allColors[0];
  let bestContrast = 0;

  for (const color of allColors) {
    const luminance = calculateLuminance(...color);
    const contrast = calculateContrastRatio(originalLuminance, luminance);
    
    if (contrast > bestContrast) {
      bestContrast = contrast;
      bestColor = color;
    }
  }

  // If the best contrast is still too low, use a vibrant fallback
  if (bestContrast < 2) {
    // Choose a vibrant color that's different from the original
    const originalHue = h;
    const fallbackIndex = Math.floor(Math.abs(Math.sin(originalHue)) * fallbackColors.length);
    return fallbackColors[fallbackIndex];
  }

  return bestColor;
}

/**
 * Extracts the dominant color from an image and returns a contrasting color as a CSS color string
 * @param imageUrl The URL of the image to extract color from
 * @returns A Promise that resolves to a CSS color string
 */
export async function getDominantColor(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    
    img.onload = () => {
      try {
        // Create a canvas to analyze the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('rgb(88, 86, 214)'); // Fallback to vibrant purple
          return;
        }

        // Set canvas size to a smaller size for performance
        const maxSize = 50;
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        // Draw image on canvas
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        
        // Calculate average color
        let r = 0, g = 0, b = 0, count = 0;
        
        for (let i = 0; i < imageData.length; i += 4) {
          // Skip transparent pixels
          if (imageData[i + 3] < 128) continue;
          
          r += imageData[i];
          g += imageData[i + 1];
          b += imageData[i + 2];
          count++;
        }

        if (count === 0) {
          resolve('rgb(88, 86, 214)'); // Fallback to vibrant purple
          return;
        }

        // Calculate average
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        // Generate contrasting color
        const [compR, compG, compB] = generateContrastingColor(r, g, b);
        resolve(`rgb(${compR}, ${compG}, ${compB})`);
      } catch (error) {
        console.error('Error extracting color:', error);
        resolve('rgb(88, 86, 214)'); // Fallback to vibrant purple
      }
    };

    img.onerror = () => {
      console.error('Error loading image for color extraction');
      resolve('rgb(88, 86, 214)'); // Fallback to vibrant purple
    };

    img.src = imageUrl;
  });
} 