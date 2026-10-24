// The Ask sheet: what it sends from the route, plan and rules the person kept.
import { describe, expect, it } from 'vitest';
import { draftOf, routeLabel, shownRules, type Sheet } from '../src/ask';

const rule = (id: string) => ({ id, label: id, text: `${id} text`, family: null, layer: 'shipped' });
const sheet: Sheet = {
  routes: ['native_plan', 'native_goal'], route: 'native_plan', tasks: ['plan', 'implement'], task: 'plan',
  plan: { slug: 'x', path: 'plans/x/plan.md', title: 'X' }, plans: [{ slug: 'x', path: 'plans/x/plan.md', title: 'X' }],
  practices: ['a', 'b', 'c', 'd', 'e'].map(rule), route_rules: [rule('step')],
};

describe('the Ask sheet', () => {
  it('names a route as a word', () => {
    expect(routeLabel('native_goal')).toBe('Goal');
    expect(routeLabel('human_handoff')).toBe('Human handoff');
  });

  it('sends the route, its task, the plan shown or picked, and every practice not taken out', () => {
    expect(draftOf(sheet, { plan: undefined, removed: new Set(['b']) })).toEqual({
      route: 'native_plan', task: 'plan', plan: 'plans/x/plan.md', rules: ['a', 'c', 'd', 'e'],
    });
    expect(draftOf(sheet, { plan: null, removed: new Set() }).plan).toBeNull();
  });

  it('shows the first practices and how many more, or all of them', () => {
    expect(shownRules(sheet.practices, new Set(['a']), false).map((r) => r.id)).toEqual(['b', 'c', 'd']);
    expect(shownRules(sheet.practices, new Set(['a']), true)).toHaveLength(4);
  });
});
