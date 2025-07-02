let MEMORY_STORE = {};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/federation.json") {
      return new Response(JSON.stringify({
        allow: true,
        pingback: "https://<DOMAIN>/publish",
        whitelist: ["dnsmo.link", "usingthe.cloud"]
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (path === "/publish" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return new Response("Invalid JSON", { status: 400 });
      }

      const { zone, records, timestamp, signature, publicKey } = body;

      if (!zone || !records || !timestamp || !signature || !publicKey) {
        return new Response("Missing required fields", { status: 400 });
      }

      const domain = zone.split(".").slice(-2).join(".");
      const allowed = ["<DOMAIN1>", "<DOMAIN2>"];
      if (!allowed.includes(domain)) {
        return new Response("Zone not allowed", { status: 403 });
      }

      MEMORY_STORE[zone] = {
        ...(MEMORY_STORE[zone] || {}),
        ...records
      };

      console.log(`✅ Stored post(s) for ${zone}:`, JSON.stringify(records));
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (path.startsWith("/resolve/")) {
      const zone = decodeURIComponent(path.slice("/resolve/".length));
      const records = MEMORY_STORE[zone];

      if (!records) {
        return new Response("Not found", { status: 404 });
      }

      return new Response(JSON.stringify({ records }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response("Not found", { status: 404 });
  }
};
