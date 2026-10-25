// What sealed work offers: each offer is its own act on the unit.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { use } from '../src/words';
import { commitCount, commitsRead, remedyRead, undoMessage } from '../src/offers';

use(JSON.parse(readFileSync('web/public/words.json', 'utf8')));

describe('offers after a Seal', () => {
  it('reads a follow-up\'s words for rejected work', () => {
    expect(remedyRead('/w', 'ask_1')).toEqual({ type: 'read', what: 'remedy', project: '/w', unit: 'ask_1' });
  });

  it('reads the commits Undo offers and sends the one picked', () => {
    expect(commitsRead('/w', 'ask_1')).toEqual({ type: 'read', what: 'commits', project: '/w', unit: 'ask_1' });
    expect(undoMessage('/w', 'ask_1', '7ab3d10ff')).toEqual({ act: 'undo', project: '/w', unit: 'ask_1', commit: '7ab3d10ff' });
  });

  it('counts the commits Undo lists', () => {
    expect([commitCount(1), commitCount(8)]).toEqual(['1 commit', '8 commits']);
  });
});
