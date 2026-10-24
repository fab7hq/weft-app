// What a Seal's dialog offers and sends: the disposition, accepted unless
// another is picked, and for the others an optional reason from a fixed list,
// as weft-core's `tree::reasons` holds it.

export const DISPOSITIONS = ['accepted', 'deferred', 'rejected', 'abandoned'] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

const REASONS: Record<Disposition, string[]> = {
  accepted: [],
  rejected: ['wrong_approach', 'broke_something', 'not_what_i_asked'],
  deferred: ['finish_later', 'waiting_on_something'],
  abandoned: ['not_needed', 'superseded'],
};

export const reasonsFor = (d: Disposition): string[] => REASONS[d];

/** What Seal sends: the work or the Eval it seals, the disposition, and the reason picked. */
export function sealMessage(on: { project: string; unit?: string; eval?: string }, disposition: Disposition, reason: string | null): Record<string, unknown> {
  return { act: 'seal', ...on, text: disposition, ...(reason ? { draft: { reason } } : {}) };
}
