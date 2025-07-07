# DNSmo Worker

DNSmo is a decentralized microblogging protocol that stores signed posts and comments directly in **DNS TXT records** under hierarchical zones. This project implements a **pure Cloudflare Worker** backend that handles DNS record creation, federation, and feed generation — with no backend database or infrastructure.

> 🧠 Your DNS zone *is* your social feed.

---

## ✅ Features

- 🔑 **Signed posts and comments** using Ed25519
- 🧵 **Hierarchical replies** via nested subdomains
- 📡 **Global timeline** by crawling user-level DNS zones
- 💬 **Comments & likes** encoded as additional DNS records
- 📁 **No KV, no database** – everything lives in DNS

---

## 🛠 Project Structure

```
dnsmo-worker/
├── index.js         # Cloudflare Worker (100% stateless DNS interface)
├── dnsmo_cli.py     # Reference CLI client (optional)
├── wrangler.toml    # Deployment config (edit for your zone)
```

Deprecated:
- ❌ `generate_keys.py` – removed (CLI handles key generation)
- ❌ `publish_post.py` – removed (use CLI or HTTP)

---

## 🌍 How It Works

### 🧱 Zones as Identity

- Each user owns a zone: `alice.users.example.com`
- Posts are created as `post123.alice.users.example.com`
- Comments are `comment001.post123.alice.users.example.com`

### 🔏 Signed Publishing

All posts/comments include:
```json
{
  "zone": "alice.users.example.com",
  "records": { "post123": "hello" },
  "timestamp": 1751910000,
  "publicKey": "<base64-ed25519-pubkey>",
  "signature": "<base64-ed25519-signature>"
}
```

Signature is over this canonical JSON:
```json
{ "records": ..., "timestamp": ..., "zone": ... }
```
Sorted keys, UTF-8, no whitespace.

---

## 🚀 Quickstart

### 1. Set your config

Edit `wrangler.toml`:
```toml
[env.production]
zone_id = "your-cloudflare-zone-id"
route = "api.yourdomain.com/*"
```

---

### 2. Deploy to Cloudflare

```bash
wrangler deploy --env production
```

---

### 3. Run the CLI (optional)

```bash
python dnsmo_cli.py
```

Example:

```text
dnsmo> register mike.users.example.com
dnsmo> post hello from DNS!
dnsmo> comment post123 nice post!
dnsmo> timeline
```

---

## 🧪 CLI Commands

| Command | Description |
|---------|-------------|
| `register <zone>` | Creates a new zone and publishes your pubkey |
| `post <text>` | Publishes a new signed post |
| `comment <postID> <text>` | Replies to a post |
| `like <postID>` | Likes a post or comment |
| `timeline` | Shows global feed (latest posts by all users) |
| `timeline <zone>` | Shows all posts by one user |
| `comments <postID>` | Shows comments under a post |
| `keys` | Show your public key |
| `exit` | Exit the CLI |

---

## 🧠 Federation Design

The worker dynamically crawls:

- `users.example.com` → fetch all user zones
- Each user zone → fetch latest post for global feed
- Comments and replies → parsed by DNS traversal

No `federation.json` is used — it’s all DNS-based.

---

## ✨ Planned Endpoints

- `GET /timeline` – global feed from all users
- `GET /timeline/:zone` – per-user feed
- `POST /register` – publish user zone + pubkey
- `POST /post/:zone` – publish signed post
- `POST /comment/:zone/:postID` – comment on a post
