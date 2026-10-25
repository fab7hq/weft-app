// Done: every sealed unit of a project, as weft-core's `done` lists it, parked
// first. The machine narrows it by the search; this only reads it and says a row.

/** One sealed unit, in the words a person reads. */
export interface Done {
  unit: string;
  title: string;
  harness: string;
  verdict: string | null;
  decision: string;
  reason: string | null;
  at: string;
  parked: boolean;
}

/** The read of a project's Done list: narrowed by `q`, from `after` on. */
export function doneRead(project: string, q: string, after: string | null): Record<string, unknown> {
  const said = q.trim();
  return { type: 'read', what: 'done', project, ...(said ? { q: said } : {}), ...(after ? { after } : {}) };
}

/** A row's second line: what was decided, why, and the verdict it was sealed on. */
export function doneLine(d: Done): string {
  return [d.decision, d.reason, d.verdict].filter((p): p is string => !!p).join(' · ');
}
