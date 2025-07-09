// dnsmo service worker with fixed resolveTXT
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === "GET" && path === "/federation.json") {
      return json({
        allow: true,
        pingback: env.PINGBACK_URL,
        whitelist: [env.WHITELIST_DOMAIN]
      });
    }

    if (method === "POST" && path === "/register") {
      const { zone, pubkey } = await request.json();
      await writeTXT(env, `pubkey.${zone}`, `key=${pubkey}`);
      await appendTXT(env, env.USER_REGISTRY_ZONE, zone);
      return json({ ok: true });
    }

    if (method === "POST" && path.startsWith("/post/")) {
      const zone = path.split("/")[2];
      return await postHandler(request, env, zone);
    }

    if (method === "POST" && path.startsWith("/comment/")) {
      const [, , zone, postId] = path.split("/");
      return await commentHandler(request, env, zone, postId);
    }

    if (method === "POST" && path.startsWith("/like/")) {
      const [, , zone, itemId] = path.split("/");
      return await likeHandler(request, env, zone, itemId);
    }

    if (method === "GET" && path === "/timeline") {
      return await globalTimeline(env);
    }

    if (method === "GET" && path.startsWith("/timeline/")) {
      const zone = path.split("/").pop();
      return await userTimeline(zone);
    }

    return new Response("Not Found", { status: 404 });
  }
};

// === Handlers ===

async function postHandler(request, env, zone) {
  const { content, signature, pubkey } = await request.json();
  const dnsPubkey = await getDNSPubkey(zone);
  if (pubkey !== dnsPubkey) return json({ error: "Zone ownership mismatch" });
  if (!await verify(content, signature, pubkey)) return json({ error: "Invalid signature" });

  const timestamp = Date.now();
  const id = `post${timestamp}`;
  const chunks = chunkContent(content);
  for (let i = 0; i < chunks.length; i++) {
    await writeTXT(env, `${id}.${zone}`, chunks[i]);
  }
  await appendToPostIndex(env, zone, id);
  return json({ ok: true, id });
}

async function commentHandler(request, env, zone, postId) {
  const { content, signature, pubkey } = await request.json();
  if (!await verify(content, signature, pubkey)) throw new Error("Invalid signature");

  const timestamp = Date.now();
  const id = `comment${timestamp}`;
  await appendTXT(env, `comments.${zone}`, `${id}:${postId}=${content}`);
  await writeTXT(env, `commentindex.${zone}`, `latest=${id}`);
  return json({ ok: true, id });
}

async function likeHandler(request, env, zone, itemId) {
  const { voter, signature, pubkey } = await request.json();
  const message = `${voter}:${itemId}`;
  if (!await verify(message, signature, pubkey)) throw new Error("Invalid signature");

  await appendTXT(env, `voters.${itemId}.${zone}`, `${voter}:+1`);
  return json({ ok: true });
}

async function globalTimeline(env) {
  const records = await resolveTXT(env.USER_REGISTRY_ZONE);
  const zones = [...new Set(records.flatMap(txt => txt.split(/[|\s]+/)).map(z => z.trim()).filter(Boolean))];
  const posts = [];

  for (const zone of zones) {
    const indexRecords = await resolveTXT(`postindex.${zone}`).catch(() => []);
    const chunkRecords = indexRecords.filter(r => r.startsWith("chunk"));

    for (const chunk of chunkRecords) {
      const [_, postList] = chunk.split("=");
      const postIds = postList.split(",").slice(-5);

      for (const postId of postIds) {
        try {
          const [contentRecords, likeRecords, commentRecords] = await Promise.all([
            resolveTXT(`${postId}.${zone}`),
            resolveTXT(`voters.${postId}.${zone}`).catch(() => []),
            resolveTXT(`comments.${zone}`).catch(() => [])
          ]);

          const content = contentRecords.join("");
          const timestamp = parseInt(postId.replace("post", ""));
          const likes = new Set(likeRecords.map(line => line.split(":"[0]))).size;
          const comments = commentRecords.filter(line => line.includes(`${postId}=`)).length;

          if (content) posts.push({ id: postId, timestamp, content, zone, likes, comments });
        } catch (_) {}
      }
    }
  }

  posts.sort((a, b) => b.timestamp - a.timestamp);
  return json(posts);
}

