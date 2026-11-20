// Every wait says so where the person acted, and a failure keeps its reason
// until the person acts again.
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { use } from '../src/words';
import * as J from '../src/jobs';
import * as W from '../src/waits';

const words: Record<string, string> = JSON.parse(readFileSync('web/public/words.json', 'utf8'));

/** A machine's answer the test gives when it likes. */
function later() {
  let give!: (a: W.Answer) => void;
  const answer = new Promise<W.Answer>((done) => (give = done));
  return { answer, give };
}

beforeEach(() => {
  use(words);
  W.working.value = null;
  W.failed.value = null;
  W.saving.value = 0;
  W.mine.value = null;
  W.ended.value = null;
  W.refused.value = null;
  J.jobs.value = {};
});

/** An Eval opening on a work, as the machine says it moves. */
const opening = (job: Partial<J.Job> & { req?: number } = {}) => {
  const { req, ...rest } = job;
  return { type: 'progress', project: 'weft', ...(req !== undefined && { req }), job: { id: 'job_1', kind: 'eval_open', on: { work: 'u1' }, steps: [{ key: 'step.reading_change', state: 'now' }], age_ms: 500, ...rest } };
};
const failedWith = (why: string) => ({ end: { ok: false, why } });

describe('the time a wait has taken', () => {
  it('reads m:ss, and shows only past a few seconds', () => {
    expect(W.elapsed(0)).toBe('0:00');
    expect(W.elapsed(4_200)).toBe('0:04');
    expect(W.elapsed(78_000)).toBe('1:18');
    expect(W.isLong(1_000, 1_000 + W.LONG_AFTER - 1)).toBe(false);
    expect(W.isLong(1_000, 1_000 + W.LONG_AFTER)).toBe(true);
  });
});

