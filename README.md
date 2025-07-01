
# 🌐 DNSmo — Decentralized, Encrypted Microblogging over DNS

DNSmo is a minimal, infrastructure-free microblogging system that stores encrypted posts, comments, votes, and profile data entirely in **DNS TXT records** under user-owned zones.

Built for **true decentralization**, DNSmo enables fully portable user identities, cryptographic ownership of content, and a feed constructed entirely from public DNS queries — no centralized servers or social networks.

---

## 🧠 Core Philosophy

- 📡 **Read = DNS only** — Content is read directly from the DNS using your system resolver or DoH.
- ✍️ **Write = Serverless proxy** — Writing goes through a small API (e.g., Cloudflare Worker) that updates DNS records.
- 🔐 **Encrypted to outsiders** — Only DNSmo-aware clients can decrypt and verify data.
- 👤 **User-owned zones** — Every user owns their domain (e.g., `alice.dnsmo.zone`) and all content beneath it.
- 📦 **Portable & forkable** — Users can export all their DNS content and spin up their own ecosystem.

---

## 📦 Directory Layout (Hierarchical DNS Zone)

Example: `alice.dnsmo.zone`

```
alice.dnsmo.zone
├── profile/
│   └── _profile TXT "pubkey=...|displayName=Alice"
├── posts/
│   ├── 20250701-abc123/
│   │   ├── 0 TXT "chunk0"
│   │   ├── 1 TXT "chunk1"
│   │   └── meta TXT "timestamp|sig|next"
├── comments/
│   ├── abc123-comment1/
│   │   ├── 0 TXT "chunk0"
│   │   └── meta TXT "timestamp|sig|next"
├── votes/
│   └── abc123-bob TXT "+1|bob_pubkey|sig"
└── head TXT "20250701-abc123"  # most recent post
```

All data is chunked and signed. Chronology is established through timestamps and `next` pointers.

---

## 🔐 Security Model

| Function   | Method                                      |
|------------|---------------------------------------------|
| Encryption | NaCl Sealed Box (X25519 + XSalsa20)         |
| Signing    | Ed25519                                     |
| Auth       | DNS updates via API key (scoped to writes)  |
| Visibility | Opaque outside DNSmo app, decrypted inside  |

- Posts, comments, votes: Encrypted and signed.
- Readers verify signatures against `_profile` public key.
- Posts are only visible to DNSmo-aware apps.

---

## 📇 DNS Record Types

### 📝 Posts

Stored as chunks under:
```
posts/{postID}/0 TXT "chunk0"
posts/{postID}/1 TXT "chunk1"
posts/{postID}/meta TXT "timestamp|sig|next"
```

Each `chunkX` contains a base64-encoded encrypted blob (max 255 chars per TXT record).

---

### 💬 Comments

Stored under:
```
comments/{postID}-{commentID}/0 TXT "chunk0"
comments/{postID}-{commentID}/meta TXT "timestamp|sig|next"
```

---

### 👍 Votes

Stored under:
```
votes/{postID}-{voter} TXT "+1|voter_pubkey|sig"
```

---

### 👤 Profile

```
profile/_profile TXT "pubkey=...|displayName=..."
```
