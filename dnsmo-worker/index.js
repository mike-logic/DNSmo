export default {
  async fetch(request, env, ctx) {
    try {
      const { method } = request;
      const url = new URL(request.url);

      if (url.pathname === '/federation.json') {
        return new Response(JSON.stringify({
          allow: true,
          pingback: 'https://api.usingthe.cloud/publish',
          whitelist: ['mike.usingthe.cloud']
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

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

        const key = `dnsmo:${zone}`;
        const entry = { records, timestamp, publicKey, signature };
        await env.DNSMO.put(key, JSON.stringify(entry));

        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url.pathname.startsWith('/resolve/')) {
        const zone = url.pathname.replace('/resolve/', '');
        const key = `dnsmo:${zone}`;
        const entry = await env.DNSMO.get(key, { type: 'json' });
        if (!entry) {
          return new Response('Not found', { status: 404 });
        }
        return new Response(JSON.stringify(entry), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url.pathname.match(/^\/comment\/([^\/]+)\/([^\/]+)$/)) {
        const [, zone, postID] = url.pathname.split('/').slice(-2);
        const allKeys = await listAllKeys(env.DNSMO);
        const comments = [];

        for (const key of allKeys) {
          const name = key.replace(/^dnsmo:/, '');
          if (name.endsWith(`${postID}.${zone}`) && name.startsWith('comment')) {
            const record = await env.DNSMO.get(key, { type: 'json' });
            if (record) {
              comments.push({ zone: name, ...record });
            }
          }
        }

        comments.sort((a, b) => a.timestamp - b.timestamp);

        if (url.searchParams.get('count') === 'true') {
          return new Response(JSON.stringify({ count: comments.length }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify(comments), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url.pathname.startsWith('/feed/')) {
        const zone = url.pathname.replace('/feed/', '');
        const entry = await env.DNSMO.get(`dnsmo:${zone}`, { type: 'json' });
        if (!entry || !entry.records) {
          return new Response('Not found', { status: 404 });
        }

        const posts = Object.entries(entry.records)
          .filter(([k]) => k.startsWith('post'))
          .map(([key, value]) => ({
            key: `${key}.${zone}`,
            value,
            timestamp: entry.timestamp
          }));

        return new Response(JSON.stringify(posts), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url.pathname === '/global-feed') {
        const currentZone = 'mike.usingthe.cloud';
        const federationList = [currentZone];

        const currentEntry = await env.DNSMO.get(`dnsmo:${currentZone}`, { type: 'json' });
        if (!currentEntry || !currentEntry.records) {
          return new Response(JSON.stringify([]), {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const posts = [];
        for (const zone of federationList) {
          const entry = await env.DNSMO.get(`dnsmo:${zone}`, { type: 'json' });
          if (entry?.records) {
            for (const [key, value] of Object.entries(entry.records)) {
              if (key.startsWith('post')) {
                posts.push({
                  zone,
                  postID: key,
                  value,
                  timestamp: entry.timestamp
                });
              }
            }
          }
        }

        posts.sort((a, b) => b.timestamp - a.timestamp);

        return new Response(JSON.stringify(posts), {
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

async function listAllKeys(kv) {
  let cursor;
  let keys = [];
  do {
    const { keys: batch, cursor: nextCursor } = await kv.list({ cursor });
    keys.push(...batch.map(k => k.name));
    cursor = nextCursor;
  } while (cursor);
  return keys;
}
