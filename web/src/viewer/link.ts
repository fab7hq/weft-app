// The machine's answer to opening a file: a private link on its address that
// serves that one file for a few minutes, or why there is none.
import { kindOf, type Ref } from './kinds';

/** A file opened: where it is served, and what the machine says of it now. */
export interface Linked extends Ref {
  url: string;
}

/** A link, or why there is none: `no_file` (gone, or not one the agent pointed at),
 * `lost` (not sent, or the connection closed), or the machine's own words. */
export type Opened = { file: Linked } | { refused: 'no_file' | 'lost' } | { failed: string };

/** What the machine answered, its link made whole on the address the connection reached. */
export function linkOfAnswer(answer: Record<string, unknown> | null | undefined, address: string | null): Opened {
  if (!answer || answer.lost === true) return { refused: 'lost' };
  if (answer.type === 'error') {
    const code = String(answer.code ?? '');
    return code === 'no_file' ? { refused: 'no_file' } : { failed: String(answer.message ?? code) };
  }
  const f = answer.file as Record<string, unknown> | undefined;
  if (answer.type !== 'ok' || !f || typeof f.url !== 'string' || !address) return { failed: 'unknown' };
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    file: { path: String(f.path ?? ''), kind: kindOf(f.kind), size: num(f.size), modified: num(f.modified), url: new URL(f.url, address).href },
  };
}
