import { go } from '../nav';

export function AddMachine({ login }: { login: string }) {
  const steps: [string, string][] = [
    ['W', 'Press W in Weft for its menu.'],
    ['R', 'Press R for Remote, then Enter to turn it on.'],
    ['⏎', 'Enter the code it shows at github.com/login/device.'],
  ];
  return (
    <div class="app">
      <div class="appbar">
        <h1>Your machines</h1>
        <span class="spacer" />
        <button class="back" type="button" onClick={() => go({ name: 'settings' })}>Settings</button>
      </div>
      <div class="page">
        <p class="label" style={{ margin: 0 }}>Signed in as {login}</p>
        <h2>Add a machine</h2>
        <p class="lede">No machine is on your account yet. On the machine where Weft runs:</p>
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {steps.map(([key, text]) => (
            <li key={key} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <span class="fab7-key" style={{ minWidth: '36px', height: '36px', cursor: 'default' }} aria-hidden="true">{key}</span>
              <span style={{ paddingTop: '7px', fontSize: '15px', lineHeight: 1.6 }}>{text}</span>
            </li>
          ))}
        </ol>
        <p class="note" style={{ marginTop: 'auto' }}>Your machine appears here as soon as it joins.</p>
      </div>
    </div>
  );
}
