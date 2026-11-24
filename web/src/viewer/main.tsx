// The desktop's viewer, in an agent's pane beside its conversation: the same
// viewer in the desktop's layout, its buttons said to the desktop.
import { render } from 'preact';
import { load } from '../words';
import { desktopHost } from './host';
import { nameOf } from './kinds';
import { openingOf } from './page';
import { Viewer } from './Viewer';
import '../tokens.css';
import '../fab7.css';
import '../app.css';
import '../css/conversation.css';
import '../css/wait.css';
import '../css/viewer.css';

const { file, agent, project } = openingOf(location.hash);
document.title = [nameOf(file.path), project].filter(Boolean).join(' — ');
const host = desktopHost();

void load('words.json').then(() => render(<Viewer file={file} named={file} who={agent} layout="desktop" host={host} />, document.getElementById('viewer')!));
