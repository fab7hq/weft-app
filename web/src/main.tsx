import { render } from 'preact';
import { App } from './app';
import { load } from './words';
import './tokens.css';
import './fab7.css';
import './app.css';
import './css/tree.css';
import './css/agent.css';
import './css/conversation.css';
import './css/ask.css';
import './css/detail.css';
import './css/eval.css';
import './css/settings.css';
import './css/start.css';
import './css/wait.css';
import './css/skip.css';
import './css/viewer.css';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
// A page loaded before a deploy asks for code the deploy replaced, a file's
// renderer among it: the page is loaded again, once, and takes the new build.
// Within seconds of that, the failure stands and the file says it can't be shown.
addEventListener('vite:preloadError', (e) => {
  try {
    const at = Number(sessionStorage.getItem('weft-reloaded') ?? 0);
    if (Date.now() - at < 10_000) return;
    sessionStorage.setItem('weft-reloaded', String(Date.now()));
  } catch {
    return;
  }
  e.preventDefault();
  location.reload();
});
// The app fits what is visible above the on-screen keyboard, so the key bar
// and the message row sit on top of it (web-app.md §6). Safari keeps the page
// its full height under the keyboard and scrolls what is visible down to the
// box that took the focus: the app follows what is visible, where it is.
const fit = () => {
  const view = window.visualViewport;
  if (!view) return;
  const root = document.documentElement;
  root.style.setProperty('--app-height', `${view.height}px`);
  root.style.setProperty('--app-top', `${view.offsetTop}px`);
  // The keyboard is up: nothing under the app needs the home bar's room.
  root.toggleAttribute('data-keyboard', window.innerHeight - view.height > 120);
};
window.visualViewport?.addEventListener('resize', fit);
window.visualViewport?.addEventListener('scroll', fit);
fit();

// The shared words come first: no screen is drawn without them.
void load().then(() => render(<App />, document.getElementById('app')!));
