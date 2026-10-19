// A machine's own settings (M9.8, M9.9, D9.8, D9.9), from Settings › Machines:
// General (every project's Turbo, Start at login, Notifications and
// Suggestions) and Workflow (who does each act, the Eval debate). And a
// project's own settings (M9.12, D9.12), from its row's ⋯: what differs from
// every project's. Each is the machine's, changed there at once; every device
// is told.
import { useEffect, useState } from 'preact/hooks';
import type * as api from '../api';
import * as m from '../machine';
import { back, swap } from '../nav';
import { EFFORTS, ENTRIES, type Entry, KEYS, at, differs, machineSwitch, shownValue } from '../settings';
import { fill, w } from '../words';
import { HarnessesTab, ProjectRingFrame, RingFrameTab, ringFrameAddable, useProjectRules } from './RingFrameSettings';
import { Mark } from './Tree';

type Which = 'turbo' | 'login' | 'notify' | 'suggest';
type Tab = 'general' | 'workflow' | 'ringframe' | 'harnesses';

/** The machine's rows, each a switch the cards draw. */
const ROWS: [Which, string, string][] = [
  ['turbo', 'desktop.menu.turbo', 'desktop.settings.turbo_what'],
  ['login', 'desktop.menu.login', 'web.machine.login_what'],
  ['notify', 'desktop.settings.notify', 'web.machine.notify_what'],
  ['suggest', 'desktop.settings.suggest', 'web.machine.suggest_what'],
];

/** The project the machine answers for: any open one says its settings. */
function useSettings(project: string | undefined) {
  useEffect(() => {
    if (project) void m.askSettings(project);
  }, [project]);
  return project ? m.settings.value[project] : undefined;
}

/** The page's bar: on a desktop the machine and Back, on a phone Back and the title. */
function Bar({ wide, machine, title, backTo }: { wide: boolean; machine: string; title: string; backTo: string }) {
  return wide ? (
    <div class="appbar">
      <Mark />
      <span class="settings-machine">{machine}</span>
      <span class="spacer" />
      <button class="back" type="button" onClick={back}>{`‹ ${w('web.settings.back')}`}</button>
    </div>
  ) : (
    <div class="appbar">
      <button class="back" type="button" onClick={back}>{`‹ ${backTo}`}</button>
      <h1>{title}</h1>
    </div>
  );
}

function label(e: Entry): string {
  return e.role ? fill(e.label, { role: w(e.role) }) : w(e.label);
}

