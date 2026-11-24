// A machine's own settings (M9.8, M9.9, D9.8, D9.9), from Settings › Machines:
// General (its name, every project's Turbo, Start at login and Notifications, and
// how long ended sessions stay listed) and
// Workflow (who runs each step, Eval's judges). And a
// project's own settings (M9.12, D9.12), from its row's ⋯: what differs from
// every project's. Each is the machine's, changed there at once; every device
// is told.
import { useEffect, useRef, useState } from 'preact/hooks';
import type * as api from '../api';
import * as m from '../machine';
import { back, swap } from '../nav';
import { ENTRIES, type Entry, HOW_HARD, type HowHard, type JudgeEval, KEEP_KEY, KEYS, ROLES, at, differs, digitsOnly, effortChoices, howHard, judgesIn, keepDays, keepValue, machineName, machineSwitch, modelChoices, reachKey, shownValue, gitNoteOn } from '../settings';
import { fill, w } from '../words';
import { HarnessesTab, ProjectRingFrame, RingFrameTab, ringFrameAddable, useProjectRules, useSupported } from './RingFrameSettings';
import { Mark } from './Tree';
import { Coming, Saving } from './Wait';
import { DecisionsSection } from './Decisions';
import { SkipSection } from './Skip';

type Which = 'turbo' | 'login' | 'notify';
type Tab = 'general' | 'workflow' | 'ringframe' | 'harnesses';

/** The machine's rows, each a switch the cards draw. */
const ROWS: [Which, string, string][] = [
  ['turbo', 'desktop.menu.turbo', 'desktop.settings.turbo_what'],
  ['login', 'desktop.menu.login', 'web.machine.login_what'],
  ['notify', 'desktop.settings.notify', 'desktop.settings.notify_what'],
];

/** The project the machine answers for: any open one says its settings. */
function useSettings(project: string | undefined) {
  useEffect(() => {
    if (project) void m.askSettings(project);
  }, [project]);
  return project ? m.settings.value[project] : undefined;
}

