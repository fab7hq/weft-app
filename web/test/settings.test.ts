// A machine's switches, as its settings say them.
import { describe, expect, it } from 'vitest';
import { KEYS, gitNoteOn, machineSwitch, type Settings } from '../src/settings';

const said = (machine: Record<string, unknown>): Settings => ({ machine, project: null, effective: {} });

describe('a machine switch', () => {
  it('is Turbo and Start at login off, and Notifications and Suggestions on, until set', () => {
    for (const s of [undefined, said({})]) {
      expect(machineSwitch(s, 'turbo')).toBe(false);
      expect(machineSwitch(s, 'login')).toBe(false);
      expect(machineSwitch(s, 'notify')).toBe(true);
      expect(machineSwitch(s, 'suggest')).toBe(true);
    }
  });

  it('is what the machine says once it says it', () => {
    const s = said({ turbo: true, notify: false, suggest: false, service: { start_at_login: true } });
    expect(machineSwitch(s, 'turbo')).toBe(true);
    expect(machineSwitch(s, 'login')).toBe(true);
    expect(machineSwitch(s, 'notify')).toBe(false);
    expect(machineSwitch(s, 'suggest')).toBe(false);
  });

  it('is kept where the desktop keeps it', () => {
    expect(KEYS.login).toEqual(['service', 'start_at_login']);
    expect(KEYS.turbo).toEqual(['turbo']);
  });
});

import { ENTRIES, at, differs, shownValue } from '../src/settings';

describe('Workflow and a project\'s own settings', () => {
  const s: Settings = {
    machine: { routing: { eval: 'claude' }, eval: { debate: { harness: 'codex', map: { effort: 'low' } } } },
    project: { routing: { eval: 'codex' } },
    effective: {},
  };
  const titles = [{ project: 'weft', harness: 'claude', title: 'Claude Code' }, { project: 'weft', harness: 'codex', title: 'Codex' }];

  it('reads a setting where it is kept, every project\'s or the project\'s own', () => {
    expect(at(s.machine, ['routing', 'eval'])).toBe('claude');
    expect(at(s.project, ['routing', 'eval'])).toBe('codex');
    expect(at(s.machine, ['eval', 'debate', 'map', 'effort'])).toBe('low');
    expect(at(s.machine, ['routing', 'ask'])).toBeUndefined();
  });

  it('shows a harness by its title, and nothing set by what applies then', () => {
    const ask = ENTRIES.find((e) => e.name === 'Ask')!;
    const runs = ENTRIES.find((e) => e.name === 'Runs in')!;
    const model = ENTRIES.find((e) => e.name === 'Map model')!;
    expect(shownValue(ask, 'claude', titles)).toBe('Claude Code');
    expect(shownValue(ask, undefined, titles)).toBe('desktop.settings.agent_you_are_in');
    expect(shownValue(runs, undefined, titles)).toBe('desktop.settings.where_eval_runs');
    expect(shownValue(model, undefined, titles)).toBe('desktop.settings.own_model');
  });

  it('lists only what a project sets for itself, never Turbo', () => {
    expect(differs(s).map((e) => e.name)).toEqual(['Eval']);
    expect(ENTRIES.some((e) => e.key[0] === 'turbo')).toBe(false);
  });
});

import { HOW_HARD, effortChoices, howHard, judgesIn, modelChoices, reachKey, type JudgeEval } from '../src/settings';

