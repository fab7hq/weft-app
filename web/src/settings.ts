// A machine's own settings, as it last said them (remote.md §6): what each of
// Settings' switches shows. Nothing here is kept: the machine is asked again.

/** What `settings` carries: config.get's answer for one project. */
export interface Settings {
  machine: Record<string, unknown>;
  project: Record<string, unknown> | null;
  effective: Record<string, unknown>;
}

/** A machine switch: Turbo and Start at login are off until turned on;
 * Notifications and Suggestions are on until turned off. */
export function machineSwitch(s: Settings | undefined, which: 'turbo' | 'login' | 'notify' | 'suggest'): boolean {
  const m = s?.machine ?? {};
  switch (which) {
    case 'turbo':
      return m.turbo === true;
    case 'login':
      return (m.service as { start_at_login?: unknown } | undefined)?.start_at_login === true;
    case 'notify':
    case 'suggest':
      return m[which] !== false;
  }
}

/** Where each switch is kept in the machine's settings. */
export const KEYS: Record<'turbo' | 'login' | 'notify' | 'suggest', string[]> = {
  turbo: ['turbo'],
  login: ['service', 'start_at_login'],
  notify: ['notify'],
  suggest: ['suggest'],
};

/** What a Workflow setting takes. */
export type Kind = 'act' | 'debate' | 'effort' | 'model';

/** One setting Workflow holds, which a project can also set for itself. */
export interface Entry {
  key: string[];
  /** Its name, as the desktop's layers name it. */
  name: string;
  /** Its words: a key, filled with `role` for a role's model and effort. */
  label: string;
  role?: string;
  what?: string;
  kind: Kind;
}

export const ROLES: [string, string, string][] = [
  ['map', 'Map', 'desktop.settings.map'],
  ['reduce', 'Reduce', 'desktop.settings.reduce'],
  ['confirm', 'Confirm', 'desktop.settings.confirm'],
];

/** Every setting Workflow holds, in its order. Turbo is every project's only. */
export const ENTRIES: Entry[] = [
  { key: ['routing', 'ask'], name: 'Ask', label: 'act.ask', what: 'desktop.settings.ask_what', kind: 'act' },
  { key: ['routing', 'eval'], name: 'Eval', label: 'act.eval', what: 'desktop.settings.eval_what', kind: 'act' },
  { key: ['routing', 'seal'], name: 'Seal', label: 'act.seal', what: 'desktop.settings.seal_what', kind: 'act' },
  { key: ['eval', 'debate', 'harness'], name: 'Runs in', label: 'desktop.settings.runs_in', what: 'desktop.settings.runs_in_what', kind: 'debate' },
  ...ROLES.flatMap(([role, name, word]): Entry[] => [
    { key: ['eval', 'debate', role, 'model'], name: `${name} model`, label: 'desktop.settings.model', role: word, kind: 'model' },
    { key: ['eval', 'debate', role, 'effort'], name: `${name} effort`, label: 'desktop.settings.effort', role: word, kind: 'effort' },
  ]),
];

/** The efforts a role can take; nothing set is the harness's own. */
export const EFFORTS = ['low', 'medium', 'high', 'xhigh'];

/** The value at `key` in a settings table, if it holds one. */
export function at(table: Record<string, unknown> | null | undefined, key: string[]): string | undefined {
  let v: unknown = table;
  for (const k of key) v = v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined;
  return typeof v === 'string' ? v : undefined;
}

/** What a value reads as: a harness by its title; nothing set, by the words
 * for what then applies (a key of the words table). */
export function shownValue(e: Entry, v: string | undefined, titles: { harness: string; title: string }[]): string {
  if (v === undefined) {
    return { act: 'desktop.settings.agent_you_are_in', debate: 'desktop.settings.where_eval_runs', effort: 'desktop.settings.own_effort', model: 'desktop.settings.own_model' }[e.kind];
  }
  if (e.kind === 'act' || e.kind === 'debate') return titles.find((t) => t.harness === v)?.title ?? v;
  return v;
}

/** What a project sets for itself, in Workflow's order. */
export function differs(s: Settings | undefined): Entry[] {
  return ENTRIES.filter((e) => at(s?.project, e.key) !== undefined);
}

type Rule = Record<string, unknown> & { id: string };

/** A rule's field set (or taken out with null) in the list that holds the
 * layer's rules; a rule's id and nothing else is taken out; null when the
 * list is empty. A rule of the person's own gets what RingFrame needs. */
export function withRule(list: unknown, id: string, field: string | null, value: unknown): Rule[] | null {
  const rules: Rule[] = Array.isArray(list) ? list.map((r) => ({ ...(r as Rule) })) : [];
  let at = rules.findIndex((r) => r.id === id);
  if (field === null) {
    if (at >= 0) rules.splice(at, 1);
  } else {
    if (at < 0) at = rules.push({ id }) - 1;
    if (value === null) delete rules[at][field];
    else rules[at][field] = value;
    if (id.startsWith('own.')) {
      rules[at].applies_to ??= ['implement'];
      rules[at].tier ??= 'situational';
    }
    if (Object.keys(rules[at]).length === 1) rules.splice(at, 1);
  }
  return rules.length ? rules : null;
}

/** What judges must not do, a line added (`+`) or one taken out by its place;
 * emptied, the list denies nothing and stays. */
export function withDeny(list: unknown, which: '+' | number, value: string | null): string[] {
  const lines = Array.isArray(list) ? (list as string[]).slice() : [];
  if (which === '+' && value) lines.push(value);
  else if (typeof which === 'number') lines.splice(which, 1);
  return lines;
}

/** A practice's id as words: `autonomous-trading` is "Autonomous trading". */
export function domainName(id: string): string {
  const words = id.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
