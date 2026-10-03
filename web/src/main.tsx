import { render } from 'preact';
import { App } from './app';
import './fab7.css';
import './app.css';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
render(<App />, document.getElementById('app')!);
