// The panes' tree: every operation and its refusals.
import { describe, expect, it } from 'vitest';
import * as L from '../src/layout';

const ROOM = { width: 900, height: 600 };
const five = () => L.sync(L.fresh(), ['gl-0', 'gl-1', 'ob-0', 'docs-0', 'docs-1']);
const tabs = (l: L.Layout) => L.panes(l).map((p) => p.tabs);
const done = (l: L.Layout | L.Refusal): L.Layout => {
  if (typeof l === 'string') throw new Error(l);
  return l;
};
const right = (l: L.Layout) => done(L.split(l, 'right', ROOM, 4));
const down = (l: L.Layout) => done(L.split(l, 'down', ROOM, 4));

/** As the four-pane card lays them out: gl · codex and openbox above; gl · claude and docs' two below. */
function four(): L.Layout {
  let l = right(L.show(five(), 'ob-0'));
  l = down(L.show(l, 'gl-1'));
  const r = L.paneOf(l, 'ob-0')!;
  l = done(L.drop(l, 'docs-0', { edge: r, side: 'down' }, ROOM, 4));
  return done(L.drop(l, 'docs-1', { middle: L.paneOf(l, 'docs-0')! }, ROOM, 4));
}

describe('panes', () => {
  it('one pane holds every agent in the order they came', () => {
    const l = five();
    expect(tabs(l)).toEqual([['gl-0', 'gl-1', 'ob-0', 'docs-0', 'docs-1']]);
    expect(L.showing(L.active(l))).toBe('gl-0');
  });

  it('a split moves the tab with the keys to a new pane that gets them; numbers count pane by pane', () => {
    const l = right(L.show(five(), 'ob-0'));
    expect(tabs(l)).toEqual([['gl-0', 'gl-1', 'docs-0', 'docs-1'], ['ob-0']]);
    expect(L.showing(L.active(l))).toBe('ob-0');
    expect(L.order(l).at(-1)).toBe('ob-0');
    expect(L.showing(L.panes(l)[0])).toBe('docs-0');
  });

  it('refuses a pane of one agent, a fifth pane, and a pane under 360 × 200', () => {
    expect(L.split(L.sync(L.fresh(), ['a']), 'right', ROOM, 4)).toBe('why.split_needs_two');
    const l = L.show(four(), 'docs-0');
    expect(L.split(l, 'right', { width: 4000, height: 4000 }, 4)).toBe('web.why.four_panes');
    expect(L.split(five(), 'right', ROOM, 1)).toBe('why.no_room');
    expect(L.split(five(), 'right', { width: 700, height: 600 }, 4)).toBe('why.no_room');
    expect(L.split(five(), 'down', { width: 900, height: 390 }, 4)).toBe('why.no_room');
  });

  it('panes share the space equally, and four are a quarter each, numbered left to right, top to bottom', () => {
    const l = four();
    expect(L.rects(l, { width: 1000, height: 600 }).map(({ x, y, width, height }) => [x, y, width, height])).toEqual([
      [0, 0, 500, 300], [500, 0, 500, 300], [0, 300, 500, 300], [500, 300, 500, 300],
    ]);
    expect(L.order(l)).toEqual(['gl-0', 'ob-0', 'gl-1', 'docs-0', 'docs-1']);
    const wide = { width: 1200, height: 600 };
    let three = right(five());
    three = done(L.split(L.show(three, 'gl-1'), 'right', wide, 4));
    expect(L.rects(three, { width: 1200, height: 600 }).map((r) => r.width)).toEqual([400, 400, 400]);
  });

  it('moves the tab with the keys to the next pane; an empty pane closes; one pane has no next', () => {
    expect(L.moveNext(five())).toEqual(five());
    let l = right(L.show(five(), 'docs-1'));
    l = L.moveNext(L.show(l, 'gl-0'));
    expect(tabs(l)).toEqual([['gl-1', 'ob-0', 'docs-0'], ['docs-1', 'gl-0']]);
    l = L.moveNext(L.show(l, 'docs-1'));
    l = L.moveNext(L.show(l, 'gl-0'));
    expect(L.count(l)).toBe(1);
  });

  it('joins every pane into one, in the order they were numbered', () => {
    const l = L.show(four(), 'gl-1');
    const j = L.join(l);
    expect(tabs(j)).toEqual([L.order(l)]);
    expect(L.showing(L.active(j))).toBe('gl-1');
  });

  it('keeps the tabs to the agents running; the last pane stays', () => {
    let l = right(L.show(five(), 'docs-1'));
    l = L.sync(l, ['gl-0', 'gl-1', 'ob-0', 'docs-0', 'new-0']);
    expect(L.count(l)).toBe(1);
    expect(L.order(l).at(-1)).toBe('new-0');
    expect(L.count(L.sync(l, []))).toBe(1);
  });

  it('a dragged tab reorders, moves, splits or joins; a lone tab onto its own edge is refused', () => {
    let l = five();
    const first = L.active(l).id;
    l = done(L.drop(l, 'docs-1', { bar: first, at: 0 }, ROOM, 4));
    expect(L.order(l)[0]).toBe('docs-1');
    l = done(L.drop(l, 'gl-0', { edge: first, side: 'down' }, ROOM, 4));
    expect(tabs(l)).toEqual([['docs-1', 'gl-1', 'ob-0', 'docs-0'], ['gl-0']]);
    const below = L.active(l).id;
    l = done(L.drop(l, 'ob-0', { edge: below, side: 'left' }, { width: 900, height: 900 }, 4));
    expect(tabs(l).slice(1)).toEqual([['ob-0'], ['gl-0']]);
    l = done(L.drop(l, 'ob-0', { middle: first }, ROOM, 4));
    expect(tabs(l)).toEqual([['docs-1', 'gl-1', 'docs-0', 'ob-0'], ['gl-0']]);
    l = done(L.drop(l, 'gl-0', { bar: first, at: 1 }, ROOM, 4));
    expect(tabs(l)).toEqual([['docs-1', 'gl-0', 'gl-1', 'docs-0', 'ob-0']]);
    const one = L.sync(L.fresh(), ['a']);
    expect(L.drop(one, 'a', { edge: L.active(one).id, side: 'right' }, ROOM, 4)).toBe('why.split_needs_two');
  });

  it('a lone tab dragged to another pane\'s edge keeps the count at four', () => {
    const l = four();
    const target = L.panes(l)[0].id;
    expect(L.count(done(L.drop(l, 'ob-0', { edge: target, side: 'up' }, { width: 2000, height: 2000 }, 4)))).toBe(4);
  });

  it('a point in a pane lands on its nearest edge within a fifth, else its middle', () => {
    expect(L.zone(3, 0.1, 0.5)).toEqual({ edge: 3, side: 'left' });
    expect(L.zone(3, 0.5, 0.9)).toEqual({ edge: 3, side: 'down' });
    expect(L.zone(3, 0.5, 0.5)).toEqual({ middle: 3 });
  });

  it('a layout read back from storage is one, or none', () => {
    expect(L.readLayout(JSON.parse(JSON.stringify(four())))).toEqual(four());
    expect(L.readLayout({ root: { axis: 'sideways', kids: [] }, active: 0, next: 1 })).toBeNull();
    expect(L.readLayout('x')).toBeNull();
  });
});
