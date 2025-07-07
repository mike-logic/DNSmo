# dnsmo_cli.py — Simple interactive CLI for DNSmo

import cmd
import time
import json
import base64
import hashlib
import requests
import nacl.signing

import os
API = os.getenv('DNSMO_API', 'https://api.example.com')

class DNSmoCLI(cmd.Cmd):
    intro = '\n📡 Welcome to DNSmo CLI. Type help or ? to list commands.'
    prompt = 'dnsmo> '

    def __init__(self):
        super().__init__()
        self.zone = None
        self.key = None
        self.pubkey_b64 = None

    def do_register(self, arg):
        """Register a new zone: register mike.users.usingthe.cloud"""
        self.zone = arg.strip()
        self.key = nacl.signing.SigningKey.generate()
        self.pubkey_b64 = base64.b64encode(self.key.verify_key.encode()).decode()
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
        sig = self.key.sign(content.encode()).signature
        sig_b64 = base64.b64encode(sig).decode()
        res = requests.post(f"{API}/post/{self.zone}", json={
            "content": content,
            "signature": sig_b64,
            "pubkey": self.pubkey_b64
        })
        print(res.json())

    def do_comment(self, arg):
        """Comment on a post: comment post12345.mike.users.usingthe.cloud nice post"""
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
        """Like a post or comment: like post12345.mike.users.usingthe.cloud"""
        if not self.zone or not self.key:
            print("❌ Must register first.")
            return
        item = arg.strip()
        voter = self.zone.split('.')[0]  # use subdomain as voter name
        msg = f"{voter}:{item}"
        sig = self.key.sign(msg.encode()).signature
        sig_b64 = base64.b64encode(sig).decode()
        res = requests.post(f"{API}/like/{self.zone}/{item}", json={
            "voter": voter,
            "signature": sig_b64,
            "pubkey": self.pubkey_b64
        })
        print(res.json())

    def do_timeline(self, arg):
        """Show timeline: timeline [zone] (or blank for global)"""
        zone = arg.strip()
        url = f"{API}/timeline/{zone}" if zone else f"{API}/timeline"
        res = requests.get(url)
        for post in res.json():
            ts = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(post['timestamp']/1000))
            print(f"[{ts}] {post.get('zone','')} {post['id']}: {post['content']}")

    def do_keys(self, arg):
        """Show your public key"""
        print(f"🔑 {self.pubkey_b64}")

    def do_exit(self, arg):
        return True

if __name__ == '__main__':
    DNSmoCLI().cmdloop()
