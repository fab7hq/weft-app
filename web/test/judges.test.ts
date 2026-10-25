// An Eval's judges are panes the machine started: never the person's agents,
// listed under the Eval they judge.
import { describe, expect, it } from 'vitest';
import { apart, judgesOf } from '../src/judges';
import type { Agent } from '../src/machine';

const row = (agent: string, judge: string | null = null): Agent => ({
  agent, project: 'weft', harness: 'codex', title: 'Codex', turn: 'working', running: true, since: 0, judge,
});

describe('judges', () => {
  it('are kept apart from the agents', () => {
    const { agents, judges } = apart([row('a1'), row('a2', 'evl_1'), row('a3', 'evl_2'), row('a4')]);
    expect(agents.map((a) => a.agent)).toEqual(['a1', 'a4']);
    expect(judges.map((a) => a.agent)).toEqual(['a2', 'a3']);
  });

  it('are listed under the Eval they judge', () => {
    const { judges } = apart([row('a2', 'evl_1'), row('a3', 'evl_2'), row('a5', 'evl_1')]);
    expect(judgesOf(judges, 'evl_1').map((a) => a.agent)).toEqual(['a2', 'a5']);
    expect(judgesOf(judges, 'evl_9')).toEqual([]);
  });
});
