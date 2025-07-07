# DNSmo CLI Template

This CLI allows you to interact with a DNSmo-compatible Worker backend for posting, commenting, and liking.

---

## ⚙️ Configuration

The CLI uses an environment variable for the API endpoint:

```bash
export DNSMO_API="https://api.example.com"
```

---

## 📦 Features

- Keypair generation and signing (Ed25519)
- Signed posts and comments
- Likes with voter identity
- Global or per-user timelines

---

## 🚀 Usage

```bash
python dnsmo_cli.py
```

You’ll enter an interactive prompt:

```
📡 Welcome to DNSmo CLI. Type help or ? to list commands.
dnsmo> register alice.users.example.com
dnsmo> post my first DNS post
dnsmo> timeline
dnsmo> comment post1751234567890 Nice one!
dnsmo> like post1751234567890
dnsmo> exit
```

---

## 💡 Notes

- Keys are held in memory only (for now)
- All actions are signed using your Ed25519 keypair
- Public keys are published in `pubkey.<zone>` DNS records