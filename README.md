# DNSmo Worker

This project implements a [DNSmo](https://github.com/dnsmo) federation-compatible endpoint using Cloudflare Workers.

DNSmo is a decentralized publishing system that uses DNS-like zones as personal namespaces. Users publish posts as `TXT`-style key-value records inside their zones, which are served over DNS, HTTP, or federation APIs. Each zone acts as a self-contained feed.

This Worker enables users to:

- ✅ Publish signed posts to a DNS-style zone (e.g. `post000` to `post999`)
- ✅ Chain zone pages using `_next`
- ✅ Serve the content of any zone via HTTP (`/resolve`)
- ✅ Discover federation capabilities via `/federation.json`

---

## 🧠 How DNSmo Works

- Users have a zone (e.g. `yourname.example.com`)
- Posts are stored as keys like `post000`, `post001`, etc.
- Posts are signed with an Ed25519 key and submitted to a federation endpoint
- Federation endpoints (like this Worker) store the posts and serve them via `/resolve/{zone}`
- The `/federation.json` endpoint tells clients how to publish

---

## 📦 Contents

```
dnsmo-worker/
├── index.js          # Cloudflare Worker logic (handles federation + publishing)
├── wrangler.toml     # Deployment config (you must customize this)
├── generate_keys.py  # Generates Ed25519 keypair for signing posts
├── publish_post.py   # Sends a signed post to the federation API
```

---

## 🚀 Quickstart

### 1. Install Python requirements

```bash
pip install pynacl requests
```

---

### 2. Generate your Ed25519 keypair

```bash
python generate_keys.py
```

This outputs:

- A base64 private key (used for signing posts)
- A base64 public key (sent in each post)

---

### 3. Customize `publish_post.py`

Edit:

```python
PRIVATE_KEY_B64 = "..."
ZONE = "yourzone.example.com"
```

Then publish:

```bash
python publish_post.py
```

---

### 4. View your post

```bash
curl https://your-api-domain.com/resolve/yourzone.example.com
```

Returns:

```json
{
  "records": {
    "post000": "hello world | ts=..."
  }
}
```

---

## 🧠 What the Worker Does

- Serves `/federation.json` to advertise federation support
- Accepts signed JSON payloads via `POST /publish`
- Stores posts in memory (can be upgraded to Cloudflare KV)
- Responds to `GET /resolve/{zone}` with current records

---

## 🛠 Customize Before Deploying

### Edit `index.js`:

Update the allowed domains for publishing:

```js
whitelist: ["yourdomain.com"]
```

---

### Edit `wrangler.toml`:

Replace the placeholder values:

```toml
name = "dnsmo-worker"
main = "index.js"
compatibility_date = "2024-07-01"
account_id = "YOUR_CLOUDFLARE_ACCOUNT_ID"
workers_dev = true

[env.production]
zone_id = "YOUR_CLOUDFLARE_ZONE_ID"
route = "api.yourdomain.com/*"
```

---

### Deploy the Worker

```bash
wrangler deploy --env production
```

After deployment:

- `GET /federation.json` shows federation support
- `POST /publish` accepts signed posts
- `GET /resolve/yourzone.example.com` returns records

---

## 🔐 Federation Signing Spec

Each post must include:

```json
{
  "zone": "yourname.example.com",
  "records": {
    "post000": "hello world | ts=1234567890"
  },
  "timestamp": 1234567890,
  "publicKey": "<base64-ed25519-pubkey>",
  "signature": "<base64-ed25519-sig>"
}
```

The signature is calculated over the canonical JSON of `{ zone, records, timestamp }` with sorted keys and no extra whitespace.

---

## 📄 License

MIT
