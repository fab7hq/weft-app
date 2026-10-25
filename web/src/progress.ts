// A running Eval as a picture (17.6): how much is checked, and each stage in
// plain words, as the machine says them.

export type Light = 'done' | 'now' | 'next' | 'running';

export interface Lit {
  name: string;
  note: string;
  light: Light;
}

export interface Progress {
  percent: number;
  stages: Lit[];
}

/** The ring's radius, in the 132 px box it is drawn in. */
export const RADIUS = 56;

/** The arc a percent fills, as an SVG stroke-dasharray. */
export function ring(percent: number): string {
  const around = Math.round(2 * Math.PI * RADIUS);
  return `${Math.round((Math.min(percent, 100) / 100) * around)} ${around}`;
}
