export function SignIn() {
  return (
    <div class="app">
      <div class="page" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/icons/weft-mark.svg" alt="" width={28} height={28} />
          <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '1px', color: 'var(--fab7-teal)' }}>WEFT</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p class="label" style={{ margin: 0, color: 'var(--fab7-accent)' }}>Weft on the web</p>
          <h1 style={{ margin: 0, fontSize: '40px', lineHeight: 1.1, fontWeight: 550, letterSpacing: '-0.045em' }}>
            The agents on your working machine, from here.
          </h1>
          <p class="lede">See what each one is doing, answer the one that needs you, and get a push when you are away.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <a class="fab7-button" href="/auth/github" style={{ textDecoration: 'none', minHeight: '52px', fontSize: '15px' }}>
            Sign in with GitHub
          </a>
          <p class="note">
            GitHub says who you are. Your machine says which devices get in. <a href="/privacy">What Fab7 keeps</a>
          </p>
        </div>
      </div>
    </div>
  );
}
