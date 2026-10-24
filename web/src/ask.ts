// The Ask sheet's draft: what the machine offers for the words and the
// harness, and what the person keeps of it. Nothing is sent until Ask.

export interface Rule { id: string; label: string; text: string; family: string | null; layer: string }
export interface Plan { slug: string; path: string; title: string }
export interface Sheet {
  routes: string[]; route: string; tasks: string[]; task: string;
  plan: Plan | null; plans: Plan[]; practices: Rule[]; route_rules: Rule[];
}

/** A route as the sheet names it: `native_goal` is "Goal", `human_handoff` "Human handoff". */
export function routeLabel(id: string): string {
  const words = id.replace(/^native_/, '').replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** How many practices show before "+ N more". */
export const SHOWN = 3;

/** The practices still in, the first few unless all are shown. */
export function shownRules(practices: Rule[], removed: Set<string>, all: boolean): Rule[] {
  const kept = practices.filter((r) => !removed.has(r.id));
  return all ? kept : kept.slice(0, SHOWN);
}

/** What Ask sends: the route and task, the plan (the one offered unless the person
 * picked another or none), and every practice they did not take out. */
export function draftOf(sheet: Sheet, chosen: { plan: string | null | undefined; removed: Set<string> }) {
  return {
    route: sheet.route,
    task: sheet.task,
    plan: chosen.plan === undefined ? (sheet.plan?.path ?? null) : chosen.plan,
    rules: sheet.practices.filter((r) => !chosen.removed.has(r.id)).map((r) => r.id),
  };
}
