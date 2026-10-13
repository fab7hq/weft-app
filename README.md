# weft-app

Weft on the web, at [weft.getfab7.com](https://weft.getfab7.com): the same
tree, agents and words as Weft in your terminal, from a phone, a tablet or a
browser. It has no model and no agent of its own.

## What is here

- `web/`: the web app, static files. `web/public/words.json` is copied from
  Weft with `npm run words`.
- `worker/`: a small Cloudflare Worker for GitHub sign-in and your machines'
  addresses. No screen, keystroke or push passes through it.

Works with the agents Weft runs: Claude Code, Codex and Antigravity.

## Use

In Weft, press `W`, then `R` to turn on Remote. Then open
[weft.getfab7.com](https://weft.getfab7.com) and sign in with GitHub. Answer an
agent, Ask, Eval and Seal, start or resume an agent, and get a push when you are
away.

## Docs

Setup and notifications: [Weft on your phone](https://docs.getfab7.com/weft/phone).

## Development

```sh
npm ci
npm run dev        # wrangler dev
npm test
npm run e2e        # Playwright
```

## Releases

Tagged `vX.Y.Z` and shipped with the `weft` that speaks its protocol: this one
is Weft 0.4.1. [Releases](https://github.com/fab7hq/weft/releases).

## License

Apache-2.0. Part of [Fab7](https://getfab7.com).
