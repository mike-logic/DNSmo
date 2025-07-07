export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === "GET" && path === "/federation.json") {
      return json({
        allow: true,
        pingback: "${PINGBACK_URL}",
        whitelist: ["${WHITELIST_DOMAIN}"]
      });
    }

    if (method === "POST" && path === "/register") {
      const { zone, pubkey } = await request.json();
      await writeTXT(env, `pubkey.${zone}`, `key=${pubkey}`);
      await writeTXT(env, "${USER_REGISTRY_ZONE}", zone);
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
      return await globalTimeline();
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
  if (!await verify(content, signature, pubkey)) throw new Error("Invalid signature");

  const timestamp = Date.now();
  const id = `post${timestamp}`;
  await writeTXT(env, `posts.${zone}`, `${id}=${content}`);
  await writeTXT(env, `postindex.${zone}`, `latest=${id}`);
  return json({ ok: true, id });
}

async function commentHandler(request, env, zone, postId) {
  const { content, signature, pubkey } = await request.json();
  if (!await verify(content, signature, pubkey)) throw new Error("Invalid signature");

  const timestamp = Date.now();
  const id = `comment${timestamp}`;
  await writeTXT(env, `comments.${zone}`, `${id}:${postId}=${content}`);
  await writeTXT(env, `commentindex.${zone}`, `latest=${id}`);
  return json({ ok: true, id });
}

async function likeHandler(request, env, zone, itemId) {
  const { voter, signature, pubkey } = await request.json();
  const message = `${voter}:${itemId}`;
  if (!await verify(message, signature, pubkey)) throw new Error("Invalid signature");

  const name = `voters.${itemId}.${zone}`;
  await writeTXT(env, name, `${voter}:+1`);
  return json({ ok: true });
}

async function globalTimeline() {
  const records = await resolveTXT("${USER_REGISTRY_ZONE}");
  const zones = [...new Set(
    records.flatMap(txt => txt.split(/[|\s]+/)).map(z => z.trim()).filter(Boolean)
  )];

  const posts = [];

  for (const zone of zones) {
    try {
      const indexRecords = await resolveTXT(`postindex.${zone}`);
      const latest = indexRecords.find(r => r.startsWith("latest="))?.split("=")[1];
      if (!latest) continue;

      const postRecords = await resolveTXT(`posts.${zone}`);
      const content = postRecords.find(r => r.startsWith(`${latest}=`))?.split("=")[1];
      const timestamp = parseInt(latest.replace("post", ""));
      if (content) {
        posts.push({ id: latest, timestamp, content, zone });
      }
    } catch (e) {}
  }

  posts.sort((a, b) => b.timestamp - a.timestamp);
  return json(posts);
}

async function userTimeline(zone) {
  const index = await resolveTXT(`postindex.${zone}`);
  const latest = index.find(r => r.startsWith("latest="))?.split("=")[1];
  const records = await resolveTXT(`posts.${zone}`);
  const content = records.find(r => r.startsWith(`${latest}=`))?.split("=")[1];
  const timestamp = parseInt(latest.replace("post", ""));
  return json([{ id: latest, timestamp, content }]);
}

// === DNS Write ===

async function writeTXT(env, name, content) {
  await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/dns_records`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type: "TXT",
      name,
      content,
      ttl: 60
    })
  });
}

// === DNS Read ===

async function resolveTXT(zone) {
  const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${zone}&type=TXT`, {
    headers: { accept: "application/dns-json" }
  });
  const data = await res.json();
  const answers = data.Answer || [];
  const results = [];

  for (const a of answers) {
    const txt = a.data.replace(/^"|"$/g, "").replace(/\\"/g, '"');
    results.push(...txt.split(" | ").map(t => t.trim()));
  }
  return results;
}

// === Signature Verification ===

function decode(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

async function verify(message, signatureB64, pubkeyB64) {
  const key = await crypto.subtle.importKey(
    "raw",
    decode(pubkeyB64),
    { name: "Ed25519" },
    false,
    ["verify"]
  );
  return crypto.subtle.verify(
    "Ed25519",
    key,
    decode(signatureB64),
    new TextEncoder().encode(message)
  );
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
