// What sealed work offers (17.11–17.17): each offer is its own act on the
// unit, asked of the machine; what it types is the machine's to say.
import { fill, w } from './words';

export type Offer = 'follow_up' | 'undo';

/** The read of a follow-up's words for rejected work: what its Eval found. */
export function remedyRead(project: string, unit: string): Record<string, unknown> {
  return { type: 'read', what: 'remedy', project, unit };
}

/** A commit Undo can put the work back to, as the machine lists it. */
export interface Commit {
  id: string;
  short: string;
  subject: string;
  when: string;
  /** Where the work started: picked already. */
  start: boolean;
}

/** The read of the commits Undo offers for rejected work, newest first. */
export function commitsRead(project: string, unit: string): Record<string, unknown> {
  return { type: 'read', what: 'commits', project, unit };
}

/** Undo's yes: the work back to the commit picked. */
export function undoMessage(project: string, unit: string, commit: string): Record<string, unknown> {
  return { act: 'undo', project, unit, commit };
}

/** How many commits the list holds. */
export function commitCount(n: number): string {
  return n === 1 ? w('dialog.undo.count_one') : fill('dialog.undo.count', { n: String(n) });
}
