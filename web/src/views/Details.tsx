// A work's Details: the TUI's, read from the machine.
import type { Machine } from '../api';
import * as m from '../machine';
import { back } from '../nav';

export function Details({ machine, unit }: { machine: Machine; unit: string }) {
  const where = m.tree.value.flatMap((p) => p.harnesses.flatMap((h) => h.works.map((w) => ({ p, w })))).find((x) => x.w.unit === unit);
  return (
    <div class="app">
      <div class="appbar">
        <button class="back" type="button" onClick={back}>{`‹ ${where?.p.project ?? machine.name}`}</button>
      </div>
      <div class="page">
        <h2>{where?.w.title}</h2>
      </div>
    </div>
  );
}
