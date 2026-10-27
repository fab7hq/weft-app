// The Ask sheet: what it sends from the route, plan and rules the person kept.
import { describe, expect, it } from 'vitest';
import { canAsk, draftOf, isIn, moreCount, routeLabel, sensing, shownRules, type Sheet } from '../src/ask';

const rule = (id: string) => ({ id, label: id, text: `${id} text`, family: null, layer: 'shipped' });
const ids = (n: number) => Array.from({ length: n }, (_, i) => `r${i}`);
const sheet: Sheet = {
  routes: ['native_plan', 'native_goal'], route: 'native_plan', tasks: ['plan', 'implement'], task: 'plan',
  plan: { slug: 'x', path: 'plans/x/plan.md', title: 'X' }, plans: [{ slug: 'x', path: 'plans/x/plan.md', title: 'X' }],
  practices: ['a', 'b', 'c', 'd', 'e'].map(rule), route_rules: [rule('step')],
};
/** A sheet of 14 practices of which Sense proposed the first `n`. */
const sensed = (n: number): Sheet => ({ ...sheet, practices: ids(14).map(rule), proposed: ids(n), senses: true });

describe('the Ask sheet', () => {
  it('names a route as a word', () => {
    expect(routeLabel('native_goal')).toBe('Goal');
    expect(routeLabel('human_handoff')).toBe('Human handoff');
  });

  it('sends the route, its task, the plan shown or picked, and every practice kept', () => {
    expect(draftOf(sheet, { plan: undefined, picked: new Map([['b', false]]) })).toEqual({
      route: 'native_plan', task: 'plan', plan: 'plans/x/plan.md', rules: ['a', 'c', 'd', 'e'],
    });
    expect(draftOf(sheet, { plan: null, picked: new Map() }).plan).toBeNull();
  });

  it('without Sense keeps every practice and shows the first few', () => {
    const picked = new Map([['a', false]]);
    expect(shownRules(sheet, picked, false).map((r) => r.id)).toEqual(['b', 'c', 'd']);
    expect(moreCount(sheet, picked, false)).toBe(2);
    expect(shownRules(sheet, picked, true)).toHaveLength(4);
  });

  it('with Sense keeps only what it proposed, with 0, 1 or 12 of 14', () => {
    for (const [n, shown, more] of [[0, 0, 14], [1, 1, 13], [12, 3, 11]] as const) {
      const s = sensed(n);
      expect(shownRules(s, new Map(), false)).toHaveLength(shown);
      expect(moreCount(s, new Map(), false)).toBe(more);
      expect(draftOf(s, { plan: undefined, picked: new Map() }).rules).toEqual(ids(n));
    }
  });

  it('lets the person add a practice Sense left out and take out one it proposed', () => {
    const s = sensed(1);
    const picked = new Map([['r0', false], ['r5', true]]);
    expect(isIn(s, picked, 'r0')).toBe(false);
    expect(isIn(s, picked, 'r5')).toBe(true);
    expect(draftOf(s, { plan: undefined, picked }).rules).toEqual(['r5']);
  });

  it('asks only once a route is picked', () => {
    expect(canAsk(sheet)).toBe(true);
    expect(canAsk({ ...sheet, route: null })).toBe(false);
    expect(canAsk(null)).toBe(true);
  });

  it('shows Sense at work while the sheet is for other words, unless the person picks', () => {
    const s = { ...sensed(1), senses: true };
    expect(sensing(s, 'old words', 'new words', false)).toBe(true);
    expect(sensing(s, 'new words', 'new words', false)).toBe(false);
    expect(sensing(s, 'old words', 'new words', true)).toBe(false);
    expect(sensing(s, 'old', '   ', false)).toBe(false);
    expect(sensing({ ...s, senses: false }, 'old', 'new', false)).toBe(false);
    expect(sensing(null, null, 'new', false)).toBe(false);
  });
});
