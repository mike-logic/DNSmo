# DNSmo Worker

This is a [DNSmo](https://github.com/dnsmo) compatible Cloudflare Worker that acts as a federation endpoint and resolver.

It accepts signed JSON posts via `/publish`, stores them (currently in memory), and serves them at `/resolve/{zone}`. It also exposes a discovery file at `/federation.json`.

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

## 🧠 What the Worker does

- Serves `/federation.json` with federation metadata
- Accepts signed posts via `POST /publish`
- Stores posts in memory (not persistent)
- Serves `GET /resolve/{zone}` with current records

---

## 🛠 Customize Before Deploying

### Edit `index.js`:

Update the `whitelist` domains allowed to publish:

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

- `/federation.json` should reflect your whitelist
- `/publish` should accept signed posts
- `/resolve/{zone}` will return stored post data

---

## 📄 License

MIT
