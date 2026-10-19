// A machine's switches, as its settings say them.
import { describe, expect, it } from 'vitest';
import { KEYS, machineSwitch, type Settings } from '../src/settings';

const said = (machine: Record<string, unknown>): Settings => ({ machine, project: null, effective: {} });

describe('a machine switch', () => {
  it('is Turbo and Start at login off, and Notifications and Suggestions on, until set', () => {
    for (const s of [undefined, said({})]) {
      expect(machineSwitch(s, 'turbo')).toBe(false);
      expect(machineSwitch(s, 'login')).toBe(false);
      expect(machineSwitch(s, 'notify')).toBe(true);
      expect(machineSwitch(s, 'suggest')).toBe(true);
    }
  });

  it('is what the machine says once it says it', () => {
    const s = said({ turbo: true, notify: false, suggest: false, service: { start_at_login: true } });
    expect(machineSwitch(s, 'turbo')).toBe(true);
    expect(machineSwitch(s, 'login')).toBe(true);
    expect(machineSwitch(s, 'notify')).toBe(false);
    expect(machineSwitch(s, 'suggest')).toBe(false);
  });

  it('is kept where the desktop keeps it', () => {
    expect(KEYS.login).toEqual(['service', 'start_at_login']);
    expect(KEYS.turbo).toEqual(['turbo']);
  });
});
