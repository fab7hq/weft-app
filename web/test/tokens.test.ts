// The design guideline's tokens (src/tokens.css, from Toile's `weft`) are the
// one place a colour, a corner or a shadow is set; every other stylesheet
// names them.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = join(import.meta.dirname, '../src');
const tokens = readFileSync(join(src, 'tokens.css'), 'utf8');
const sheets = [
  ...readdirSync(src).filter((f) => f.endsWith('.css') && f !== 'tokens.css'),
  ...readdirSync(join(src, 'css')).map((f) => `css/${f}`),
].map((name) => ({ name, css: readFileSync(join(src, name), 'utf8') }));

/** The values tokens.css gives its colour properties. */
const colours = new Set([...tokens.matchAll(/--[\w-]+:\s*(#[0-9a-f]{6})\b/gi)].map((m) => m[1].toLowerCase()));

/** Each declaration of `prop` in a stylesheet: its value. */
const values = (css: string, prop: string) =>
  [...css.matchAll(new RegExp(`(?:^|[;{\\s])${prop}:\\s*([^;}]+)`, 'g'))].map((m) => m[1].trim());

describe('the tokens', () => {
  it('are the guideline’s', () => {
    expect(tokens).toContain('--fab7-canvas: #090d16;');
    expect(tokens).toContain('--weft-radius: 0px;');
    expect(colours.size).toBeGreaterThan(15);
  });

  it('are named, never copied: no stylesheet writes a token’s colour itself', () => {
    for (const { name, css } of sheets) {
      const copied = [...css.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase()).filter((c) => colours.has(c));
      expect(copied, name).toEqual([]);
    }
  });

  it('draw no rounded corner and no drop shadow', () => {
    for (const { name, css } of sheets) {
      expect(values(css, 'border-radius').filter((v) => v !== '0'), name).toEqual([]);
      const shadows = values(css, 'box-shadow').filter((v) => v !== 'none' && !v.startsWith('inset') && !v.startsWith('var(--weft-bevel'));
      expect(shadows, name).toEqual([]);
    }
  });
});
