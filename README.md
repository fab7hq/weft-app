# weft-app

Weft on the web, at [weft.getfab7.com](https://weft.getfab7.com): see the
agents running in Weft on your own machine, answer the one that needs you, and
get a push when you are away, from a phone, a tablet or a browser.

This repository holds one Cloudflare Worker:

- `web/`: the web app, served as static files.
- `worker/`: a small API for GitHub sign-in, your Macs and their current
  addresses. No screen, keystroke or push passes through it; those go
  between your device and your Mac.

Weft itself is at [fab7hq/weft](https://github.com/fab7hq/weft).

Licensed under the Apache License, Version 2.0.
