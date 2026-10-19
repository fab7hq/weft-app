// A machine's own settings (M9.8, D9.8), from Settings › Machines: every
// project's Turbo, Start at login, Notifications and Suggestions. Each is
// the machine's, changed there at once; every device is told.
import { useEffect } from 'preact/hooks';
import type * as api from '../api';
import * as m from '../machine';
import { back } from '../nav';
import { KEYS, machineSwitch } from '../settings';
import { fill, w } from '../words';
import { Mark } from './Tree';

type Which = 'turbo' | 'login' | 'notify' | 'suggest';

/** The machine's rows, each a switch the cards draw. */
const ROWS: [Which, string, string][] = [
  ['turbo', 'desktop.menu.turbo', 'desktop.settings.turbo_what'],
  ['login', 'desktop.menu.login', 'web.machine.login_what'],
  ['notify', 'desktop.settings.notify', 'web.machine.notify_what'],
  ['suggest', 'desktop.settings.suggest', 'web.machine.suggest_what'],
];

export function MachineSettings({ machine, wide }: { machine: api.Machine; wide: boolean }) {
  // The machine answers for a project it has open: any one says its settings.
  const project = m.tree.value[0]?.project;
  useEffect(() => {
    if (project) void m.askSettings(project);
  }, [project]);
  const s = project ? m.settings.value[project] : undefined;
  const name = { machine: machine.name };
  return (
    <div class="app">
      {wide ? (
        <div class="appbar">
          <Mark />
          <span class="settings-machine">{machine.name}</span>
          <span class="spacer" />
          <button class="back" type="button" onClick={back}>{`‹ ${w('web.settings.back')}`}</button>
        </div>
      ) : (
        <div class="appbar">
          <button class="back" type="button" onClick={back}>{`‹ ${w('web.settings.title')}`}</button>
          <h1>{machine.name}</h1>
        </div>
      )}
      <div class="settings">
        {wide && <h1 class="settings-title">{fill('web.machine.title', name)}</h1>}
        <div class="settings-tabs" role="tablist">
          <button class="settings-tab settings-tab--on" role="tab" aria-selected="true" type="button">{w('desktop.settings.tab.general')}</button>
        </div>
        {!project ? (
          <p class="settings-sub">{fill('web.machine.no_project', name)}</p>
        ) : (
          <>
            <div class="fab7-group settings-group">{fill('web.machine.every_project', name)}</div>
            {ROWS.map(([which, label, what]) => {
              const on = machineSwitch(s, which);
              const id = `machine-${which}`;
              return (
                <label key={which} for={id} class="settings-row">
                  <span class="settings-text">
                    <span>{w(label)}</span>
                    <span class="settings-sub">{fill(what, name)}</span>
                  </span>
                  <span class={`switch${which === 'turbo' ? ' switch--turbo' : ''}`}>
                    <input id={id} type="checkbox" checked={on} onChange={() => void m.setSetting(project, 'machine', KEYS[which], !on)} class="switch-input" />
                    <span class="switch-track" aria-hidden="true">
                      <span class="switch-knob" />
                    </span>
                  </span>
                </label>
              );
            })}
            <div class="settings-foot">
              <p>{fill('web.machine.foot', name)}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