describe("Eval's judges", () => {
  const claude: JudgeEval = {
    efforts: ['low', 'medium', 'high', 'xhigh', 'max'], effort: 'model', models: ['haiku', 'sonnet'], model_typed: false,
    default: { map: 'low', reduce: 'medium', confirm: 'medium' },
  };
  const efforts = (map?: string, reduce?: string, confirm?: string) => ({
    eval: { debate: { map: { effort: map }, reduce: { effort: reduce }, confirm: { effort: confirm } } },
  });

  it('run where the debate is set, else where Eval runs, else nowhere known', () => {
    expect(judgesIn({ eval: { debate: { harness: 'codex' } }, routing: { eval: 'claude' } })).toBe('codex');
    expect(judgesIn({ routing: { eval: 'claude' } })).toBe('claude');
    expect(judgesIn({})).toBeUndefined();
  });

  it('look Balanced with nothing set, Quick or Thorough when all three say so, else Custom', () => {
    expect(howHard({})).toBe('balanced');
    expect(howHard(efforts('low', 'low', 'low'))).toBe('quick');
    expect(howHard(efforts('high', 'high', 'high'))).toBe('thorough');
    expect(howHard(efforts('high', undefined, undefined))).toBe('custom');
    expect(HOW_HARD).toEqual({ quick: 'low', balanced: null, thorough: 'high' });
  });

  it('offer the efforts the harness takes, a default by its value, and the common ones without a file', () => {
    expect(effortChoices(claude, 'reduce')).toEqual({ none: ['desktop.settings.effort_default', 'medium'], efforts: claude.efforts });
    expect(effortChoices(undefined, 'map')).toEqual({ none: ['desktop.settings.own_effort', null], efforts: ['low', 'medium', 'high', 'xhigh'] });
  });

  it('offer the models the harness takes, a typed one where it takes any, and none where a judge runs on the session', () => {
    expect(modelChoices(claude)).toEqual({ models: ['haiku', 'sonnet'], typed: false });
    expect(modelChoices({ ...claude, models: [], model_typed: true })).toEqual({ models: [], typed: true });
    expect(modelChoices({ ...claude, models: [] })).toEqual({ models: [], typed: false });
    expect(modelChoices(undefined)).toEqual({ models: [], typed: true });
  });

  it('say what an effort changes there', () => {
    expect(reachKey(claude)).toBe('desktop.settings.effort_reaches_model');
    expect(reachKey({ ...claude, effort: 'lookups' })).toBe('desktop.settings.effort_reaches_lookups');
    expect(reachKey(undefined)).toBe('desktop.settings.effort_reaches_unknown');
  });
});

import { domainName, withDeny, withRule } from '../src/settings';

describe('RingFrame, written as RingFrame reads it', () => {
  it('sets a rule\'s field in the list that holds it, and takes an emptied rule out', () => {
    const list = [{ id: 'practice.kiss', enabled: false }];
    expect(withRule(list, 'practice.kiss', 'enabled', true)).toEqual([{ id: 'practice.kiss', enabled: true }]);
    expect(withRule(list, 'practice.yagni', 'tier', 'situational')).toEqual([...list, { id: 'practice.yagni', tier: 'situational' }]);
    expect(withRule(list, 'practice.kiss', null, null)).toBeNull();
    expect(withRule(list, 'practice.kiss', 'enabled', null)).toBeNull();
    expect(withRule([], 'own.1', 'text', 'Say it plainly.')).toEqual([{ id: 'own.1', text: 'Say it plainly.', applies_to: ['implement'], tier: 'situational' }]);
  });

  it('adds and removes a line of what judges must not do; emptied, the list denies nothing', () => {
    expect(withDeny(undefined, '+', 'Push.')).toEqual(['Push.']);
    expect(withDeny(['Push.', 'Delete.'], 0, null)).toEqual(['Delete.']);
    expect(withDeny(['Push.'], 0, null)).toEqual([]);
  });

  it('names a practice in words', () => {
    expect(domainName('autonomous-trading')).toBe('Autonomous trading');
  });
});

describe('a project\'s Git note', () => {
  it('is on only where the project turned it on', () => {
    const project = (p: Record<string, unknown> | null): Settings => ({ machine: { export: { git_note: true } }, project: p, effective: {} });
    expect(gitNoteOn(undefined)).toBe(false);
    expect(gitNoteOn(project(null))).toBe(false);
    expect(gitNoteOn(project({ export: { git_note: true } }))).toBe(true);
    expect(gitNoteOn(project({ export: { git_note: false } }))).toBe(false);
  });
});
