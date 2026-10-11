import { render } from 'preact';
import { App } from './app';
import { load } from './words';
import './fab7.css';
import './app.css';
import './css/tree.css';
import './css/agent.css';
import './css/ask.css';
import './css/detail.css';
import './css/eval.css';
import './css/settings.css';
import './css/start.css';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
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
