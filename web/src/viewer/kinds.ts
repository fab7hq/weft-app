// A file an agent pointed at, as the machine names it on a conversation
// item: its path, its kind (the machine decides it), its size and when it
// last changed. What a chip and the viewer's header say of it.
import { clock } from '../bar';
import { fill } from '../words';

export type Kind = 'markdown' | 'text' | 'image' | 'video' | 'audio' | 'csv' | 'sheet' | 'document' | 'notebook' | 'pdf' | 'html' | 'other';

export const KINDS: readonly Kind[] = ['markdown', 'text', 'image', 'video', 'audio', 'csv', 'sheet', 'document', 'notebook', 'pdf', 'html', 'other'];

/** One file an item names: relative to the project when inside it, else absolute. */
export interface Ref {
  path: string;
  kind: Kind;
  size: number;
  /** When it last changed, in milliseconds since the epoch. */
  modified: number;
}

/** A kind the machine may add later reads as `other`: offered, never drawn. */
export const kindOf = (k: unknown): Kind => (KINDS.includes(k as Kind) ? (k as Kind) : 'other');

/** Each kind's glyph on its chip. */
export const GLYPH: Record<Kind, string> = {
  markdown: '▤',
  text: '≡',
  image: '▣',
  video: '▶',
  audio: '♪',
  csv: '▦',
  sheet: '▦',
  document: '▧',
  notebook: '◧',
  pdf: '▥',
  html: '◫',
  other: '□',
};

/** The file's name: the last part of its path. */
export const nameOf = (path: string): string => path.replace(/\/+$/, '').split('/').pop() || path;

/** The folder it is in, with its slash: `out/`, `/tmp/codex-board/`; empty at the project's root. */
export function folderOf(path: string): string {
  const at = path.replace(/\/+$/, '').lastIndexOf('/');
  return at < 0 ? '' : path.slice(0, at + 1);
}

/** A size as a person reads it: `812 B`, `4.2 KB`, `41 KB`, `1.2 MB`. */
export function sizeWord(bytes: number): string {
  const units: [number, string][] = [[1e9, 'GB'], [1e6, 'MB'], [1e3, 'KB']];
  for (const [at, unit] of units) {
    if (bytes < at) continue;
    const n = bytes / at;
    return `${n < 9.95 ? n.toFixed(1).replace(/\.0$/, '') : Math.round(n)} ${unit}`;
  }
  return `${Math.max(0, Math.round(bytes))} B`;
}

/** How far a file has loaded, both in the unit of its size: `61` of `184 MB`, `1.2` of `8.3 MB`. */
export function loadedWords(done: number, total: number): { done: string; total: string } {
  const all = sizeWord(total);
  const at = ({ GB: 1e9, MB: 1e6, KB: 1e3 } as Record<string, number>)[all.split(' ')[1]] ?? 1;
  const n = Math.min(done, total) / at;
  return { done: at === 1 ? String(Math.round(n)) : n < 9.95 ? n.toFixed(1).replace(/\.0$/, '') : String(Math.round(n)), total: all };
}

/** When it changed, on this device's clock: `09:20`. */
export const changedAt = (ms: number): string => clock(ms - new Date(ms).getTimezoneOffset() * 60_000);

/** The viewer's second line, its parts that are known: `out/ · 4.6 KB · 09:20 · codex` on a
 * phone, `out/ · 4.6 KB · changed 09:20 · codex` on a desktop. */
export function about(ref: Ref, harness: string, desktop = false): string {
  const time = ref.modified > 0 ? changedAt(ref.modified) : '';
  return [folderOf(ref.path), sizeWord(ref.size), time && desktop ? fill('file.changed', { time }) : time, harness].filter(Boolean).join(' · ');
}

/** Refs in the order first named, each once; a file named again keeps its place and takes its newest size. */
export function union(lists: (Ref[] | undefined)[]): Ref[] {
  const out = new Map<string, Ref>();
  for (const list of lists) for (const r of list ?? []) out.set(r.path, r);
  return [...out.values()];
}
