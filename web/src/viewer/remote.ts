// The web app's link to a file: the machine is asked over the connection to
// open it, and answers with a private link on its own address that serves
// that one file for a few minutes.
import * as m from '../machine';
import { linkOfAnswer, type Opened } from './link';

export type { Opened } from './link';

export async function openLink(agent: string, path: string): Promise<Opened> {
  const asked = m.request({ type: 'read', what: 'file', agent, path });
  return linkOfAnswer(asked ? await asked : null, m.reachedAt());
}
