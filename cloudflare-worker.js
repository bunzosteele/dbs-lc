/**
 * DBS Loot Council — Cloudflare Workers KV Storage
 *
 * Setup (one-time, ~5 minutes):
 * 1. Create a free Cloudflare account at https://cloudflare.com
 * 2. Go to Workers & Pages → Create Worker → paste this script → Deploy
 * 3. Go to Workers & Pages → KV → Create namespace → name it "DBS_LC"
 * 4. Bind it to your Worker: Worker Settings → Variables → KV Namespace Bindings
 *    Variable name: DB   Namespace: DBS_LC
 * 5. Add a secret: Worker Settings → Variables → Secret Variables
 *    Name: WRITE_TOKEN   Value: (any strong passphrase you choose)
 * 6. Copy your Worker URL (e.g. https://dbs-lc.yourname.workers.dev)
 *    and paste it into the CF_WORKER_URL constant in index.html
 * 7. Seed your existing JSON files via the dashboard's one-time migration button,
 *    or upload them manually via the Cloudflare KV UI.
 *
 * Allowed keys (filenames):
 *   loot-glossary.json, roster.json, attendance.json,
 *   bis-data.json, gear-item-ids.json, set-bonuses.json,
 *   wcl-config.json, cla-sheets.json
 *
 * Auth:
 *   Reads  — no token required (open)
 *   Writes — require header: X-Token: <WRITE_TOKEN>
 */

const ALLOWED_KEYS = new Set([
  'loot-glossary.json',
  'roster.json',
  'attendance.json',
  'bis-data.json',
  'gear-item-ids.json',
  'set-bonuses.json',
  'wcl-config.json',
  'cla-sheets.json',
]);

export default {
  async fetch(request, env) {
    // CORS — allow the GitHub Pages origin and local dev
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Token',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    // Key is the last path segment, e.g. /loot-glossary.json → loot-glossary.json
    const key = url.pathname.replace(/^\/+/, '');

    if (!key || !ALLOWED_KEYS.has(key)) {
      return new Response(JSON.stringify({ error: 'Unknown key: ' + key }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── GET ──────────────────────────────────────────────────────
    if (request.method === 'GET') {
      const value = await env.DB.get(key);
      if (value === null) {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(value, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── PUT ──────────────────────────────────────────────────────
    if (request.method === 'PUT') {
      const token = request.headers.get('X-Token');
      if (!token || token !== env.WRITE_TOKEN) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = await request.text();
      // Validate it's parseable JSON before storing
      try { JSON.parse(body); } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await env.DB.put(key, body);
      return new Response(JSON.stringify({ ok: true, key }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};
