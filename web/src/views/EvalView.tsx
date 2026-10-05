// A work's Eval view: its title, for now.
import type { Machine } from '../api';
import * as m from '../machine';
import { back } from '../nav';
import { w } from '../words';

export function EvalView({ machine, unit }: { machine: Machine; unit: string }) {
  const work = m.tree.value.flatMap((p) => p.harnesses.flatMap((h) => h.works)).find((x) => x.unit === unit);
  return (
    <div class="app">
      <div class="appbar">
        <button class="back" type="button" onClick={back}>{`‹ ${machine.name}`}</button>
      </div>
      <div class="page" role="region" aria-label={w('act.eval_view')}>
        <h2>{work?.title}</h2>
      </div>
    </div>
  );
}
