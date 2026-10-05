// The words the app shares with Weft's TUI come from words.json, never from
// the app's own source.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { evalState, stateWord, turnWord, use } from '../src/words';

const words: Record<string, string> = JSON.parse(readFileSync('web/public/words.json', 'utf8'));

describe('words.json', () => {
  it('names the state words, the turn words and the Eval states', () => {
    use(words);
    expect(stateWord('sealed')).toBe(words['word.sealed']);
    expect(turnWord('waiting')).toBe(words['turn.waiting']);
    expect(evalState('met')).toBe('met');
    expect(evalState('not_met')).toBe('not met');
    expect(evalState({ read: 'not_met' })).toBe('not met, so far');
  });

  it('holds every word no TSX spells', () => {
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? files(p) : p.endsWith('.tsx') ? [p] : [];
      });
    const found: string[] = [];
    for (const file of files('web/src')) {
      const text = readFileSync(file, 'utf8');
      // String literals, and the text between JSX tags.
      const spans = [...text.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`|>([^<>{}\n]+)</g)].map((m) => ({
        span: (m[1] ?? m[2] ?? m[3] ?? m[4]).trim(),
        jsx: m[4] !== undefined,
      }));
      for (const { span, jsx } of spans) {
        for (const [key, word] of Object.entries(words)) {
          // A sentence is found inside a longer string, a short word only as a
          // string of its own; a lower-case word in code is a name, not a word shown.
          const spelled = word.split(/\{[a-z]+\}/).some((part, _, all) => {
            const p = part.trim();
            if (p === '' || (all.length > 1 && p.length <= 16)) return false;
            if (!jsx && /^[a-z_]+$/.test(p)) return false;
            const held = (x: string) => (p.length > 16 ? span.includes(x) : span === x);
            return held(p) || held(p.toUpperCase());
          });
          if (spelled) found.push(`${file}: ${key} in "${span}"`);
        }
      }
    }
    expect(found).toEqual([]);
  });
});
