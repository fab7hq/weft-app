// A running Eval as a picture (17.6, 6.7): one ring with an arc per read, each
// in, under way or still to come, and its steps in quiet text, as the machine
// says them.

export type Light = 'done' | 'now' | 'next';

export interface Lit {
  name: string;
  light: Light;
}

export interface Progress {
  /** The reads, up to three. */
  arcs: Light[];
  /** Inside the ring: `2nd read`, and under it `reading`. */
  label: string;
  note: string;
  steps: Lit[];
  /** The checks still running, a line each. */
  tests: string[];
}

/** The ring's circle in its 150 px box: three arcs of 122 with a gap between. */
export const RING = { box: 150, r: 64, dash: '122 280', offsets: [0, -134, -268] } as const;

export interface Arc {
  offset: number;
  stroke: 'accent' | 'line';
  /** Under way: drawn breathing. */
  breathes: boolean;
}

/** One arc per read, up to three. */
export function arcs(lights: Light[]): Arc[] {
  return lights.slice(0, RING.offsets.length).map((l, i) => ({
    offset: RING.offsets[i],
    stroke: l === 'next' ? 'line' : 'accent',
    breathes: l === 'now',
  }));
}

/** A step as it reads: one done is ticked. */
export const stepText = (s: Lit) => (s.light === 'done' ? `✓ ${s.name}` : s.name);

/** A step's colour: done muted, under way the text's, still to come faint. */
export const stepTone = (l: Light) => (l === 'done' ? 'muted' : l === 'now' ? 'text' : 'faint');
