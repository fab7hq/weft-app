// The Eval dialog's Read by: which harness reads the work. It starts on the
// one Settings route Evals to, else the work's latest agent, which the
// machine names in the dialog's sentence; the list holds every harness the
// project can start. A pick stages the dialog again with that harness.

/** Why Read by starts where it does: Settings route Evals there, or the work's latest agent ran it. */
export type ReadNote = 'settings' | 'latest';

/** The words key of a note. */
export const noteKey = (n: ReadNote) => (n === 'settings' ? 'dialog.eval.from_settings' : 'dialog.eval.from_work');

/** The harness a sentence made from `template` names in its `{harness}`, else null. */
export function named(sentence: string, template: string): string | null {
  const parts = template.split('{harness}');
  if (parts.length !== 2) return null;
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = new RegExp(`^${escape(parts[0])}(.+?)${escape(parts[1])}$`).exec(sentence.trim());
  return found ? found[1] : null;
}

/**
 * Who reads unless the person picks another: the harness Settings route Evals
 * to (`routed`), else the one the machine's sentence names, by its title or
 * its name among those the project starts, else `fallback`.
 */
export function readerOf(routed: string | undefined, said: string | null, starts: { harness: string; title: string }[], fallback: string): { harness: string; note: ReadNote } {
  if (routed) return { harness: routed, note: 'settings' };
  const by = said ? starts.find((s) => s.title === said || s.harness === said) : undefined;
  return { harness: by?.harness ?? fallback, note: 'latest' };
}

/** What Read by offers: every harness the project starts, once each, with the one it starts on first when it is not among them. */
export function readers(starts: string[], first: string): string[] {
  const each = [...new Set(starts)];
  return !first || each.includes(first) ? each : [first, ...each];
}

/** A harness as the list shows it: its title among those the project starts, else its name. */
export function readerTitle(harness: string, starts: { harness: string; title: string }[]): string {
  return starts.find((s) => s.harness === harness)?.title || harness;
}

/** The Eval act for a pick: it names the harness only when it is not the one Eval reads by anyway. */
export function evalAct(project: string, unit: string, pick: string, first: string): Record<string, unknown> {
  return { act: 'eval', project, unit, ...(pick && pick !== first ? { start: pick } : {}) };
}
