# dnsmo_cli.py — DNSmo CLI with metadata-aware timeline display

import cmd
import time
import json
import base64
import os
import requests
import nacl.signing

API = 'https://api.usingthe.cloud'
KEY_FILE = 'dnsmo_key.json'

class DNSmoCLI(cmd.Cmd):
    intro = '\n📡 Welcome to DNSmo CLI. Type help or ? to list commands.'
    prompt = 'dnsmo> '

    def __init__(self):
        super().__init__()
        self.zone = None
        self.key = None
        self.pubkey_b64 = None
        self.load_key()

    def load_key(self):
        if os.path.exists(KEY_FILE):
            try:
                with open(KEY_FILE, 'r') as f:
                    data = json.load(f)
                    self.zone = data['zone']
                    self.pubkey_b64 = data['pubkey']
                    self.key = nacl.signing.SigningKey(base64.b64decode(data['privkey']))
            except Exception as e:
                print(f"\n⚠️ Invalid or corrupted key file: {e}")
                print("🔁 Please re-register.\n")

    def save_key(self):
        data = {
            'zone': self.zone,
            'pubkey': self.pubkey_b64,
            'privkey': base64.b64encode(self.key.encode()).decode()
        }
        with open(KEY_FILE, 'w') as f:
            json.dump(data, f)

    def do_register(self, arg):
        """Register a new zone: register mike.users.example.com"""
        self.zone = arg.strip()
        self.key = nacl.signing.SigningKey.generate()
        self.pubkey_b64 = base64.b64encode(self.key.verify_key.encode()).decode()
        self.save_key()

        res = requests.post(f"{API}/register", json={
            "zone": self.zone,
            "pubkey": self.pubkey_b64
        })

        if res.ok:
            print(f"✅ Registered zone: {self.zone}")
        else:
            print(f"❌ Failed: {res.text}")

    def do_post(self, arg):
        """Post a message: post hello world"""
        if not self.zone or not self.key:
            print("❌ Must register first.")
            return

        content = arg.strip()
        if not content:
            print("❌ Cannot post empty content.")
            return

        sig = self.key.sign(content.encode()).signature
        sig_b64 = base64.b64encode(sig).decode()

        body = {
            "content": content,
            "signature": sig_b64,
            "pubkey": self.pubkey_b64
        }

        print(f"\n🛰️ Posting to: {API}/post/{self.zone}")
        print(f"🔐 Local pubkey: {self.pubkey_b64}")
        dns_pub = resolve_dns_pubkey(self.zone)
        print(f"📡 DNS pubkey:   {dns_pub}")
        print(f"\n📤 Post body:\n{json.dumps(body, indent=2)}")

        res = requests.post(f"{API}/post/{self.zone}", json=body)

        try:
            print(res.json())
        except Exception:
            print("❌ Error: Server did not return valid JSON")
            print(res.text)

    def do_comment(self, arg):
        """Comment on a post: comment post12345.zone your message"""
        if not self.zone or not self.key:
            print("❌ Must register first.")
            return
        try:
            target, *words = arg.strip().split()
            content = ' '.join(words)
            sig = self.key.sign(content.encode()).signature
            sig_b64 = base64.b64encode(sig).decode()
            res = requests.post(f"{API}/comment/{self.zone}/{target}", json={
                "content": content,
                "signature": sig_b64,
                "pubkey": self.pubkey_b64
            })
            print(res.json())
        except Exception as e:
            print(f"❌ Usage: comment postId comment text\nError: {e}")

    def do_like(self, arg):
        """Like a post or comment: like post12345.zone"""
        if not self.zone or not self.key:
            print("❌ Must register first.")
            return
        try:
            item = arg.strip().split()[0]
        except IndexError:
            print("❌ Usage: like post12345.zone")
            return

        voter = self.zone.split('.')[0]
        msg = f"{voter}:{item}"
        sig = self.key.sign(msg.encode()).signature
        sig_b64 = base64.b64encode(sig).decode()
        res = requests.post(f"{API}/like/{self.zone}/{item}", json={
            "voter": voter,
            "signature": sig_b64,
            "pubkey": self.pubkey_b64
        })
        try:
            print(res.json())
        except Exception:
            print("❌ Error: Server did not return valid JSON")
            print(res.text)

    def do_timeline(self, arg):
        """Show timeline: timeline [zone] (or blank for global)"""
        zone = arg.strip()
        url = f"{API}/timeline/{zone}" if zone else f"{API}/timeline"
        res = requests.get(url)
        try:
            for post in res.json():
                ts = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(post['timestamp'] / 1000))
                print(f"[{ts}] {post.get('zone', '')} {post['id']}: {post['content']}")
                if 'likes' in post or 'comments' in post:
                    print(f"  👍 Likes: {post.get('likes', 0)}   💬 Comments: {post.get('comments', 0)}")
        except Exception:
            print("❌ Could not parse timeline response.")
            print(res.text)

    def do_keys(self, arg):
        """Show your public key"""
        print(f"🔑 {self.pubkey_b64}")

    def do_exit(self, arg):
        return True

def resolve_dns_pubkey(zone):
    try:
        res = requests.get(f"https://cloudflare-dns.com/dns-query?name=pubkey.{zone}&type=TXT", headers={"accept": "application/dns-json"})
        data = res.json()
        answers = data.get("Answer", [])
        for a in answers:
            raw = a["data"].strip('"')
            if raw.startswith("key="):
                return raw[4:]
    except Exception as e:
        return f"(lookup failed: {e})"
    return "(not found)"

if __name__ == '__main__':
    DNSmoCLI().cmdloop()
