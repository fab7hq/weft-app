// Sign in (M1.3, D1.3): what Weft on the web is, and GitHub to sign in.
// Its words stay here: they show before the words are fetched.
import { Mark } from './Tree';

export function SignIn() {
  return (
    <div class="app">
      <div class="page">
        <div><Mark /></div>
        <p class="label">Weft on the web</p>
        <h1 class="signin-title">The agents on your working machine, from here.</h1>
        <p class="lede">See what each one is doing, answer the one that needs you, and get a push when you are away.</p>
        <a class="start-button start-button--go start-button--wide" href="/auth/github">Sign in with GitHub</a>
        <p class="note">GitHub says who you are. Your machine says which devices get in.</p>
        <div><a class="start-link" href="/privacy">What Fab7 keeps</a></div>
      </div>
    </div>
  );
}
