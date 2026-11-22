// What the viewer's buttons do, wherever it runs. In the web app Close goes
// back to the conversation and there is no Reveal; in the desktop's window
// both are said to the desktop over the WebView's IPC.

export interface Host {
  close(): void;
  /** Show the file in the system's file manager; absent where there is none to show it in. */
  reveal?: () => void;
}

/** The WebView's channel to the desktop, when there is one. */
interface Ipc {
  postMessage(message: string): void;
}

/** The desktop's host: each act said as `{"act": …}`. Opened in a plain browser, Close closes the tab. */
export function desktopHost(win: { ipc?: Ipc; close(): void } = window as unknown as { ipc?: Ipc; close(): void }): Host {
  const ipc = win.ipc;
  if (typeof ipc?.postMessage !== 'function') return { close: () => win.close() };
  const say = (act: 'reveal' | 'close') => ipc.postMessage(JSON.stringify({ act }));
  return { close: () => say('close'), reveal: () => say('reveal') };
}
