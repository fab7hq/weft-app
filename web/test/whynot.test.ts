// Where an act cannot run, the app says why (Atlas M10.1): no control is ever
// drawn disabled.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.tsx') ? [p] : [];
  });

it('no view draws a disabled control', () => {
  const found = files('web/src').filter((f) => /\bdisabled\s*=/.test(readFileSync(f, 'utf8')));
  expect(found).toEqual([]);
});
