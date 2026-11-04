import type { PhoenixVectorContour, PhoenixVectorPoint } from './media-composition';

export type PhoenixPoseGuidePreset = 'front' | 'action' | 'run';

export interface PhoenixPoseGuideDefinition {
  label: string;
  contours: PhoenixVectorContour[];
}

function line(id: string, points: PhoenixVectorPoint[]): PhoenixVectorContour {
  return { id, points, closed: false };
}

function circle(id: string, cx: number, cy: number, radius: number, segments = 14): PhoenixVectorContour {
  return {
    id,
    closed: true,
    points: Array.from({ length: segments }, (_, index) => {
      const angle = (Math.PI * 2 * index) / segments;
      return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
    }),
  };
}

export function createPoseGuide(
  preset: PhoenixPoseGuidePreset,
  width: number,
  height: number,
): PhoenixPoseGuideDefinition {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const x = (value: number) => w * value;
  const y = (value: number) => h * value;

  if (preset === 'action') {
    return {
      label: 'Action Pose',
      contours: [
        circle('head', x(0.53), y(0.17), Math.min(w, h) * 0.055),
        line('spine', [{ x: x(0.52), y: y(0.23) }, { x: x(0.47), y: y(0.47) }, { x: x(0.53), y: y(0.66) }]),
        line('shoulders', [{ x: x(0.37), y: y(0.31) }, { x: x(0.52), y: y(0.28) }, { x: x(0.67), y: y(0.34) }]),
        line('left-arm', [{ x: x(0.37), y: y(0.31) }, { x: x(0.27), y: y(0.44) }, { x: x(0.18), y: y(0.38) }]),
        line('right-arm', [{ x: x(0.67), y: y(0.34) }, { x: x(0.77), y: y(0.25) }, { x: x(0.84), y: y(0.18) }]),
        line('hips', [{ x: x(0.43), y: y(0.58) }, { x: x(0.53), y: y(0.61) }, { x: x(0.63), y: y(0.57) }]),
        line('left-leg', [{ x: x(0.46), y: y(0.6) }, { x: x(0.35), y: y(0.76) }, { x: x(0.27), y: y(0.91) }]),
        line('right-leg', [{ x: x(0.6), y: y(0.59) }, { x: x(0.7), y: y(0.72) }, { x: x(0.8), y: y(0.83) }]),
      ],
    };
  }

  if (preset === 'run') {
    return {
      label: 'Running Pose',
      contours: [
        circle('head', x(0.56), y(0.16), Math.min(w, h) * 0.05),
        line('spine', [{ x: x(0.55), y: y(0.22) }, { x: x(0.48), y: y(0.43) }, { x: x(0.52), y: y(0.6) }]),
        line('shoulders', [{ x: x(0.42), y: y(0.29) }, { x: x(0.55), y: y(0.26) }, { x: x(0.67), y: y(0.31) }]),
        line('front-arm', [{ x: x(0.66), y: y(0.31) }, { x: x(0.76), y: y(0.42) }, { x: x(0.83), y: y(0.33) }]),
        line('back-arm', [{ x: x(0.43), y: y(0.3) }, { x: x(0.34), y: y(0.2) }, { x: x(0.25), y: y(0.28) }]),
        line('hips', [{ x: x(0.43), y: y(0.58) }, { x: x(0.52), y: y(0.6) }, { x: x(0.61), y: y(0.57) }]),
        line('front-leg', [{ x: x(0.56), y: y(0.59) }, { x: x(0.68), y: y(0.72) }, { x: x(0.82), y: y(0.7) }]),
        line('back-leg', [{ x: x(0.48), y: y(0.59) }, { x: x(0.39), y: y(0.74) }, { x: x(0.26), y: y(0.89) }]),
      ],
    };
  }

  return {
    label: 'Front Pose',
    contours: [
      circle('head', x(0.5), y(0.15), Math.min(w, h) * 0.055),
      line('spine', [{ x: x(0.5), y: y(0.22) }, { x: x(0.5), y: y(0.48) }, { x: x(0.5), y: y(0.64) }]),
      line('shoulders', [{ x: x(0.37), y: y(0.3) }, { x: x(0.5), y: y(0.28) }, { x: x(0.63), y: y(0.3) }]),
      line('left-arm', [{ x: x(0.37), y: y(0.3) }, { x: x(0.3), y: y(0.48) }, { x: x(0.25), y: y(0.65) }]),
      line('right-arm', [{ x: x(0.63), y: y(0.3) }, { x: x(0.7), y: y(0.48) }, { x: x(0.75), y: y(0.65) }]),
      line('hips', [{ x: x(0.42), y: y(0.58) }, { x: x(0.5), y: y(0.6) }, { x: x(0.58), y: y(0.58) }]),
      line('left-leg', [{ x: x(0.45), y: y(0.6) }, { x: x(0.42), y: y(0.78) }, { x: x(0.4), y: y(0.94) }]),
      line('right-leg', [{ x: x(0.55), y: y(0.6) }, { x: x(0.58), y: y(0.78) }, { x: x(0.6), y: y(0.94) }]),
    ],
  };
}
