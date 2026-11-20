// Files an Eval should skip: each finding as the Eval dialog and a project's
// settings say it, its line's button and what it says once taken, how many
// are left, and what an Eval counted and did not read.
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { addedLabel, anyLeft, findingWhat, fixLabel, inSettings, left, lineWords, megabytes, noLongerRead, notRead, type Finding } from '../src/skip';
import { largeNote, readsRow, withPending, type Reads } from '../src/reads';
import { use } from '../src/words';

const words: Record<string, string> = JSON.parse(readFileSync('web/public/words.json', 'utf8'));

beforeEach(() => use(words));

const finding = (f: Partial<Finding> & Pick<Finding, 'kind' | 'path'>): Finding => ({ files: 0, bytes: 0, commits: 0, kinds_of_files: [], fix: null, ...f });

/** 9.13 and 17.28: what the check found in fab7. */
const OUTPUT = finding({ kind: 'untracked_bulk', path: 'output/', files: 329, kinds_of_files: [['png', 300], ['json', 29]], fix: { file: '.gitignore', line: '/output/' } });
const EVIDENCE = finding({ kind: 'data_bulk', path: 'research/papers/to-err-is-agentic/evidence/', files: 13708, kinds_of_files: [['json', 13708]], fix: { file: '.gitattributes', line: 'research/papers/*/evidence/** linguist-generated=true' } });
const MEDIA = finding({ kind: 'committed_media', path: 'marketing/weft/assets/final/', files: 24, kinds_of_files: [['png', 20], ['mp4', 4]], fix: { file: '.gitattributes', line: 'marketing/weft/assets/final/** linguist-generated=true' } });
const DIST = finding({ kind: 'committed_build', path: 'web/dist/', files: 41, fix: { file: '.gitattributes', line: 'web/dist/** linguist-generated=true' } });
const DUMP = finding({ kind: 'large_text', path: 'data/dump.sql', files: 1, bytes: 48_200_000, fix: { file: '.gitattributes', line: 'data/dump.sql linguist-generated=true' } });
const HOMEPAGE = finding({ kind: 'sub_repo', path: 'homepage/', files: 12 });

describe('a finding', () => {
  it('says what it holds, after its path, by its kind', () => {
    expect(findingWhat(OUTPUT)).toBe('329 files Git does not track');
    expect(findingWhat(EVIDENCE)).toBe('13,708 data files (json)');
    expect(findingWhat({ ...EVIDENCE, kinds_of_files: [['json', 9], ['csv', 3], ['jsonl', 2], ['tsv', 1]] })).toBe('13,708 data files (json, csv, jsonl)');
    expect(findingWhat(MEDIA)).toBe('24 images and videos');
    expect(findingWhat(DIST)).toBe('41 files a build wrote');
    expect(findingWhat(DUMP)).toBe('48 MB of text');
  });

  it('is a nested repository by its changed files, else its commits', () => {
    expect(findingWhat(HOMEPAGE)).toBe('is its own repository: 12 changed files there are not part of this Eval');
    expect(findingWhat({ ...HOMEPAGE, files: 1 })).toBe('is its own repository: 1 changed file there is not part of this Eval');
    expect(findingWhat({ ...HOMEPAGE, files: 0, commits: 3 })).toBe('is its own repository: 3 commits there are not part of this Eval');
    expect(findingWhat({ ...HOMEPAGE, files: 0, commits: 1 })).toBe('is its own repository: 1 commit there is not part of this Eval');
  });

  it('is taken with a button named for the file its line goes in, and says so in teal once taken', () => {
    expect(fixLabel(OUTPUT.fix!)).toBe('Add to .gitignore');
    expect(fixLabel(EVIDENCE.fix!)).toBe('Mark as generated');
    expect(addedLabel(OUTPUT.fix)).toBe('Added to .gitignore');
    expect(addedLabel(EVIDENCE.fix)).toBe('Marked as generated');
    expect(noLongerRead(OUTPUT)).toBe('329 files are no longer read');
    expect(noLongerRead(DUMP)).toBe('1 file is no longer read');
  });

  it('has its line wrapped only between its words', () => {
    expect(lineWords(EVIDENCE.fix!.line)).toEqual(['research/papers/*/evidence/**', 'linguist-generated=true']);
    expect(lineWords('/output/')).toEqual(['/output/']);
  });

  it('says a size in megabytes of a million bytes, rounded, at least 1', () => {
    expect(megabytes(48_200_000)).toBe('48 MB');
    expect(megabytes(2_540_000)).toBe('3 MB');
    expect(megabytes(1_499_999)).toBe('1 MB');
    expect(megabytes(300_000)).toBe('1 MB');
    expect(megabytes(1_234_000_000)).toBe('1,234 MB');
  });

  it('is data with no kind of file said as its files alone', () => {
    expect(findingWhat({ ...EVIDENCE, kinds_of_files: [] })).toBe('13,708 files');
  });
});

describe('the Eval dialog\'s findings', () => {
  it('count the lines left to take out of all there are, never a nested repository', () => {
    expect(left([OUTPUT, EVIDENCE, HOMEPAGE])).toBe('2 of 2 left');
    expect(left([{ ...OUTPUT, added: true }, EVIDENCE, HOMEPAGE])).toBe('1 of 2 left');
    expect(left([{ ...OUTPUT, added: true }, { ...EVIDENCE, added: true }])).toBe('0 of 2 left');
    expect(left([HOMEPAGE])).toBeNull();
    expect(left([])).toBeNull();
  });

  it('say whether any line is still to take', () => {
    expect(anyLeft([{ ...OUTPUT, added: true }, EVIDENCE])).toBe(true);
    expect(anyLeft([{ ...OUTPUT, added: true }, HOMEPAGE])).toBe(false);
  });
});

