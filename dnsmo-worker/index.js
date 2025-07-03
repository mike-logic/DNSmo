const CONFIG = {
  federation: {
    allow: true,
    pingback: 'https://your-api.example.com/publish',
    whitelist: ['yourdomain.example.com']
  },
  kvPrefix: 'dnsmo:',
};

export default {
  async fetch(request, env, ctx) {
    try {
      const { method } = request;
      const url = new URL(request.url);

      // === Federation Discovery ===
      if (url.pathname === '/federation.json') {
        return new Response(JSON.stringify(CONFIG.federation), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // === Publishing (Post or Comment) ===
      if (url.pathname === '/publish' && method === 'POST') {
        const body = await request.json();
        const { zone, records, timestamp, publicKey, signature } = body;
        if (!zone || !records || !timestamp || !publicKey || !signature) {
          return new Response('Missing fields', { status: 400 });
        }

        const isValid = await verifySignature(body);
        if (!isValid) {
          return new Response('Invalid signature', { status: 400 });
        }

        const key = `${CONFIG.kvPrefix}${zone}`;
        const entry = { records, timestamp, publicKey, signature };
        await env.DNSMO.put(key, JSON.stringify(entry));

        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // === Zone Resolver ===
      if (url.pathname.startsWith('/resolve/')) {
        const zone = url.pathname.replace('/resolve/', '');
        const key = `${CONFIG.kvPrefix}${zone}`;
        const entry = await env.DNSMO.get(key, { type: 'json' });

        if (!entry) {
          return new Response('Not found', { status: 404 });
        }

        return new Response(JSON.stringify(entry), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // === Comment Fetcher (recursive with count support) ===
      if (url.pathname.startsWith('/comment/')) {
        const [, , zone, postID] = url.pathname.split('/');
        const prefix = `${CONFIG.kvPrefix}comment`;
        const threadRoot = `${postID}.${zone}`;
        const list = await env.DNSMO.list({ prefix });
        const tree = [];
        let count = 0;

        for (const k of list.keys) {
          const raw = k.name.replace(CONFIG.kvPrefix, '');
          if (raw.endsWith(threadRoot)) {
            const entry = await env.DNSMO.get(k.name, { type: 'json' });
            if (entry) {
              tree.push({ zone: raw, ...entry });
              count++;
            }
          }
        }

        const wantsCount = url.searchParams?.get?.('count') === 'true';
        return new Response(JSON.stringify(wantsCount ? { count } : tree), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response('Not found', { status: 404 });
    } catch (err) {
      return new Response(JSON.stringify({
        error: 'Internal error',
        details: err.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}

async function verifySignature(data) {
  try {
    const { signature, publicKey, ...unsigned } = data;

    const sortedKeys = Object.keys(unsigned).sort();
    const sortedObj = {};
    for (const key of sortedKeys) sortedObj[key] = unsigned[key];
    const body = JSON.stringify(sortedObj);

    const bodyBytes = new TextEncoder().encode(body);
    const sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
    const pubBytes = Uint8Array.from(atob(publicKey), c => c.charCodeAt(0));

    const key = await crypto.subtle.importKey(
      'raw',
      pubBytes,
      { name: 'Ed25519' },
      false,
      ['verify']
    );

    return await crypto.subtle.verify('Ed25519', key, sigBytes, bodyBytes);
  } catch (e) {
    console.warn('Signature verification failed:', e);
    return false;
  }
}
