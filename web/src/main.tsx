import { render } from 'preact';
import { App } from './app';
import './fab7.css';
import './app.css';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
// The app fits what is visible above the on-screen keyboard, so the key bar
// and the message row sit on top of it (web-app.md §6).
const fit = () => {
  if (window.visualViewport) document.documentElement.style.setProperty('--app-height', `${window.visualViewport.height}px`);
};
window.visualViewport?.addEventListener('resize', fit);
fit();

render(<App />, document.getElementById('app')!);
