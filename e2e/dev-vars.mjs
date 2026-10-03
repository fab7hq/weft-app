// The Worker's secrets for `wrangler dev` under the e2e tests: a test-only
// assertion key and a GitHub secret nothing uses. Written to .dev.vars
// (ignored by Git); the real ones are Worker secrets.
import { readFileSync, writeFileSync } from 'node:fs';

const key = readFileSync(new URL('../worker/test/fixtures/test-assertion-key.pem', import.meta.url), 'utf8');
writeFileSync(new URL('../.dev.vars', import.meta.url), `GITHUB_CLIENT_SECRET="e2e"\nASSERTION_KEY="${key.replace(/\n/g, '\\n')}"\n`);
