// What a Seal's dialog offers and sends: the disposition, accepted unless
// another is picked, and for the others an optional reason from a fixed list,
// as weft-core's `tree::reasons` holds it.

import type { SealAnswer } from './answering';

export const DISPOSITIONS = ['accepted', 'deferred', 'rejected', 'abandoned'] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

const REASONS: Record<Disposition, string[]> = {
  accepted: [],
  rejected: ['wrong_approach', 'broke_something', 'not_what_i_asked'],
  deferred: ['finish_later', 'waiting_on_something'],
  abandoned: ['not_needed', 'superseded'],
};

export const reasonsFor = (d: Disposition): string[] => REASONS[d];

/** What Seal sends: the work or the Eval it seals, the disposition, the reason picked, and the answers to its Eval's questions when it asked any. */
export function sealMessage(on: { project: string; unit?: string; eval?: string }, disposition: Disposition, reason: string | null, answers: SealAnswer[] | null = null): Record<string, unknown> {
  const draft = { ...(reason ? { reason } : {}), ...(answers ? { answers } : {}) };
  return { act: 'seal', ...on, text: disposition, ...(Object.keys(draft).length ? { draft } : {}) };
}

/** The read of the questions an Eval left for its Seal: `unit` the Eval, or an Ask of the work it seals. */
export function questionsRead(project: string, unit: string): Record<string, unknown> {
  return { type: 'read', what: 'questions', project, unit };
}
