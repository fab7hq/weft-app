// The Ask sheet's draft: what the machine offers for the words and the
// harness, and what the person keeps of it. Nothing is sent until Ask.

export interface Rule { id: string; label: string; text: string; family: string | null; layer: string }
export interface Plan { slug: string; path: string; title: string }
export interface Sheet {
  /** No route when the machine could not pick one: the person picks. */
  routes: string[]; route: string | null; tasks: string[]; task: string;
  plan: Plan | null; plans: Plan[]; practices: Rule[]; route_rules: Rule[];
  /** The practices proposed for these words; none sent, every one is kept. */
  proposed?: string[] | null;
  /** Whether the machine reads the words to fill the sheet. */
  senses?: boolean;
}

/** A practice the person put in (true) or took out (false), by id. */
export type Picked = Map<string, boolean>;

/** A route as the sheet names it: `native_goal` is "Goal", `human_handoff` "Human handoff". */
export function routeLabel(id: string): string {
  const words = id.replace(/^native_/, '').replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** How many practices show before "+ N more". */
export const SHOWN = 3;

/** Whether a practice is kept: the person's pick, else whether it was proposed. */
export function isIn(sheet: Sheet, picked: Picked, id: string): boolean {
  return picked.get(id) ?? (sheet.proposed ? sheet.proposed.includes(id) : true);
}

/** The practices kept, the first few unless all are shown. */
export function shownRules(sheet: Sheet, picked: Picked, all: boolean): Rule[] {
  const kept = sheet.practices.filter((r) => isIn(sheet, picked, r.id));
  return all ? kept : kept.slice(0, SHOWN);
}

/** What "+ N more" holds: the kept ones not shown, and those to add. */
export function moreCount(sheet: Sheet, picked: Picked, all: boolean): number {
  return sheet.practices.length - shownRules(sheet, picked, all).length;
}

/** Whether Ask may be sent: not while the sheet waits for the person's route. */
export function canAsk(sheet: Sheet | null): boolean {
  return !sheet || sheet.route !== null;
}

/** Whether the sheet shows the machine reading the words: it does read them,
 * there are words, and the sheet shown is for others. The person picks once
 * Sense has answered, or failed to. */
export function sensing(sheet: Sheet | null, sheetFor: string | null, text: string): boolean {
  return !!sheet?.senses && text.trim() !== '' && sheetFor !== text;
}

/** How long the words rest before they are read, in ms: Sense waits for the
 * person to stop typing. No words are read at once. */
export function askPause(words: string): number {
  return words.trim() ? 1500 : 0;
}

/** What Ask sends: the route and task, the plan (the one offered unless the person
 * picked another or none), and every practice kept. */
export function draftOf(sheet: Sheet, chosen: { plan: string | null | undefined; picked: Picked }) {
  return {
    route: sheet.route,
    task: sheet.task,
    plan: chosen.plan === undefined ? (sheet.plan?.path ?? null) : chosen.plan,
    rules: sheet.practices.filter((r) => isIn(sheet, chosen.picked, r.id)).map((r) => r.id),
  };
}
