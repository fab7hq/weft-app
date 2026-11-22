// What the desktop's viewer window is opened with, in its address's hash:
// the file's URL (`u`), its path, kind, size, when it changed, the agent and
// the project.
import { kindOf } from './kinds';
import type { Served } from './factory';

export interface Opening {
  file: Served;
  agent: string;
  project: string;
}

export function openingOf(hash: string): Opening {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const num = (k: string) => {
    const n = Number(p.get(k));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  return {
    file: { url: p.get('u') ?? '', path: p.get('path') ?? '', kind: kindOf(p.get('kind')), size: num('size'), modified: num('modified') },
    agent: p.get('agent') ?? '',
    project: p.get('project') ?? '',
  };
}
