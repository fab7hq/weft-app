# weft-app

Weft on the web, at [weft.getfab7.com](https://weft.getfab7.com): the same
tree, agents and words as Weft in your terminal. Answer an agent, Ask, Eval and
Seal, start or resume an agent, and get a push when you are away, from a phone,
a tablet or a browser.

Turn it on in Weft (`W`, then `R`), then sign in with GitHub. Setup is in
[Weft on your phone](https://docs.getfab7.com/weft/phone).

## What is here

- `web/`: the web app, static files. `web/public/words.json` is copied from
  Weft with `npm run words`.
- `worker/`: a small Cloudflare Worker for GitHub sign-in and your machines'
  addresses. No screen, keystroke or push passes through it.

## Development

```sh
npm ci
npm run dev        # wrangler dev
npm test
npm run e2e        # Playwright
```

## Releases

Ships together with the `weft` that speaks its protocol; this one is Weft 0.2.0.

## License

Apache-2.0. Part of [Fab7](https://getfab7.com).
