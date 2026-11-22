// A file an agent pointed at, over its conversation on every size: the
// viewer, its file served by the machine at a private link made when it is
// opened. Close goes back to the conversation; nothing of the file is kept.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as m from '../machine';
import { back } from '../nav';
import { Viewer } from '../viewer/Viewer';
import type { Ref } from '../viewer/kinds';
import { openLink, type Opened } from '../viewer/remote';

/** A link lapses after ten minutes; one older than this is asked for again before the file is said to be gone. */
const FRESH = 9 * 60_000;

export function FileSheet({ agent, fileRef }: { agent: string; fileRef: Ref }) {
  const harness = m.agents.value.find((x) => x.agent === agent)?.harness ?? '';
  const connected = m.link.value === 'connected';
  // Null while it is asked for; one cut off by the connection is asked again once connected.
  const [opened, setOpened] = useState<Opened | null>(null);
  const [tries, setTries] = useState(0);
  const made = useRef(0);

  useEffect(() => {
    if (!connected) return;
    let gone = false;
    setOpened(null);
    void openLink(agent, fileRef.path).then((o) => {
      if (gone) return;
      made.current = Date.now();
      setOpened(o);
    });
    return () => void (gone = true);
  }, [agent, fileRef.path, connected, tries]);

  const again = () => setTries((n) => n + 1);
  const host = useMemo(() => ({ close: back }), []);
  const file = opened && 'file' in opened ? opened.file : null;
  const refused = opened && 'refused' in opened ? opened.refused : null;
  const failed = opened && ('failed' in opened || (refused === 'lost' && connected)) ? again : null;
  // An old link answering 404 is asked for again: the machine says whether the file is gone.
  const lapsed = () => (Date.now() - made.current > FRESH ? again() : setOpened({ refused: 'no_file' }));

  return <Viewer file={file} named={fileRef} who={harness} layout="phone" host={host} gone={refused === 'no_file'} failed={failed} lapsed={lapsed} />;
}
