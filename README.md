# DNSmo Worker

This project implements a [DNSmo](https://github.com/dnsmo) federation-compatible endpoint using **Cloudflare Workers**, with optional Ed25519 signing and hierarchical comments.

DNSmo is a decentralized publishing system that uses DNS-style zones as personal namespaces. Each user publishes signed posts into their zone, served via HTTP or federation APIs. This Worker provides an easy gateway to interact with that system.

---

## ✅ Features

- **Post creation** (`post000`, `post001`, ...)
- **Signed publishing** with Ed25519 keys
- **Threaded-style comments** via hierarchical zone names
- **Reply chaining** (e.g. reply to post, or to a comment)
- **Comment count API**
- **Federation discovery** at `/federation.json`
- **Record resolution** via `/resolve/{zone}`
- **Flat zone design** backed by Cloudflare KV

---

## 📦 Contents

```
dnsmo-worker/
├── index.js           # Cloudflare Worker logic (handles publishing + federation)
├── wrangler.toml      # Worker deployment config (you must customize this)
├── dnsmo_cli.py       # Interactive command-line client
├── generate_keys.py   # Ed25519 keypair generator
```

---

## 🧠 How DNSmo Works

- A *zone* is your namespace (e.g. `alice.example.com`)
- Posts are stored as `TXT`-style key-value records (`post000`, `post001`, ...)
- Comments are stored as nested zones (`comment000.post000.alice.example.com`)
- All messages are **signed with an Ed25519 keypair**
- Federation endpoints **validate and serve content** using `/resolve`
- The CLI tool helps you post, comment, and fetch data interactively

---

## 🚀 Quickstart

### 1. Install dependencies

```bash
pip install pynacl requests
```

---

### 2. Generate your signing key

```bash
python generate_keys.py
```

This creates a `~/.dnsmo.key` file and shows your public key.

---

### 3. Run the CLI client

```bash
python dnsmo_cli.py
```

You'll see:

```text
📡 Welcome to DNSmo CLI. Type help or ? to list commands.
dnsmo>
```

---

### 4. Post something

```text
dnsmo> post hello from DNSmo | ts=1751500000
```

Creates `post000.yourdomain.com` (or `post001`, etc).

---

### 5. Comment on a post

```text
dnsmo> comment yourdomain.com post000 this is a comment | ts=1751500050
```

Creates `comment000.post000.yourdomain.com`

---

### 6. Reply to a comment

```text
dnsmo> comment yourdomain.com comment000.post000 this is a reply
```

Creates `comment000.comment000.post000.yourdomain.com`

---

### 7. View all comments

```text
dnsmo> comments yourdomain.com post000
```

Returns a flattened tree of replies to that post or comment.

---

## 💬 CLI Commands

| Command | Description |
|--------|-------------|
| `post <text> | ts=<timestamp>` | Create a new post in your zone |
| `comment <zone> <parentID> <text> | ts=<timestamp>` | Comment on a post or comment |
| `comments <zone> <postID>` | View all comments for a post (recursive) |
| `exit` | Exit the CLI |

### Example

```bash
dnsmo> post my first post | ts=1751550000
dnsmo> comment yourzone.com post000 hello!
dnsmo> comment yourzone.com comment000.post000 replying to your comment!
dnsmo> comments yourzone.com post000
```

---

## 🧠 Worker Logic

- `GET /federation.json` returns federation policy:
  ```json
  {
    "allow": true,
    "pingback": "https://api.example.com/publish",
    "whitelist": ["example.com"]
  }
  ```

- `POST /publish` accepts signed posts:
  ```json
  {
    "zone": "post000.example.com",
    "records": { "TXT": "hello world" },
    "timestamp": 1234567890,
    "publicKey": "...",
    "signature": "..."
  }
  ```

- `GET /resolve/{zone}` returns:
  ```json
  {
    "records": {
      "post000": "hello world"
    },
    "timestamp": 1234567890,
    "publicKey": "...",
    "signature": "..."
  }
  ```

- `GET /comment/{zone}/{postID}` returns a flat list of comments (including replies)

- `GET /comment/{zone}/{postID}?count=true` returns:
  ```json
  { "count": 3 }
  ```

---

## 🛠 Configuration

### ✅ Edit `index.js`

```js
const CONFIG = {
  federation: {
    allow: true,
    pingback: 'https://api.example.com/publish',
    whitelist: ['yourzone.com']
  },
  kvPrefix: 'dnsmo:',
};
```

---

### ✅ Edit `wrangler.toml`

```toml
name = "dnsmo-worker"
main = "index.js"
compatibility_date = "2024-07-01"

[[kv_namespaces]]
binding = "DNSMO"
id = "your-kv-id"
preview_id = "your-preview-id"

[env.production]
route = "api.yourdomain.com/*"
zone_id = "your-zone-id"
```

Get your KV ID with:

```bash
wrangler kv:namespace create DNSMO
```

---

### ✅ Deploy the Worker

```bash
wrangler deploy --env production
```

---

## 🔐 Signature Spec

Each published message must include:

```json
{
  "zone": "yourname.example.com",
  "records": {
    "post000": "hello world"
  },
  "timestamp": 1234567890,
  "publicKey": "<base64-ed25519-pubkey>",
  "signature": "<base64-ed25519-signature>"
}
```

Signature is created over this canonical JSON:

```json
{ "records": ..., "timestamp": ..., "zone": ... }
```

Sorted keys, UTF-8, no whitespace.

---

## 🔁 Comments & Replies

- All comments are just nested posts using DNS-style naming
- You can reply to a post or to another comment
- Structure is always: `comment###.parentID.zone`
- Replies are recursively returned via the `/comment` API

---

## 🚫 Deletion

- Posts and comments are **immutable**
- A deleted comment may be replaced with:
  ```
  This comment has been deleted.
  ```
  (future implementation)

---

## 🧪 Planned Features

- Optional moderation/permissions via signature origin
- Basic moderation logic (admin keys, deletions)
- Reply nesting indicator (not visual threading)
- Post pagination / time filtering

---

## 📄 License

MIT

---

## 🌐 Project Links

- DNSmo Protocol: [github.com/dnsmo](https://github.com/dnsmo)
- Cloudflare Workers: [developers.cloudflare.com](https://developers.cloudflare.com/workers/)