async function userTimeline(zone) {
  const index = await resolveTXT(`postindex.${zone}`).catch(() => []);
  const chunkRecords = index.filter(r => r.startsWith("chunk"));
  const posts = [];

  for (const chunk of chunkRecords) {
    const [_, postList] = chunk.split("=");
    const postIds = postList.split(",").slice(-5);

    for (const postId of postIds) {
      try {
        const [contentRecords, likeRecords, commentRecords] = await Promise.all([
          resolveTXT(`${postId}.${zone}`),
          resolveTXT(`voters.${postId}.${zone}`).catch(() => []),
          resolveTXT(`comments.${zone}`).catch(() => [])
        ]);

        const content = contentRecords.join("");
        const timestamp = parseInt(postId.replace("post", ""));
        const likes = new Set(likeRecords.map(line => line.split(":"[0]))).size;
        const comments = commentRecords.filter(line => line.includes(`${postId}=`)).length;

        posts.push({ id: postId, timestamp, content, zone, likes, comments });
      } catch (_) {}
    }
  }

  posts.sort((a, b) => b.timestamp - a.timestamp);
  return json(posts);
}

// === DNS I/O ===

async function resolveTXT(zone) {
  const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${zone}&type=TXT`, {
    headers: { accept: "application/dns-json" }
  });
  const data = await res.json();
  const answers = data.Answer || [];
  const lines = [];

  for (const a of answers) {
    const full = a.data.match(/"([^\"]*)"/g)?.map(s => s.slice(1, -1)).join("") || "";
    const unescaped = full.replace(/\\\\/g, "\\");
    const decoded = unescaped.replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
    lines.push(...decoded.split("\n").map(l => l.trim()).filter(Boolean));
  }

  return lines;
}

async function writeTXT(env, name, content) {
  const apiBase = `https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/dns_records`;
  const headers = {
    Authorization: `Bearer ${env.CF_API_TOKEN}`,
    "Content-Type": "application/json"
  };

  const listRes = await fetch(`${apiBase}?type=TXT&name=${name}`, { headers });
  const listData = await listRes.json();
  const existing = listData.result?.[0];
  const body = JSON.stringify({ type: "TXT", name, content, ttl: 60 });

  if (existing) {
    await fetch(`${apiBase}/${existing.id}`, { method: "PUT", headers, body });
  } else {
    await fetch(apiBase, { method: "POST", headers, body });
  }
}

async function appendTXT(env, name, newEntry) {
  const existing = await resolveTXT(name).catch(() => []);
  const updated = [...existing, newEntry].join("\n");
  await writeTXT(env, name, updated);
}

async function getCurrentChunk(env, zone) {
  const indexRecords = await resolveTXT(`postindex.${zone}`).catch(() => []);
  const chunks = indexRecords.filter(r => r.startsWith("chunk"));
  if (!chunks.length) return { chunkId: "chunk0", posts: [] };
  const latestChunk = chunks.sort().slice(-1)[0];
  const [chunkId, postList] = latestChunk.split("=");
  const posts = postList.split(",").map(p => p.trim()).filter(Boolean);
  return { chunkId, posts };
}

async function appendToPostIndex(env, zone, postId) {
  const { chunkId, posts } = await getCurrentChunk(env, zone);
  if (posts.length >= 900) {
    const newChunkNum = parseInt(chunkId.replace("chunk", "")) + 1;
    const newChunkId = `chunk${newChunkNum}`;
    await writeTXT(env, `postindex.${zone}`, `${newChunkId}=${postId}`);
  } else {
    const updatedPosts = [...posts, postId].join(",");
    await writeTXT(env, `postindex.${zone}`, `${chunkId}=${updatedPosts}`);
  }
}

async function getDNSPubkey(zone) {
  const res = await fetch(`https://cloudflare-dns.com/dns-query?name=pubkey.${zone}&type=TXT`, {
    headers: { accept: "application/dns-json" }
  });
  const data = await res.json();
  const answers = data.Answer || [];
  for (const a of answers) {
    const txt = a.data.replace(/^"|"$/g, "").replace(/\\"/g, '"').trim();
    if (txt.startsWith("key=")) {
      return txt.slice(4);
    }
  }
  return null;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function decode(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

async function verify(message, signatureB64, pubkeyB64) {
  const key = await crypto.subtle.importKey("raw", decode(pubkeyB64), { name: "Ed25519" }, false, ["verify"]);
  return crypto.subtle.verify("Ed25519", key, decode(signatureB64), new TextEncoder().encode(message));
}

function chunkContent(text) {
  const chunks = [];
  const limit = 250;
  for (let i = 0; i < text.length; i += limit) {
    chunks.push(text.slice(i, i + limit));
  }
  return chunks;
}