describe('an act after a yes', () => {
  it('says its words in the bar while the machine has not answered, and none after', async () => {
    const m = later();
    const going = W.during({ words: words['wait.sealing'], about: 'health endpoint · accepted', unit: 'u1', row: 'wait.row_sealing' }, () => m.answer);
    expect(W.working.value?.words).toBe('Sealing…');
    expect(W.working.value?.about).toBe('health endpoint · accepted');
    expect(W.rowWord('u1', 'weft')).toBe(words['wait.row_sealing']);
    m.give({ type: 'ok' });
    await going;
    expect(W.working.value).toBeNull();
    expect(W.rowWord('u1', 'weft')).toBeNull();
  });

  it('runs once: a second press while it works sends nothing', async () => {
    const m = later();
    const asked = vi.fn(() => m.answer);
    const first = W.during({ words: 'Starting codex…', about: 'weft' }, asked);
    expect(await W.during({ words: 'Starting codex…', about: 'weft' }, asked)).toBeNull();
    expect(asked).toHaveBeenCalledTimes(1);
    m.give({ type: 'ok' });
    await first;
  });

  it('keeps why it failed after the bar goes, until the person acts again', async () => {
    vi.useFakeTimers();
    try {
      await W.during({ words: 'Undoing…', about: '' }, () => Promise.resolve({ type: 'error', code: 'refused', message: 'git exited 128' }));
      expect(W.working.value).toBeNull();
      vi.advanceTimersByTime(60_000);
      expect(W.failed.value).toBe('git exited 128');
      W.acted();
      expect(W.failed.value).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('says it could not be sent while not connected, rather than nothing', async () => {
    expect(await W.during({ words: 'Resuming…', about: '' }, () => null)).toBeNull();
    expect(W.failed.value).toBe(words['web.why.not_connected']);
    expect(W.working.value).toBeNull();
  });

  it('leaves to its caller a refusal it says elsewhere', async () => {
    await W.during({ words: 'Sending…', about: '' }, () => Promise.resolve({ type: 'error', code: 'not_running', message: 'not running' }), (a) => a.code === 'not_running');
    expect(W.failed.value).toBeNull();
  });
});

describe('a setting saved', () => {
  it('says saving until the machine answers, and keeps what it would not take', async () => {
    const m = later();
    const going = W.save(() => m.answer);
    expect(W.saving.value).toBe(1);
    m.give({ type: 'error', code: 'refused', message: 'RingFrame overrides it' });
    await going;
    expect(W.saving.value).toBe(0);
    expect(W.failed.value).toBe('RingFrame overrides it');
  });
});

describe('a read', () => {
  it('is still coming while not sent or lost with the connection, never empty or failed', () => {
    expect(W.readOf(null, 'work')).toEqual({ got: null, failed: null });
    expect(W.readOf({ type: 'error', code: 'unknown', lost: true, message: 'Not known: the connection closed.' }, 'work')).toEqual({ got: null, failed: null });
  });

  it('gives what it read, or why it failed', () => {
    expect(W.readOf({ type: 'ok', work: { unit: 'u1' } }, 'work')).toEqual({ got: { unit: 'u1' }, failed: null });
    expect(W.readOf({ type: 'error', code: 'refused', message: "seals/seal_01.json is missing" }, 'seal')).toEqual({ got: null, failed: 'seals/seal_01.json is missing' });
  });
});

describe('an Eval opening', () => {
  const open = () => W.startOpening({ project: 'weft', unit: 'u1', title: 'health endpoint', asks: 2, harness: 'antigravity' }, 1_000);

  it('shows on its row from the machine\'s job, on every device, and not once it has ended', () => {
    W.heardProgress(opening());
    expect(W.rowWord('u1', 'weft')).toBe(words['wait.row_opening_eval']);
    expect(W.rowWord('u2', 'weft')).toBeNull();
    expect(W.rowWord('u1', 'other')).toBeNull();
    W.heardProgress(opening({ end: { ok: true } }));
    expect(W.rowWord('u1', 'weft')).toBeNull();
  });

  it('says sealing… on the row of a work a Seal runs on, begun anywhere', () => {
    W.heardProgress({ type: 'progress', project: 'weft', job: { id: 'job_2', kind: 'seal', on: { work: 'u1' }, steps: [], age_ms: 900 } });
    expect(W.rowWord('u1', 'weft')).toBe(words['wait.row_sealing']);
  });

  it('opens its view once the machine answers yes', () => {
    open();
    expect(W.mine.value?.since).toBe(1_000);
    expect(W.rowWord('u1', 'weft')).toBe(words['wait.row_opening_eval']);
    expect(W.openAnswered({ type: 'ok' })).toBe('open');
    expect(W.mine.value).toBeNull();
  });

  it('shows the job its yes began, by its request, before any other on the work', () => {
    open();
    W.openSent(Object.assign(Promise.resolve({}), { req: 7 }));
    expect(W.mine.value?.req).toBe(7);
    W.heardProgress(opening({ id: 'job_other', age_ms: 9_000 }));
    W.heardProgress(opening({ id: 'job_mine', req: 7 }));
    expect(W.openingJob('weft', 'u1')?.id).toBe('job_mine');
  });

  it('says why RingFrame could not open it, in its words, until the person acts', () => {
    open();
    expect(W.openAnswered({ type: 'error', code: 'refused', message: 'the change could not be read (git exited 128).' })).toBe('failed');
    expect(W.failed.value).toBe('RingFrame could not open the Eval: the change could not be read (git exited 128).');
    expect(W.mine.value).toBeNull();
  });

  it('keeps opening when the connection closed before the answer, and opens once its job has ended', () => {
    open();
    expect(W.openAnswered({ type: 'error', code: 'unknown', lost: true, message: 'Not known: the connection closed.' })).toBe('kept');
    expect(W.failed.value).toBeNull();
    expect(W.mine.value?.lost).toBe(true);
    // Back: the machine says it still opens.
    W.welcomedAgain();
    W.heardJobs({ type: 'jobs', project: 'weft', jobs: [opening().job] });
    expect(W.mine.value?.unit).toBe('u1');
    expect(W.ended.value).toBeNull();
    W.heardProgress(opening({ end: { ok: true } }));
    expect(W.mine.value).toBeNull();
    expect(W.ended.value?.unit).toBe('u1');
  });

  it('has ended, for an open whose answer was lost, when the jobs said after a welcome do not hold it', () => {
    open();
    W.openAnswered({ type: 'error', code: 'unknown', lost: true, message: '' });
    W.welcomedAgain();
    W.heardJobs({ type: 'jobs', project: 'weft', jobs: [] });
    expect(W.mine.value).toBeNull();
    expect(W.ended.value?.unit).toBe('u1');
  });

  it('says the failure every device hears, once, for a work this device showed opening', () => {
    open();
    W.openAnswered({ type: 'error', code: 'unknown', lost: true, message: 'Not known: the connection closed.' });
    W.heardProgress(opening());
    W.heardProgress(opening(failedWith('the change could not be read')));
    expect(W.failed.value).toBe('RingFrame could not open the Eval: the change could not be read');
    expect(W.mine.value).toBeNull();
    expect(W.ended.value).toBeNull();
    expect(W.refused.value).toBe('u1');
    // Said again after a welcome, kept until its Eval is pressed again: not repeated once read.
    W.acted();
    W.welcomedAgain();
    W.heardJobs({ type: 'jobs', project: 'weft', jobs: [opening(failedWith('the change could not be read')).job] });
    expect(W.failed.value).toBeNull();
  });

  it('says the failure of an open another device began, when this device saw it running', () => {
    W.heardProgress(opening());
    W.heardProgress(opening(failedWith('git exited 128')));
    expect(W.failed.value).toBe('RingFrame could not open the Eval: git exited 128');
  });

  it('does not say a failure of a job this device never saw running', () => {
    W.heardJobs({ type: 'jobs', project: 'weft', jobs: [opening({ id: 'never-seen', ...failedWith('no') }).job] });
    expect(W.failed.value).toBeNull();
  });

  it('lets a kept failure go when its Eval is pressed again', () => {
    W.heardJobs({ type: 'jobs', project: 'weft', jobs: [opening(failedWith('no')).job] });
    expect(J.jobs.value.job_1).toBeDefined();
    open();
    expect(J.jobs.value.job_1).toBeUndefined();
  });

  it('waits for its job when it was opening already', () => {
    open();
    expect(W.openAnswered({ type: 'error', code: 'opening', message: "This work's Eval is already opening" })).toBe('kept');
    expect(W.failed.value).toBeNull();
    W.heardProgress(opening({ end: { ok: true } }));
    expect(W.ended.value?.unit).toBe('u1');
  });

  it('lets its block go when nothing is said of it after coming back', () => {
    open();
    W.openAnswered({ type: 'error', code: 'unknown', lost: true, message: '' });
    W.notToldAgain();
    expect(W.mine.value).toBeNull();
  });
});

describe('an act a job reports', () => {
  it('names the request it sent, so the bar shows that job\'s steps', async () => {
    const m = later();
    const going = W.during({ words: 'Sealing…', about: '' }, () => Object.assign(m.answer, { req: 12 }));
    expect(W.working.value?.req).toBe(12);
    W.heardProgress({ type: 'progress', project: 'weft', req: 12, job: { id: 'job_9', kind: 'seal', on: { work: 'u1' }, steps: [], age_ms: 400 } });
    expect(J.byReq(W.working.value?.req)?.id).toBe('job_9');
    m.give({ type: 'ok' });
    await going;
  });

  it('says why a job this device began failed, once, until the person acts', () => {
    W.heardProgress({ type: 'progress', project: 'weft', req: 3, job: { id: 'job_3', kind: 'send', on: { pane: 2 }, steps: [], age_ms: 4_000, end: { ok: false, why: 'codex never said it got it' } } });
    expect(W.failed.value).toBe('codex never said it got it');
    W.acted();
    W.heardJobs({ type: 'jobs', project: 'weft', jobs: [{ id: 'job_3', kind: 'send', on: { pane: 2 }, steps: [], age_ms: 5_000, end: { ok: false, why: 'codex never said it got it' } }] });
    expect(W.failed.value).toBeNull();
  });

  it('does not say the failure of another device\'s act', () => {
    W.heardProgress({ type: 'progress', project: 'weft', job: { id: 'job_4', kind: 'send', on: { pane: 2 }, steps: [], age_ms: 400 } });
    W.heardProgress({ type: 'progress', project: 'weft', job: { id: 'job_4', kind: 'send', on: { pane: 2 }, steps: [], age_ms: 4_000, end: { ok: false, why: 'no' } } });
    expect(W.failed.value).toBeNull();
  });
});