/** A setting's control: a choice of harnesses or efforts, or a model typed and kept on Enter or leaving. */
function Control({ e, value, project, scope }: { e: Entry; value: string | undefined; project: string; scope: 'machine' | 'project' }) {
  const set = (v: string | null) => void m.setSetting(project, scope, e.key, v === '' ? null : v);
  const [typed, setTyped] = useState(value ?? '');
  useEffect(() => setTyped(value ?? ''), [value]);
  const id = `${scope}-${e.key.join('-')}`;
  if (e.kind === 'model') {
    const keep = () => typed.trim() !== (value ?? '') && set(typed.trim());
    return (
      <input id={id} class="settings-input" value={typed} placeholder={w('desktop.settings.own_model')}
        onInput={(ev) => setTyped((ev.target as HTMLInputElement).value)} onBlur={keep}
        onKeyDown={(ev) => ev.key === 'Enter' && (ev.target as HTMLInputElement).blur()} />
    );
  }
  const none = w(shownValue(e, undefined, []));
  const options: [string, string][] =
    e.kind === 'effort' ? EFFORTS.map((x) => [x, x])
    : m.harnesses.value.filter((h) => h.project === project).map((h) => [h.harness, h.title]);
  return (
    <select id={id} class="settings-select" value={value ?? ''} onChange={(ev) => set((ev.target as HTMLSelectElement).value)}>
      <option value="">{none}</option>
      {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
    </select>
  );
}

export function MachineSettings({ machine, wide, tab }: { machine: api.Machine; wide: boolean; tab: Tab }) {
  const project = m.tree.value[0]?.project;
  const s = useSettings(project);
  const name = { machine: machine.name };
  const tabs: [Tab, string][] = [
    ['general', 'desktop.settings.tab.general'],
    ['workflow', 'desktop.settings.tab.workflow'],
    ['ringframe', 'desktop.settings.tab.ringframe'],
    ['harnesses', 'desktop.settings.tab.harnesses'],
  ];
  return (
    <div class="app">
      <Bar wide={wide} machine={machine.name} title={machine.name} backTo={w('web.settings.title')} />
      <div class="settings">
        {wide && <h1 class="settings-title">{fill('web.machine.title', name)}</h1>}
        <div class="settings-tabs" role="tablist">
          {tabs.map(([t, word]) => (
            <button key={t} class={`settings-tab${t === tab ? ' settings-tab--on' : ''}`} role="tab" aria-selected={t === tab} type="button"
              onClick={() => swap({ name: 'machine', machine: machine.id, tab: t })}>{w(word)}</button>
          ))}
        </div>
        {!project ? (
          <p class="settings-sub">{fill('web.machine.no_project', name)}</p>
        ) : tab === 'general' ? (
          <>
            <div class="fab7-group settings-group">{fill('web.machine.every_project', name)}</div>
            {ROWS.map(([which, word, what]) => {
              const on = machineSwitch(s, which);
              const id = `machine-${which}`;
              return (
                <label key={which} for={id} class="settings-row">
                  <span class="settings-text">
                    <span>{w(word)}</span>
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
        ) : tab === 'ringframe' ? (
          <RingFrameTab project={project} />
        ) : tab === 'harnesses' ? (
          <HarnessesTab project={project} />
        ) : (
          <>
            <div class="fab7-group settings-group">{w('desktop.settings.acts')}</div>
            {ENTRIES.slice(0, 3).map((e) => <Row key={e.name} e={e} s={s?.machine} project={project} scope="machine" />)}
            <div class="fab7-group settings-group">{w('desktop.settings.debate')}</div>
            {ENTRIES.slice(3).map((e) => <Row key={e.name} e={e} s={s?.machine} project={project} scope="machine" />)}
          </>
        )}
      </div>
    </div>
  );
}

/** One setting's row: its name and what it does, and its control; a project's own also says every project's and Reset. */
function Row({ e, s, project, scope, every }: { e: Entry; s: Record<string, unknown> | null | undefined; project: string; scope: 'machine' | 'project'; every?: string }) {
  return (
    <div class="settings-row settings-row--setting">
      <label class="settings-text" for={`${scope}-${e.key.join('-')}`}>
        <span>{label(e)}</span>
        {every !== undefined ? (
          <span class="settings-sub">{fill('desktop.project.every', { value: every })}</span>
        ) : (
          e.what && <span class="settings-sub">{w(e.what)}</span>
        )}
      </label>
      <Control e={e} value={at(s, e.key)} project={project} scope={scope} />
      {scope === 'project' && (
        <button class="settings-reset" type="button" onClick={() => void m.setSetting(project, 'project', e.key, null)}>{w('act.reset')}</button>
      )}
    </div>
  );
}

export function ProjectSettings({ machine, project, wide }: { machine: api.Machine; project: string; wide: boolean }) {
  const s = useSettings(project);
  const titles = m.harnesses.value.filter((h) => h.project === project);
  const [adding, setAdding] = useState<string | null>(null);
  const rules = useProjectRules(project);
  const shown = [...differs(s), ...ENTRIES.filter((e) => e.name === adding && at(s?.project, e.key) === undefined)];
  const addable = ENTRIES.filter((e) => !shown.includes(e));
  const named = { project };
  return (
    <div class="app">
      <Bar wide={wide} machine={machine.name} title={fill('desktop.project.title', named)} backTo={project} />
      <div class="settings">
        {wide && <h1 class="settings-title">{fill('desktop.project.title', named)}</h1>}
        <p class="settings-sub settings-differs">{w('desktop.project.differs')}</p>
        {shown.length === 0 && <p class="settings-sub">{fill('desktop.project.none', named)}</p>}
        {shown.map((e) => {
          const every = at(s?.machine, e.key);
          const said = shownValue(e, every, titles);
          return <Row key={e.name} e={e} s={s?.project} project={project} scope="project" every={every === undefined ? w(said) : said} />;
        })}
        <ProjectRingFrame project={project} rules={rules} adding={adding?.startsWith('ringframe:') ? adding.slice('ringframe:'.length) : null} done={() => setAdding(null)} />
        <select class="settings-select settings-add" value="" onChange={(ev) => setAdding((ev.target as HTMLSelectElement).value || null)}>
          <option value="">{w('desktop.project.add')}</option>
          {addable.map((e) => <option key={e.name} value={e.name}>{label(e)}</option>)}
          {ringFrameAddable(project, rules).map(([v, words]) => <option key={v} value={v}>{words}</option>)}
        </select>
        <div class="settings-foot">
          <p>{fill('web.project.foot', { machine: machine.name })}</p>
        </div>
      </div>
    </div>
  );
}