/** The page's bar: on a desktop the mark and Back, on a phone Back and the title. */
function Bar({ wide, title, backTo }: { wide: boolean; title: string; backTo: string }) {
  return wide ? (
    <div class="appbar">
      <Mark />
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

/** What nothing set reads as for a judge's effort: its default by its value. */
function effortNone(judge: JudgeEval | undefined, role: string): string {
  const [key, effort] = effortChoices(judge, role).none;
  return effort ? fill(key, { effort }) : w(key);
}

/** A setting's control: a choice of harnesses, efforts or models, or a model typed and kept on Enter or leaving. A
 * judge's efforts and models are its harness's (`judge`). A project's own offers every project's value first, which
 * takes its own away. */
function Control({ e, value, project, scope, every, judge }: { e: Entry; value: string | undefined; project: string; scope: 'machine' | 'project'; every?: string; judge?: JudgeEval }) {
  const set = (v: string | null) => void m.setSetting(project, scope, e.key, v === '' ? null : v);
  const [typed, setTyped] = useState(value ?? '');
  useEffect(() => setTyped(value ?? ''), [value]);
  const id = `${scope}-${e.key.join('-')}`;
  const role = e.key[2] ?? '';
  const models = modelChoices(judge);
  if (e.kind === 'model' && models.typed) {
    const keep = () => typed.trim() !== (value ?? '') && set(typed.trim());
    return (
      <input id={id} class="settings-input" value={typed} placeholder={w('desktop.settings.own_model')}
        onInput={(ev) => setTyped((ev.target as HTMLInputElement).value)} onBlur={keep}
        onKeyDown={(ev) => ev.key === 'Enter' && (ev.target as HTMLInputElement).blur()} />
    );
  }
  if (e.kind === 'model' && models.models.length === 0) return <span class="settings-sub settings-session">{w('desktop.settings.own_model')}</span>;
  const none = every !== undefined ? fill('desktop.project.every', { value: every })
    : e.kind === 'effort' ? effortNone(judge, role) : w(shownValue(e, undefined, []));
  const options: [string, string][] =
    e.kind === 'effort' ? effortChoices(judge, role).efforts.map((x) => [x, x])
    : e.kind === 'model' ? models.models.map((x) => [x, x])
    : m.harnesses.value.filter((h) => h.project === project).map((h) => [h.harness, h.title]);
  return (
    <span class="settings-pick">
      <select id={id} class="settings-select" value={value ?? ''} onChange={(ev) => set((ev.target as HTMLSelectElement).value)}>
        <option value="">{none}</option>
        {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </span>
  );
}

export function MachineSettings({ machine, wide, tab }: { machine: api.Machine; wide: boolean; tab: Tab }) {
  const project = m.tree.value[0]?.project;
  const s = useSettings(project);
  const named = machineName(s, machine.name);
  const name = { machine: named };
  const tabs: [Tab, string][] = [
    ['general', 'desktop.settings.tab.general'],
    ['workflow', 'desktop.settings.tab.workflow'],
    ['ringframe', 'desktop.settings.tab.ringframe'],
    ['harnesses', 'desktop.settings.tab.harnesses'],
  ];
  return (
    <div class="app">
      <Bar wide={wide} title={named} backTo={w('web.settings.title')} />
      <div class={`settings settings--machine${tab === 'ringframe' || tab === 'harnesses' ? ' settings--rf' : ''}`}>
        {wide && <h1 class="settings-title">{fill('web.machine.title', name)}</h1>}
        <div class="settings-tabs" role="tablist">
          {tabs.map(([t, word]) => (
            <button key={t} class={`settings-tab${t === tab ? ' settings-tab--on' : ''}`} role="tab" aria-selected={t === tab} type="button"
              onClick={() => swap({ name: 'machine', machine: machine.id, tab: t })}>{w(word)}</button>
          ))}
        </div>
        <Saving />
        {!project ? (
          <p class="settings-sub">{fill('web.machine.no_project', name)}</p>
        ) : !s && (tab === 'general' || tab === 'workflow') ? (
          // Until the machine says its settings, none is shown as its default.
          <Coming />
        ) : tab === 'general' ? (
          <>
            <div class="fab7-group settings-group">{w('desktop.settings.this_machine')}</div>
            <MachineName project={project} listed={machine.name} />
            <div class="fab7-group settings-group">{w('desktop.settings.every_project')}</div>
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
            <KeepSessions project={project} />
            <div class="settings-foot">
              <p>{w('web.machine.foot')}</p>
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
            <Row e={ENTRIES[3]} s={s?.machine} project={project} scope="machine" />
            <Judges s={s?.machine} project={project} />
            <div class="settings-foot">
              <p class="settings-foot--wide">{w('desktop.settings.workflow_foot')}</p>
              <p class="settings-foot--phone">{w('web.workflow.foot')}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** A setting field that keeps what is typed: it says what applies on the machine, except while it is
 * typed in, when a change told by the machine waits until it is left. Left, or on Enter, `keep` gets what
 * the field holds then (a quick edit may not be drawn yet) and what applies, and sends it, or sends nothing
 * and the field says what applies again. Once a send is answered, the field says what applies, unless it
 * was typed in since. `only` keeps what may be typed in it. */
function useSettingField(applies: () => string, keep: (text: string, applies: string) => Promise<unknown> | undefined, only: (text: string) => string = (t) => t) {
  const said = applies();
  const [typed, setTyped] = useState(said);
  const editing = useRef(false);
  useEffect(() => void (editing.current || setTyped(said)), [said]);
  return {
    value: typed,
    onInput: (ev: Event) => {
      const input = ev.target as HTMLInputElement;
      const text = only(input.value);
      if (text !== input.value) input.value = text;
      setTyped(text);
    },
    onFocus: () => void (editing.current = true),
    onBlur: (ev: Event) => {
      editing.current = false;
      const text = (ev.target as HTMLInputElement).value;
      const sent = keep(text, applies());
      if (!sent) return setTyped(applies());
      void sent.then(() => setTyped((now) => (now === text ? applies() : now)));
    },
    onKeyDown: (ev: KeyboardEvent) => void (ev.key === 'Enter' && (ev.target as HTMLInputElement).blur()),
  };
}

/** The machine's name: what Weft and the person's devices call it, typed and kept on Enter or
 * leaving. Emptied, or the system's own again, it is the system's: the machine forgets it. */
function MachineName({ project, listed }: { project: string; listed: string }) {
  const field = useSettingField(
    () => machineName(m.settings.value[project], listed),
    (text, named) => {
      const name = text.trim();
      return name === named ? undefined : m.setSetting(project, 'machine', ['name'], name === '' ? null : name);
    },
  );
  return (
    <div class="settings-row settings-row--setting settings-machine-name">
      <label class="settings-text" for="machine-name">
        <span>{w('desktop.settings.name')}</span>
        <span class="settings-sub">{w('desktop.settings.name_what')}</span>
      </label>
      <input id="machine-name" class="settings-input" autocomplete="off" {...field} />
    </div>
  );
}

/** How many days an ended session stays listed, typed in digits only and kept on Enter or leaving.
 * Emptied, the machine's default applies again. */
function KeepSessions({ project }: { project: string }) {
  const field = useSettingField(
    () => String(keepDays(m.settings.value[project])),
    (text, days) => {
      const value = keepValue(text);
      return value === undefined || String(value) === days ? undefined : m.setSetting(project, 'machine', KEEP_KEY, value);
    },
    digitsOnly,
  );
  return (
    <div class="settings-row settings-row--setting settings-keep">
      <label class="settings-text" for="machine-keep-days">
        <span>{w('web.machine.keep_sessions')}</span>
        <span class="settings-sub">{w('web.machine.keep_sessions_what')}</span>
      </label>
      <span class="settings-days">
        <input id="machine-keep-days" class="settings-input" type="text" inputMode="numeric" pattern="[0-9]*" autocomplete="off" {...field} />
        <span class="settings-unit">{w('web.machine.days')}</span>
      </span>
    </div>
  );
}

/** The three judges' choice, what an effort changes in the harness they run
 * in, and each judge, closed until opened. */
function Judges({ s, project }: { s: Record<string, unknown> | null | undefined; project: string }) {
  const supported = useSupported(project);
  const [open, setOpen] = useState(false);
  const row = supported?.find((h) => h.harness === judgesIn(s));
  const judge = row?.eval ?? undefined;
  const hard = howHard(s);
  const choose = async (h: Exclude<HowHard, 'custom'>) => {
    for (const [role] of ROLES) await m.setSetting(project, 'machine', ['eval', 'debate', role, 'effort'], HOW_HARD[h]);
  };
  const choices: [Exclude<HowHard, 'custom'>, string][] = [['quick', 'desktop.settings.quick'], ['balanced', 'desktop.settings.balanced'], ['thorough', 'desktop.settings.thorough']];
  return (
    <>
      <div class="settings-row settings-row--setting settings-hard">
        <span class="settings-text"><span>{w('desktop.settings.how_hard')}</span></span>
        <span class="settings-seg" role="radiogroup" aria-label={w('desktop.settings.how_hard')}>
          {choices.map(([h, word]) => (
            <button key={h} type="button" role="radio" aria-checked={hard === h} class={hard === h ? 'settings-seg--on' : ''} onClick={() => void choose(h)}>{w(word)}</button>
          ))}
          {hard === 'custom' && <span class="settings-seg--on" role="radio" aria-checked>{w('desktop.settings.custom')}</span>}
        </span>
        <span class="settings-sub settings-reach">{fill(reachKey(judge), { harness: row?.title ?? '' })}</span>
      </div>
      <button class={`settings-row settings-judges${open ? ' settings-judges--open' : ''}`} type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span class="settings-text">{w('desktop.settings.each_judge')}</span>
        <span class="settings-sub">{open ? '⌄' : '›'}</span>
      </button>
      {open && ROLES.map(([role, , word]) => <RoleRow key={role} role={role} word={word} s={s} project={project} judge={judge} />)}
    </>
  );
}

/** A judge on one row: its model and its effort. On a phone the row says its
 * model under its name and its effort beside it, and opens both. */
function RoleRow({ role, word, s, project, judge }: { role: string; word: string; s: Record<string, unknown> | null | undefined; project: string; judge?: JudgeEval }) {
  const [open, setOpen] = useState(false);
  const [model, effort] = ['model', 'effort'].map((f) => ENTRIES.find((e) => e.key.join('.') === `eval.debate.${role}.${f}`) as Entry);
  const chosen = at(s, effort.key);
  return (
    <div class={`settings-row settings-row--setting settings-role${open ? ' settings-role--open' : ''}`}>
      <button class="settings-text settings-role-name" type="button" onClick={() => setOpen(!open)}>
        <span>{w(word)}</span>
        <span class="settings-sub settings-role-what">{w(`${word}_what`)}</span>
        <span class="settings-sub settings-role-model">{at(s, model.key) ?? w('desktop.settings.own_model')}</span>
      </button>
      <span class="settings-role-said">{chosen ?? effortNone(judge, role)}</span>
      <span class="settings-role-controls">
        <Control e={model} value={at(s, model.key)} project={project} scope="machine" judge={judge} />
        <Control e={effort} value={chosen} project={project} scope="machine" judge={judge} />
      </span>
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
      <Control e={e} value={at(s, e.key)} project={project} scope={scope} every={every} />
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
      <Bar wide={wide} title={fill('desktop.project.title', named)} backTo={project} />
      <div class="settings settings--machine settings--project">
        {wide && <h1 class="settings-title">{fill('desktop.project.title', named)}</h1>}
        <p class="settings-sub settings-differs">{w('desktop.project.differs')}</p>
        <Saving />
        {!s && <Coming />}
        {s && shown.length === 0 && <p class="settings-sub">{fill('desktop.project.none', named)}</p>}
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
        <DecisionsSection project={project} />
        <SkipSection project={project} />
        <GitNote project={project} on={gitNoteOn(s)} />
        <div class="settings-foot">
          <p class="settings-foot--wide">{fill('web.project.foot', { machine: machine.name })}</p>
          <p class="settings-foot--phone">{fill('web.project.foot_phone', { machine: machine.name })}</p>
        </div>
      </div>
    </div>
  );
}

/** A project's Git note of each Seal (17.19): off unless turned on here.
 * Turning it on asks once, showing what a note holds; off needs no dialog. */
function GitNote({ project, on }: { project: string; on: boolean }) {
  const [asking, setAsking] = useState(false);
  const name = project.split('/').pop() ?? project;
  const flip = () => (on ? void m.setSetting(project, 'project', ['export', 'git_note'], null) : setAsking(true));
  const turnOn = () => {
    setAsking(false);
    void m.setSetting(project, 'project', ['export', 'git_note'], true);
  };
  return (
    <>
      <div class="fab7-group settings-group">{w('export.section')}</div>
      <label for="project-git-note" class="settings-row">
        <span class="settings-text">
          <span>{w('export.git_note')}</span>
          <span class="settings-sub">{w('export.git_note_what')}</span>
        </span>
        <span class="switch">
          <input id="project-git-note" type="checkbox" checked={on} onChange={flip} class="switch-input" />
          <span class="switch-track" aria-hidden="true"><span class="switch-knob" /></span>
        </span>
      </label>
      <p class="settings-sub export-foot">{w('export.foot')}</p>
      {asking && (
        <div class="pending-bar export-bar" role="dialog" aria-label={w('dialog.export.title')}>
          <div class="pending-head"><span class="pending-what">{w('dialog.export.title')}</span></div>
          <span class="pending-why">{fill('dialog.export.why', { project: name })}</span>
          <pre class="pending-text">{w('dialog.export.sample')}</pre>
          <div class="pending-acts">
            <span class="spacer" />
            <button type="button" class="tree-act" onClick={() => setAsking(false)}>{w('act.cancel')}</button>
            <button type="button" class="tree-act tree-act--go" onClick={turnOn}>{w('dialog.export.go')}</button>
          </div>
        </div>
      )}
    </>
  );
}
