// What the machine is doing, as it says it: each job held as it last stood,
// matched to what this device shows by its request or by what it is about,
// its times on this device's clock, its steps and counts in words.
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import * as J from '../src/jobs';
import { use } from '../src/words';

const words: Record<string, string> = JSON.parse(readFileSync('web/public/words.json', 'utf8'));

beforeEach(() => {
  use(words);
  J.jobs.value = {};
});

/** A Seal as the machine sends it, 9 s in, reading every file as it is now. */
const SEAL: J.Job = {
  id: 'job_7',
  kind: 'seal',
  on: { work: 'ask_3', seal: 'seal_5' },
  steps: [
    { key: 'step.checking_work', state: 'done', ms: 2_000 },
    { key: 'step.reading_files_now', state: 'now', ms: 7_000, done: 8412, total: 15902, unit: 'files' },
    { key: 'step.writing_decision', state: 'next' },
    { key: 'step.noting_git', state: 'next' },
  ],
  share: 0.4,
  age_ms: 9_000,
};

const progress = (job: Partial<J.Job>, more: Record<string, unknown> = {}) => ({ type: 'progress', project: 'weft', job: { ...SEAL, ...job }, ...more });

describe('a job heard', () => {
  it('began age_ms before it was heard, on this device\'s clock, and keeps that as it moves', () => {
    const h = J.heardProgress(progress({}), 100_000)!;
    expect(h.since).toBe(91_000);
    expect(h.project).toBe('weft');
    const later = J.heardProgress(progress({ age_ms: 10_100 }), 101_000)!;
    expect(later.since).toBe(91_000);
    expect(later.heard).toBe(101_000);
  });

  it('is matched by the request of this device\'s that began it, which only its first copy names', () => {
    J.heardProgress(progress({}, { req: 4 }), 1_000);
    J.heardProgress(progress({ age_ms: 9_500 }), 1_500);
    expect(J.byReq(4)?.id).toBe('job_7');
    expect(J.byReq(5)).toBeNull();
    expect(J.byReq(undefined)).toBeNull();
  });

  it('is matched by what it is about, in its project, of the kinds asked for, the newest first', () => {
    J.heardProgress(progress({}), 1_000);
    J.heardProgress(progress({ id: 'job_8', kind: 'seal_check', on: { seal: 'seal_5' }, age_ms: 0 }), 2_000);
    expect(J.byOn('weft', { work: 'ask_3' })?.id).toBe('job_7');
    expect(J.byOn('weft', { seal: 'seal_5' })?.id).toBe('job_8');
    expect(J.byOn('weft', { seal: 'seal_5' }, ['seal'])?.id).toBe('job_7');
    expect(J.byOn('other', { work: 'ask_3' })).toBeNull();
    expect(J.byOn('weft', { work: 'ask_9' })).toBeNull();
  });

  it('once ended, is no longer shown as running; one that ended well is let go after a while', () => {
    J.heardProgress(progress({}, { req: 4 }), 1_000);
    J.heardProgress(progress({ end: { ok: true } }), 2_000);
    expect(J.byReq(4)).toBeNull();
    expect(J.byOn('weft', { work: 'ask_3' })).toBeNull();
    expect(J.lastOn('weft', { work: 'ask_3' })?.end?.ok).toBe(true);
    J.heardProgress(progress({ id: 'job_9' }), 2_000 + J.KEEP_ENDED + 1);
    expect(J.jobs.value.job_7).toBeUndefined();
  });

  it('that failed is kept until the person acts on it', () => {
    J.heardProgress(progress({ end: { ok: false, why: 'the record moved' } }), 1_000);
    J.heardProgress(progress({ id: 'job_9' }), 60_000);
    expect(J.jobs.value.job_7?.end).toEqual({ ok: false, why: 'the record moved' });
    J.letGo('job_7');
    expect(J.jobs.value.job_7).toBeUndefined();
  });
});

describe('the jobs said after a welcome', () => {
  it('take the place of a project\'s jobs, keep each one\'s request, and leave other projects\' alone', () => {
    J.heardProgress(progress({}, { req: 4 }), 1_000);
    J.heardProgress(progress({ id: 'job_gone' }), 1_000);
    J.heardProgress({ ...progress({ id: 'job_there' }), project: 'gl' }, 1_000);
    J.welcomed();
    J.heardJobs({ type: 'jobs', project: 'weft', jobs: [{ ...SEAL, age_ms: 30_000 }] }, 40_000);
    expect(Object.keys(J.jobs.value).sort()).toEqual(['job_7', 'job_there']);
    expect(J.byReq(4)?.id).toBe('job_7');
    // Its time is said afresh: it began 30 s before.
    expect(J.jobs.value.job_7.since).toBe(10_000);
  });

  it('let go what was not said again', () => {
    J.heardProgress({ ...progress({ id: 'job_there' }), project: 'gl' }, 1_000);
    J.welcomed();
    J.notToldAgain();
    expect(J.jobs.value).toEqual({});
  });
});

