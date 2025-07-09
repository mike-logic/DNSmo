
# DNSmo — Decentralized DNS-based Microblogging

DNSmo is a protocol and reference implementation that stores social content—posts, comments, likes—directly in DNS. This repository includes:

- A Cloudflare Worker backend (`index.js`)
- A local command-line client (`dnsmo_cli.py`)
- A federation model for decentralized discovery
- No backend database required — just DNS

---

## 🌐 What it does

- Stores posts, comments, and likes as signed DNS TXT records
- Splits and chunks records automatically if they exceed TXT size
- Publishes public keys as DNS TXT records (`pubkey.<zone>`)
- Supports signed comments and likes with voter identity
- Serves global and per-user timelines
- Provides an extensible federation model

---

## 🛰️ Federation

The federation system allows decentralized, interlinked social zones.

```json
GET /.well-known/federation.json

{
  "allow": true,
  "pingback": "https://api.example.com/publish",
  "whitelist": ["example.com", "dnsmo.link"],
  "registryZone": "users.example.com"
}
```

Each root domain (like `example.com`) hosts a `users` subzone where individual user zones are indexed. For example:

```
alice.users.example.com
bob.users.example.com
```

Posts live in `postindex.alice.users.example.com` and use incremental IDs like:

```
post1750000000000.alice.users.example.com
```

---

## ⚙️ Worker Configuration (wrangler.toml)

```toml
name = "dnsmo-worker"
main = "index.js"
compatibility_date = "2024-07-01"
compatibility_flags = ["nodejs_compat"]
workers_dev = true

[env.production]
zone_id = "${CF_ZONE_ID}"
account_id = "${CF_ACCOUNT_ID}"
route = "https://${YOUR_DOMAIN}/*"

[env.production.vars]
CF_ZONE_ID = "${CF_ZONE_ID}"
CF_API_TOKEN = "${CF_API_TOKEN}"
PINGBACK_URL = "${PINGBACK_URL}"
WHITELIST_DOMAIN = "${WHITELIST_DOMAIN}"
USER_REGISTRY_ZONE = "${USER_REGISTRY_ZONE}"
```

---

## 📦 API Endpoints

| Method | Route                           | Description                     |
|--------|----------------------------------|---------------------------------|
| POST   | `/register`                      | Register user zone & pubkey     |
| POST   | `/post/:zone`                    | Publish a signed post           |
| POST   | `/comment/:zone/:postId`         | Publish a signed comment        |
| POST   | `/like/:zone/:itemId`            | Like a post or comment          |
| GET    | `/timeline`                      | Global feed                     |
| GET    | `/timeline/:zone`                | Per-user feed                   |
| GET    | `/federation.json`               | Federation metadata             |

---

## 🖥️ CLI (dnsmo_cli.py)

The CLI lets you post, comment, and like from a terminal. All actions are signed with your Ed25519 key.

### 🚀 Quick Start

```bash
python dnsmo_cli.py
```

### 💬 Interactive Commands

```
dnsmo> register alice.users.example.com
dnsmo> post Hello DNSmo
dnsmo> comment post1751234567890 Great post!
dnsmo> like post1751234567890
dnsmo> timeline
dnsmo> keys
dnsmo> exit
```

### 🗂️ Key Features

- Generates and persists keypair in `dnsmo_key.json`
- Signs all data before posting
- Uses DNS to resolve public keys
- Supports global and per-zone timelines
- Likes/comments tracked and indexed

---

## 🧪 Known Limitations

- Comment/like counts may lag in timeline if chunked data exceeds resolver limits
- DNS caching may delay visibility of new posts
- Federation discovery assumes well-formed zones and federation.json
- No encryption — all content is public

---

## 🛣️ Roadmap

- [ ] End-to-end encryption for private zones
- [ ] Rich metadata (attachments, geotags)
- [ ] DNS-less gateway fallback (optional CDN mirror)
- [ ] Vote verification UX and key rotation
- [ ] Federation trust scoring or moderation
