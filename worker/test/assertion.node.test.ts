// The Worker's signing code, run in Node, makes the assertion weft-remote's
// Rust test verifies (weft: crates/weft-remote/tests/fixtures/worker-assertion.json).
// Ed25519 is deterministic, so the fixture is the same on every run.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { sign } from '../src/assert';

const here = import.meta.dirname;

it('signs the fixture weft remote checks', async () => {
  const pem = readFileSync(path.join(here, 'fixtures/test-assertion-key.pem'), 'utf8');
  const exp = 1_791_000_060;
  const claims = { iss: 'fab7', sub: 42, login: 'octo', machine: 'm_fixture', device: 'd_fixture', exp };
  const fixture = {
    public: readFileSync(path.join(here, 'fixtures/test-assertion-key.pub'), 'utf8').trim(),
    assertion: await sign(pem, claims),
    now: exp - 30,
    machine: 'm_fixture',
    owner: 42,
  };
  const file = path.join(here, 'fixtures/worker-assertion.json');
  const text = JSON.stringify(fixture, null, 2) + '\n';
  writeFileSync(file, text);
  expect(readFileSync(file, 'utf8')).toBe(text);
});
