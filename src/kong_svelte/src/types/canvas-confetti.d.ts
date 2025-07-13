declare module 'canvas-confetti' {
  interface Options {
    particleCount?: number;
    angle?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    gravity?: number;
    drift?: number;
    ticks?: number;
    origin?: {
      x?: number;
      y?: number;
    };
    colors?: string[];
    shapes?: Shape[];
    scalar?: number;
    zIndex?: number;
    disableForReducedMotion?: boolean;
  }

  interface Shape {
    type?: string;
    text?: string;
  }

  interface ConfettiFunction {
    (options?: Options): Promise<null> | null;
    reset(): void;
    shapeFromPath(path: string): Shape;
    shapeFromText(options: { text: string; scalar?: number }): Shape;
  }

  const confetti: ConfettiFunction;
  export default confetti;
}