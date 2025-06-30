# 📡 Encrypted DNS-Based Microblogging Platform

A minimal, decentralized microblogging system that uses **DNS TXT records** to store encrypted posts, votes, and comments. The Android app interacts with a **serverless proxy** to write content to DNS (e.g., via Cloudflare's API), and reads directly from DNS to display public or encrypted content.

---

## 🧠 Core Concepts

### ✅ Data Storage via DNS

- **Posts, votes, comments** are stored in **TXT records** under structured subdomains.
- DNS is globally readable and resilient, with no traditional backend.
- Writes go through a **minimal serverless endpoint** (e.g. Cloudflare Worker).

### 🔐 End-to-End Encryption

- All content is encrypted using **public-key cryptography** (NaCl sealed boxes).
- Every post is **signed** with the author's private key (Ed25519).
- Only recipients with the right decryption key can view content.

### 📱 App-Centric UX

- The Android app handles encryption, DNS lookups, and interactions.
- Posts, votes, and comments are composed and pushed via API.
- Profiles are browsed by walking post chains.

---

## 🧩 Data Structure

### 📝 Posts

- Stored at: `0.postID.username.example.com`, `1.postID.username.example.com`, etc.
- Metadata at: `meta.postID.username.example.com`
- Each chunk holds up to 255 bytes of base64-encoded encrypted data.

**Example Records:**

```
0.abc123.alice.example.com TXT "chunk0"
1.abc123.alice.example.com TXT "chunk1"
meta.abc123.alice.example.com TXT "timestamp|nextPostID|hash"
```

### 📇 Profile

```
head.alice.example.com TXT "abc123"  # points to most recent post
_profile.alice.example.com TXT "pubkey=...|displayName=..."
```

### 👍 Votes

Stored as signed TXT records:

```
vote0.abc123.alice.example.com TXT "bob_pubkey|+1|sig"
vote1.abc123.alice.example.com TXT "carol_pubkey|-1|sig"
```

### 💬 Comments

```
comment0.abc123.alice.example.com TXT "chunk0"
meta.comment0.abc123.alice.example.com TXT "timestamp|sig|next"
```

---

## 🔐 Security Model

| Function   | Method                                    |
| ---------- | ----------------------------------------- |
| Encryption | NaCl Sealed Box (X25519 + XSalsa20)       |
| Signing    | Ed25519                                   |
| Encoding   | Base64 for DNS safety                     |
| Auth       | DNS updates via scoped API token or proxy |

- Every post is encrypted and signed.
- Readers verify integrity via public keys in the profile zone.
- No plaintext visible to DNS resolver, ISP, or snooper.

---

## 📲 App Responsibilities

### Reading:

1. Query `head.username.example.com` → get postID.
2. Fetch `0.postID.*`, `1.postID.*`, `meta.*`.
3. Follow `nextPostID` to walk the feed.
4. Fetch and verify `vote*`, `comment*` subdomains.
5. Decrypt and render valid content.

### Writing:

1. App encrypts and signs content.
2. Splits into 255-byte chunks.
3. Sends JSON to serverless endpoint:

```json
{
  "user": "alice",
  "postID": "abc123",
  "chunks": ["chunk0", "chunk1"],
  "meta": { "timestamp": 1727382881, "next": null }
}
```

4. Proxy updates DNS records via Cloudflare API.

---

## ⚙️ Serverless Proxy

A Cloudflare Worker or similar handles authenticated DNS writes:

- Accepts signed payload from app
- Validates format
- Calls Cloudflare API to update zone TXT records

Supports:

- Post creation
- Voting
- Commenting

---

## 🛠️ Roadmap

-

---

## 📂 Example Zones

```
head.alice.example.com                → "abc123"
0.abc123.alice.example.com           → "SGVsbG8g..."
meta.abc123.alice.example.com        → "ts|null|hash"
vote0.abc123.alice.example.com       → "bob_pubkey|+1|sig"
comment0.abc123.alice.example.com    → "comment blob"
```

---

## 📖 License

MIT or permissive open source license. Build your own clones or clients.

---

## 🙋 Want Help?

This is an early-stage protocol — feel free to fork it, build your own zone, or expand on the format. Contributions, client apps, and write proxies welcome.

---

