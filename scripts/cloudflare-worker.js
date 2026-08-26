/**
 * DBS Loot Council — Cloudflare Workers KV Storage
 * Token is hardcoded below — replace with your chosen write token.
 * The Worker source is only visible to the Cloudflare account owner.
 */

const WRITE_TOKEN = 'REPLACE_WITH_YOUR_TOKEN';

const ALLOWED_KEYS = new Set([
  'loot-glossary.json',
  'roster.json',
  'attendance.json',
  'loot-distribution.json',
  'bis-data.json',
  'gear-item-ids.json',
  'set-bonuses.json',
  'wcl-config.json',
  'cla-sheets.json',
]);

/**
 * Hosts /proxy is permitted to fetch.
 *
 * This Worker is public, so without an allowlist anyone who found the URL could use
 * it as a free open proxy attached to your Cloudflare account — a real liability,
 * not a theoretical one. Keep this list as narrow as the dashboard needs:
 *
 *   script.google.com            — your Apps Script /exec endpoint
 *   script.googleusercontent.com — where Apps Script 302-redirects its response
 *   docs.google.com              — direct Sheets CSV export (legacy path)
 */
const PROXY_ALLOWED_HOSTS = new Set([
  'script.google.com',
  'script.googleusercontent.com',
  'docs.google.com',
]);

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Token',
    };
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: corsHeaders });

    const url = new URL(request.url);
    const key = url.pathname.replace(/^\/+/, '');

    // ── GET /proxy?url=… (open CORS proxy, host-restricted) ───────
    // MUST be handled before the ALLOWED_KEYS gate below, which 404s any path that
    // isn't a KV key. Deliberately unauthenticated: read-only visitors have no write
    // token but still need CLA data on page load. The host allowlist, not a token,
    // is what keeps this from being an open relay.
    if (key === 'proxy') {
      if (request.method !== 'GET')
        return json({ error: 'Proxy accepts GET only' }, 405);

      const target = url.searchParams.get('url');
      if (!target) return json({ error: 'Missing ?url= parameter' }, 400);

      let targetUrl;
      try { targetUrl = new URL(target); }
      catch { return json({ error: 'Malformed ?url= parameter' }, 400); }

      if (targetUrl.protocol !== 'https:')
        return json({ error: 'Only https:// targets are allowed' }, 400);

      if (!PROXY_ALLOWED_HOSTS.has(targetUrl.hostname))
        return json({
          error: 'Host not allowed by this proxy: ' + targetUrl.hostname,
          allowed: [...PROXY_ALLOWED_HOSTS],
        }, 403);

      try {
        // redirect: 'follow' is the default and is the whole point — Apps Script
        // answers /exec with a 302 to script.googleusercontent.com, and that host
        // sends no CORS headers of its own. Following it here is what makes the
        // response usable from the browser.
        const upstream = await fetch(targetUrl.toString(), {
          method: 'GET',
          redirect: 'follow',
          headers: { 'User-Agent': 'dbs-lc-worker' },
          // Short edge cache: CLA sheets change once per raid night, so serving
          // repeats from Cloudflare's edge cuts load time and traffic to Google.
          cf: { cacheTtl: 300, cacheEverything: true },
        });

        const body = await upstream.arrayBuffer();
        return new Response(body, {
          status: upstream.status,
          headers: {
            ...corsHeaders,
            'Content-Type': upstream.headers.get('Content-Type') || 'text/plain',
            'X-Proxied-Host': targetUrl.hostname,
          },
        });
      } catch (e) {
        return json({ error: 'Upstream fetch failed: ' + e.message }, 502);
      }
    }

    // ── POST /auth-check (token validation only, no side effects) ───
    // Also must come before the ALLOWED_KEYS gate — 'auth-check' is not a KV key,
    // so leaving it below the gate made every token validation 404.
    if (key === 'auth-check') {
      if (request.method !== 'POST')
        return json({ error: 'auth-check accepts POST only' }, 405);
      const token = request.headers.get('X-Token');
      if (!token || token !== WRITE_TOKEN) return json({ error: 'Unauthorized' }, 401);
      return json({ ok: true });
    }

    if (!key || !ALLOWED_KEYS.has(key))
      return json({ error: 'Unknown key: ' + key }, 404);

    // ── GET (open, no auth required) ─────────────────────────────
    if (request.method === 'GET') {
      const value = await env.DB.get(key);
      return value
        ? new Response(value, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        : json({ error: 'Not found' }, 404);
    }

    // ── PUT (write token required) ────────────────────────────────
    if (request.method === 'PUT') {
      const token = request.headers.get('X-Token');
      if (!token || token !== WRITE_TOKEN) return json({ error: 'Unauthorized' }, 401);

      const body = await request.text();
      try { JSON.parse(body); } catch {
        return json({ error: 'Invalid JSON' }, 400);
      }
      await env.DB.put(key, body);
      return json({ ok: true, key });
    }

    return json({ error: 'Method not allowed' }, 405);
  },
};