describe('a project\'s settings', () => {
  it('list every finding but a nested repository', () => {
    expect(inSettings([OUTPUT, HOMEPAGE, EVIDENCE, MEDIA, DUMP])).toEqual([OUTPUT, EVIDENCE, MEDIA, DUMP]);
    expect(inSettings([HOMEPAGE])).toEqual([]);
  });
});

/** 17.28: weft 0.7 updates once output/ was ignored: its count moved from 14,181 to 13,852. */
const TAKEN: Reads = {
  since: 'ask', when: '2026-11-08T10:00:00Z', commits: 52, files: 13852, files_before: 14181, skipped: { binary: 19, lock: 2 },
  folder: 'research/papers/to-err-is-agentic/evidence/', folder_files: 13708, large: true,
  findings: [{ ...OUTPUT, added: true }, EVIDENCE, HOMEPAGE],
};

describe('the Reads row once a line is taken', () => {
  it('strikes out what the count was before it', () => {
    expect(readsRow(TAKEN, Date.parse('2026-11-19T15:00:00Z'), 0)).toMatchObject({
      commits: '52 commits', files: '13,852 files', before: '14,181', skipped: '21 counted, not read: 19 binary, 2 lock',
    });
    expect(readsRow({ ...TAKEN, files_before: undefined }).before).toBeNull();
    expect(readsRow({ ...TAKEN, files_before: 13852 }).before).toBeNull();
  });

  it('leaves a large change to its findings while a line is left, and says it once none is', () => {
    expect(largeNote(TAKEN)).toBeNull();
    expect(largeNote({ ...TAKEN, findings: [{ ...OUTPUT, added: true }, { ...EVIDENCE, added: true }, HOMEPAGE] })).not.toBeNull();
    expect(largeNote({ ...TAKEN, findings: undefined })).not.toBeNull();
  });
});

describe('a pending said again', () => {
  it('takes the place of the one held under its id, and leaves the others', () => {
    const send = { id: 'pnd_s', agent: 'a', what: 'Ask claude?' };
    const first = { id: 'pnd_e', agent: '', what: 'Eval this work?', reads: { files: 14181 } };
    const again = { id: 'pnd_e', agent: '', what: 'Eval this work?', reads: { files: 13852, files_before: 14181 } };
    const held = withPending(withPending([], send), first);
    expect(held).toEqual([send, first]);
    const now = withPending(held, again);
    expect(now).toHaveLength(2);
    expect(now.find((p) => p.id === 'pnd_e')).toBe(again);
    expect(now.find((p) => p.id === 'pnd_s')).toBe(send);
  });
});

describe('what an Eval did not read', () => {
  /** 11.16, less what was ignored. */
  const ROWS = [
    { kind: 'generated' as const, folder: 'research/papers/to-err-is-agentic/evidence/', files: 13708 },
    { kind: 'binary' as const, folder: 'marketing/weft/assets/final/', files: 12 },
    { kind: 'binary' as const, folder: 'weft-app/web/public/', files: 4 },
    { kind: 'binary' as const, folder: 'site/', files: 2 },
    { kind: 'binary' as const, folder: 'logo.png', files: 1 },
    { kind: 'lock' as const, folder: 'weft/Cargo.lock', files: 1 },
    { kind: 'lock' as const, folder: 'weft-app/package-lock.json', files: 1 },
  ];

  it('is a row per kind, counted, with its folder; up to three single files named apart, else the largest folder and how many others', () => {
    expect(notRead(ROWS)).toEqual({
      total: '13,729 files counted',
      rows: [
        { kind: 'generated', count: '13,708 generated', where: ['research/papers/to-err-is-agentic/evidence/'], more: null },
        { kind: 'binary', count: '19 binary', where: ['marketing/weft/assets/final/'], more: 'and 3 other folders' },
        { kind: 'lock', count: '2 lock', where: ['weft/Cargo.lock', 'weft-app/package-lock.json'], more: null },
      ],
    });
  });

  it('names three single files, and a fourth as one of the others', () => {
    const locks = ['a/Cargo.lock', 'b/package-lock.json', 'c/uv.lock', 'd/yarn.lock'].map((folder) => ({ kind: 'lock' as const, folder, files: 1 }));
    expect(notRead(locks.slice(0, 3))?.rows[0].where).toEqual(['a/Cargo.lock', 'b/package-lock.json', 'c/uv.lock']);
    expect(notRead(locks)?.rows[0]).toMatchObject({ where: ['a/Cargo.lock'], more: 'and 3 other folders' });
    expect(notRead([{ kind: 'binary', folder: 'art/', files: 5 }, { kind: 'binary', folder: 'logo.png', files: 1 }])?.rows[0]).toMatchObject({ where: ['art/'], more: 'and 1 other folder' });
  });

  it('says several files at the top as no folder, and one other folder as one', () => {
    expect(notRead([{ kind: 'vendored', folder: '', files: 3 }])?.rows).toEqual([{ kind: 'vendored', count: '3 vendored', where: [], more: null }]);
    expect(notRead([{ kind: 'binary', folder: 'art/', files: 5 }, { kind: 'binary', folder: '', files: 2 }])?.rows[0]).toEqual({ kind: 'binary', count: '7 binary', where: ['art/'], more: 'and 1 other folder' });
  });

  it('counts one file as one, and is nothing when nothing was left unread', () => {
    expect(notRead([{ kind: 'lock', folder: 'Cargo.lock', files: 1 }])?.total).toBe('1 file counted');
    expect(notRead([])).toBeNull();
  });
});
