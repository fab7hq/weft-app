// An Eval's judges: panes the machine started for it, each a row of the
// `agents` message that names its Eval. They are never the person's agents,
// so no list of agents holds them; the Eval lists its own.
import type { Agent } from './machine';

/** The person's agents, and the judges. */
export function apart(rows: Agent[]): { agents: Agent[]; judges: Agent[] } {
  return { agents: rows.filter((r) => !r.judge), judges: rows.filter((r) => r.judge) };
}

/** The judges of one Eval. */
export const judgesOf = (judges: Agent[], evalId: string): Agent[] => judges.filter((j) => j.judge === evalId);
