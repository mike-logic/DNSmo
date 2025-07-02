# DNSmo Worker (api.usingthe.cloud)

This is a [DNSmo](https://github.com/dnsmo) compatible federation + resolver worker for decentralized post publishing over DNS-style zones.

It accepts signed JSON posts via `/publish`, stores them (currently in memory), and serves them at `/resolve/{zone}`.

---

## 📦 Contents

```
dnsmo-worker/
├── index.js          # Cloudflare Worker logic (handles federation + publishing)
├── wrangler.toml     # Deployment config
├── generate_keys.py  # Generates Ed25519 keypair for signing posts
├── publish_post.py   # Sends a signed post to the federation API
```

---

## 🚀 Quickstart

### 1. Install requirements

```bash
pip install pynacl requests
```

---

### 2. Generate your Ed25519 keypair

```bash
python generate_keys.py
```

This will output:

- A base64 private key (save it!)
- A base64 public key (used in publishing requests)

---

### 3. Send a signed post

Update `publish_post.py` with your private key:

```python
PRIVATE_KEY_B64 = "..."
ZONE = "yourname.usingthe.cloud"
```

Then run:

```bash
python publish_post.py
```

You should get:

```
Status: 200
Response: {"ok":true}
```

---

### 4. View your posts

```bash
curl https://api.usingthe.cloud/resolve/yourname.usingthe.cloud
```

You’ll get back:

```json
{
  "records": {
    "post000": "hello world | ts=..."
  }
}
```

---

## 🧠 How it works

- `index.js` runs on Cloudflare Workers
- Accepts signed federation posts via `POST /publish`
- Temporarily stores records in memory (use KV for persistence)
- Serves `GET /resolve/{zone}` with current records
- Federation config lives at `/federation.json`

---

## 🔧 Customization Guide

If you're cloning this for your own domain (e.g. `api.mydomain.com`), make sure you:

1. Update the `whitelist` in `index.js`:

```js
whitelist: ["yourdomain.com"]
```

2. Set your route in `wrangler.toml`:

```toml
[env.production]
zone_id = "your-cloudflare-zone-id"
route = "api.yourdomain.com/*"
```

3. Deploy with:

```bash
wrangler deploy --env production
```

---

## 🧱 Coming soon

- 🔁 Auto-increment post keys (`post000`, `post001`, etc.)
- 🪣 Replace in-memory store with Cloudflare KV or R2
- 🔏 Add Ed25519 signature verification on `/resolve`
- 🌐 Add web-based composer for signed publishing

---

## 📄 License

MIT
