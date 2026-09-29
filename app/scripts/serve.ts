// Static server: app/index.html, app/dist, app/public/*, ../data, ../audio
import path from 'node:path';
const APP = path.resolve(import.meta.dir, '..');
const ROOT = path.resolve(APP, '..');
export function serve(port = 0) {
  return Bun.serve({
    port,
    async fetch(req) {
      let p = decodeURIComponent(new URL(req.url).pathname);
      if (p === '/') p = '/index.html';
      const cands = [path.join(APP, p), path.join(APP, 'public', p), path.join(ROOT, p)];
      for (const c of cands) {
        if (!c.startsWith(ROOT)) continue;
        const f = Bun.file(c);
        if (await f.exists()) return new Response(f);
      }
      return new Response('not found', { status: 404 });
    },
  });
}
if (import.meta.main) { const s = serve(+(process.argv[2] ?? 5173)); console.log('serving on', s.port); }
