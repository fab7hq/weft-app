// Only /api/* and /auth/* run the Worker, and /api/me is 401 to
// someone not signed in.
import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

describe('the Worker', () => {
  it('answers /api/me with 401 without a session', async () => {
    const r = await exports.default.fetch('https://weft.getfab7.com/api/me');
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ code: 'signed_out', message: 'Sign in with GitHub first.' });
  });

  it('knows no other API path', async () => {
    const r = await exports.default.fetch('https://weft.getfab7.com/api/nothing');
    expect(r.status).toBe(404);
  });
});

describe('words.json', () => {
  it('is served to be revalidated on every load', async () => {
    const worker = (await import('../src/index')).default;
    const env = { ASSETS: { fetch: async () => new Response('{"act.ask":"Ask"}', { headers: { 'Content-Type': 'application/json' } }) } };
    const r = await worker.fetch(new Request('https://weft.getfab7.com/words.json'), env as never);
    expect(r.headers.get('Cache-Control')).toBe('no-cache');
    expect(await r.json()).toEqual({ 'act.ask': 'Ask' });
  });
});
