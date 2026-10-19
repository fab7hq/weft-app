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
