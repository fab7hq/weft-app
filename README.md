# weft-app

Weft on the web, at [weft.getfab7.com](https://weft.getfab7.com): the same
tree, agents and words as Weft's terminal on your own machine. Answer the agent
that needs you, ask, eval and seal, read a work's Details and its Eval view,
start an agent, and get a push when you are away, from a phone, a tablet or a
browser.

## What is here

One Cloudflare Worker:

- `web/`: the web app, served as static files.
- `worker/`: a small API for GitHub sign-in, your machines and their current
  addresses. No screen, keystroke or push passes through it; those go
  between your device and your machine.

`web/public/words.json` holds the words the app shares with Weft. It is
copied from a weft checkout with `npm run words` (`WEFT=<checkout>`, `../weft`
by default). The Worker serves it with `Cache-Control: no-cache` and the
service worker never caches it, so a replaced file shows on the next reload.

## Use

Turn Remote on in Weft (`W`, then `R`), then open the app and sign in with
GitHub. Each device is allowed on the machine first.

## Docs

[Weft on your phone](https://docs.getfab7.com/weft/phone) covers turning it on,
signing in, allowing a device, and notifications.

## Development

```sh
npm ci
npm run dev        # wrangler dev
npm test           # vitest
npm run typecheck
npm run build
npm run e2e        # Playwright: phone, tablet and desktop
npm run gallery    # the screens' images, to compare with the design cards
```

## Releases

The app speaks version 1 of Weft's remote protocol, as Weft 0.2.0 does, and
ships together with the `weft` that speaks it. Weft itself is at
[fab7hq/weft](https://github.com/fab7hq/weft).

## License

Apache-2.0. Part of [Fab7](https://getfab7.com).
