interface GradientOptions {
  colorStart: string;
  colorEnd: string;
}

export function getGradient(
  ctx: CanvasRenderingContext2D, 
  chartArea: { bottom: number; top: number }, 
  options: GradientOptions
) {
  const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
  gradient.addColorStop(0, options.colorStart);
  gradient.addColorStop(1, options.colorEnd);
  return gradient;
} 