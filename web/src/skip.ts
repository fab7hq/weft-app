// Files an Eval should skip, as the machine's read check found them: what
// each finding is, the one line that keeps it out and the button that takes
// it, and what an opened Eval counted and did not read.
import { fill, w } from './words';

/** A line for `.gitignore` or `.gitattributes`, at the project's root. */
export interface Fix {
  file: string;
  line: string;
}

/** Something the readers would read that Git could be told to skip. */
export interface Finding {
  kind: 'untracked_bulk' | 'data_bulk' | 'committed_media' | 'committed_build' | 'large_text' | 'sub_repo';
  /** The folder (with a trailing `/`) or file, from the project's root. */
  path: string;
  /** How many files it holds; for a nested repository, how many have changes. */
  files: number;
  bytes: number;
  /** For a nested repository, its commits since the work began. */
  commits: number;
  /** Its files by extension, the most first. */
  kinds_of_files: [string, number][];
  /** Null when no line keeps it out. */
  fix: Fix | null;
  /** In an Eval dialog: its line was taken while the dialog was open. */
  added?: boolean;
}

/** What an Eval counted and did not read, of one kind, in one folder. */
export interface NotRead {
  kind: 'generated' | 'vendored' | 'binary' | 'lock';
  /** The deepest folder that holds them, the file when one, empty for several at the top. */
  folder: string;
  files: number;
}

const num = (n: number) => n.toLocaleString('en-US');

/** A size in megabytes of a million bytes, rounded, at least 1: `48 MB`. */
export const megabytes = (bytes: number) => fill('size.mb', { n: num(Math.max(1, Math.round(bytes / 1_000_000))) });

/** What a finding holds, after its path: `329 files Git does not track`, `13,708 data files (json)`. */
export function findingWhat(f: Finding): string {
  const n = num(f.files);
  switch (f.kind) {
    case 'untracked_bulk':
      return fill('skip.untracked', { n });
    case 'data_bulk':
      if (f.kinds_of_files.length === 0) return f.files === 1 ? w('reads.one_file') : fill('reads.files', { n });
      return fill('skip.data_files', { n, kinds: f.kinds_of_files.slice(0, 3).map(([ext]) => ext).join(', ') });
    case 'committed_build':
      return fill('skip.built', { n });
    case 'committed_media':
      return fill('skip.media', { n });
    case 'large_text':
      return fill('skip.large_text', { size: megabytes(f.bytes) });
    case 'sub_repo':
      if (f.files === 0 && f.commits > 0) return f.commits === 1 ? w('skip.sub_repo_commit') : fill('skip.sub_repo_commits', { n: num(f.commits) });
      return f.files === 1 ? w('skip.sub_repo_one') : fill('skip.sub_repo', { n });
  }
}

/** The button that takes a finding's line, by the file it goes in. */
export const fixLabel = (fix: Fix) => w(fix.file === '.gitignore' ? 'skip.add_ignore' : 'skip.mark_generated');

/** What a finding whose line was taken says, in teal. */
export const addedLabel = (fix: Fix | null) => w(fix?.file === '.gitignore' ? 'skip.added_ignore' : 'skip.added_generated');

/** How many files a taken line keeps from the readers. */
export const noLongerRead = (f: Finding) => (f.files === 1 ? w('skip.no_longer_read_one') : fill('skip.no_longer_read', { n: num(f.files) }));

/** What a project's settings list: never a nested repository. */
export const inSettings = (findings: Finding[]) => findings.filter((f) => f.kind !== 'sub_repo');

/** `1 of 2 left`: the findings with a line not yet taken, out of all with one; null when none has one. */
export function left(findings: Finding[]): string | null {
  const fixable = findings.filter((f) => f.fix);
  if (fixable.length === 0) return null;
  return fill('skip.left', { left: num(fixable.filter((f) => !f.added).length), n: num(fixable.length) });
}

/** Whether some finding still has a line to take. */
export const anyLeft = (findings: Finding[]) => findings.some((f) => f.fix && !f.added);

/** A line's words, so it wraps only between them: `research/papers/*\/evidence/**`, `linguist-generated=true`. */
export const lineWords = (line: string) => line.split(' ');

/** One kind's row of what an Eval did not read: `13,708 generated`, where they are, and how many other folders. */
export interface NotReadRow {
  kind: NotRead['kind'];
  count: string;
  /** The files named, each set apart: three at most, else the largest folder. */
  where: string[];
  /** `and 3 other folders`, or null. */
  more: string | null;
}

/** What an Eval did not read, a row per kind in the order the machine gives them, and `14,058 files counted`. */
export function notRead(rows: NotRead[]): { total: string; rows: NotReadRow[] } | null {
  if (rows.length === 0) return null;
  const kinds: NotRead['kind'][] = [];
  for (const r of rows) if (!kinds.includes(r.kind)) kinds.push(r.kind);
  const total = rows.reduce((sum, r) => sum + r.files, 0);
  return {
    total: total === 1 ? w('not_read.counted_one') : fill('not_read.counted', { n: num(total) }),
    rows: kinds.map((kind) => {
      const groups = rows.filter((r) => r.kind === kind);
      const named = groups.map((g) => g.folder).filter(Boolean);
      const count = fill(`reads.${kind}`, { n: num(groups.reduce((sum, g) => sum + g.files, 0)) });
      // Three single files or fewer are each named; else the largest folder and how many others. Several files at the top are a folder unnamed.
      if (named.length === 0) return { kind, count, where: [], more: null };
      if (groups.length <= 3 && groups.every((g) => g.files === 1)) return { kind, count, where: named, more: null };
      const others = groups.length - 1;
      const more = others === 0 ? null : others === 1 ? w('not_read.other_folder') : fill('not_read.other_folders', { n: num(others) });
      return { kind, count, where: [named[0]], more };
    }),
  };
}