describe('a job\'s steps in words', () => {
  it('counts files, MB, reads, readers and steps in their words', () => {
    expect(J.countWords({ key: 'k', state: 'now', done: 8412, total: 15902, unit: 'files' })).toBe('8,412 of 15,902 files');
    expect(J.countWords({ key: 'k', state: 'now', done: 41_200_000, total: 94_000_000, unit: 'bytes' })).toBe('41 of 94 MB');
    expect(J.countWords({ key: 'k', state: 'now', done: 3, total: 7, unit: 'reads' })).toBe('3 of 7 read');
    expect(J.countWords({ key: 'k', state: 'now', done: 2, total: 5, unit: 'steps' })).toBe('step 2 of 5');
    expect(J.countWords({ key: 'k', state: 'now', done: 2, total: 3, unit: 'readers' })).toBe('2 of 3 readers');
    expect(J.countWords({ key: 'k', state: 'now' })).toBeNull();
  });

  it('says done steps with their time, the one under way with its count and its time running on, those to come bare', () => {
    const h = J.heardProgress(progress({}), 100_000)!;
    expect(J.lines(h, 103_000)).toEqual([
      { state: 'done', words: 'Checking the work and its Eval', time: '0:02', count: null },
      { state: 'now', words: 'Reading every file as it is now', time: '0:10', count: '8,412 of 15,902 files' },
      { state: 'next', words: 'Writing your decision', time: null, count: null },
      { state: 'next', words: 'Noting it in Git', time: null, count: null },
    ]);
  });

  it('fills a step\'s words with their values, and says how many of the files are new', () => {
    const line = J.stepLine({ key: 'step.reading_change', state: 'now', ms: 18_000, done: 38, total: 103, unit: 'files', args: { new: '9' } }, 0, 0);
    expect(line).toEqual({ state: 'now', words: 'Reading the change', time: '0:18', count: '38 of 103 files', fresh: '9 of them new' });
    expect(J.stepWords({ key: 'step.starting_readers', state: 'next', args: { harness: 'antigravity' } })).toBe('Starting antigravity to read it');
    expect(J.stepWords({ key: 'step.waiting_ready', state: 'now', args: { agent: 'codex' } })).toBe('Waiting for codex to be ready');
  });

  it('fills the bar by how much is done when the machine says, else slides it', () => {
    const h = J.heardProgress(progress({}), 0)!;
    expect(J.filled(h)).toBe(0.4);
    expect(J.filled({ ...h, share: undefined })).toBeNull();
    expect(J.filled({ ...h, share: 1.3 })).toBe(1);
    expect(J.filled(null)).toBeNull();
  });

  it('says why one failed in its sentence', () => {
    const h = J.heardProgress(progress({ kind: 'eval_open', end: { ok: false, why: 'git exited 128' } }), 0)!;
    expect(J.failedWords(h)).toBe('RingFrame could not open the Eval: git exited 128');
    expect(J.failedWords({ ...h, kind: 'seal_check' })).toBe('The receipt could not be checked: git exited 128');
    expect(J.failedWords({ ...h, kind: 'send' })).toBe('git exited 128');
  });
});

describe('a running Eval\'s steps', () => {
  const STEPS = [
    { name: 'What you asked', light: 'done' as const },
    { name: 'Reading the change, all of it at once', light: 'now' as const },
    { name: 'Reading again where unsure, if needed', light: 'next' as const },
    { name: 'Questions for your Seal, if needed', light: 'next' as const },
  ];
  const READERS: J.Job = {
    id: 'job_r', kind: 'readers', on: { eval: 'evl_3' }, age_ms: 277_000,
    steps: [
      { key: 'step.a', state: 'done', ms: 6_000 },
      { key: 'step.b', state: 'now', ms: 271_000, done: 3, total: 7, unit: 'reads' },
      { key: 'step.c', state: 'next' },
      { key: 'step.d', state: 'next' },
    ],
  };

  it('keep the Eval\'s own names, and take each step\'s time and the count under way from its readers\' job', () => {
    const job = J.heardProgress({ type: 'progress', project: 'weft', job: READERS }, 0)!;
    expect(J.byOn('weft', { eval: 'evl_3' }, ['readers'])?.id).toBe('job_r');
    expect(J.evalLines(STEPS, job, 0).map((l) => [l.state, l.words, l.time, l.count])).toEqual([
      ['done', 'What you asked', '0:06', null],
      ['now', 'Reading the change, all of it at once', '4:31', '3 of 7 read'],
      ['next', 'Reading again where unsure, if needed', null, null],
      ['next', 'Questions for your Seal, if needed', null, null],
    ]);
  });

  it('take only the count under way when the job lists its steps otherwise', () => {
    const job = J.heardProgress({ type: 'progress', project: 'weft', job: { ...READERS, steps: [READERS.steps[1]] } }, 0)!;
    expect(J.evalLines(STEPS, job, 0).map((l) => [l.time, l.count])).toEqual([[null, null], ['4:31', '3 of 7 read'], [null, null], [null, null]]);
  });
});
