import cmd
import requests
import json
import base64
import time
import os
import shutil
import textwrap
import re
import nacl.signing

API_BASE = 'https://api.usingthe.cloud'
CONFIG_PATH = os.path.expanduser("~/.dnsmo")

def load_config():
    if not os.path.exists(CONFIG_PATH):
        os.makedirs(CONFIG_PATH)
    key_path = os.path.join(CONFIG_PATH, "key")
    zone_path = os.path.join(CONFIG_PATH, "zone")

    if os.path.exists(key_path) and os.path.exists(zone_path):
        with open(key_path, 'r') as f:
            key = nacl.signing.SigningKey(base64.b64decode(f.read().strip()))
        with open(zone_path, 'r') as f:
            zone = f.read().strip()
    else:
        print("🧠 Initializing DNSmo config...")
        zone = input("Choose your zone (e.g. alice.dnsmo.link): ").strip()
        key = nacl.signing.SigningKey.generate()
        with open(key_path, 'w') as f:
            f.write(base64.b64encode(key.encode()).decode())
        with open(zone_path, 'w') as f:
            f.write(zone)
        print(f"🔐 Key saved to {key_path}\n🌐 Zone saved to {zone_path}")
    return key, zone

MY_KEY, MY_ZONE = load_config()

def sign_payload(data):
    body = json.dumps(data, separators=(',', ':'), sort_keys=True, ensure_ascii=False).encode()
    signature = MY_KEY.sign(body).signature
    return base64.b64encode(signature).decode(), base64.b64encode(MY_KEY.verify_key.encode()).decode()

def pad_id(i): return f'post{i:03d}'
def pad_comment_id(i): return f'comment{i:03d}'

def get_terminal_width():
    return shutil.get_terminal_size((80, 20)).columns

def fetch_json(url):
    try:
        res = requests.get(url)
        if res.status_code == 200:
            return res.json()
        return None
    except Exception:
        return None

class DNSmoCLI(cmd.Cmd):
    intro = (
        "\n📡 Welcome to DNSmo CLI. Type help or ? to list commands.\n"
        "Type `menu` or `feed` to browse the feed with comments.\n"
        "\nLegend:\n"
        "  post <message> | ts=timestamp      → Create a new post\n"
        "  comment <zone> <postID> <msg>     → Add comment to post\n"
        "  timeline <zone>                   → List all posts in zone\n"
        "  comments <zone> <postID>          → Show comments for a post\n"
        "  postview <zone> <postID>          → View one post\n"
        "  verify post|comment <zone> <id>   → Validate existence\n"
        "  menu / feed                       → UI-style layout\n"
        "  exit                              → Quit\n"
    )
    prompt = 'dnsmo> '

    def do_comments(self, arg):
        """comments <zone> <postID>"""
        try:
            zone, postID = arg.strip().split()
        except ValueError:
            print("Usage: comments <zone> <postID>")
            return
        res = fetch_json(f"{API_BASE}/comment/{zone}/{postID}")
        if not res:
            print("No comments found.")
            return

        print(f"\n🧵 Comments on {postID}.{zone}")
        for c in res:
            record = c.get("records", {})
            if isinstance(record, dict) and "TXT" in record:
                txt = record["TXT"]
            elif isinstance(record, list):
                txt = "; ".join(record)
            else:
                txt = str(record)
            print(f"- {c['zone']} [{c['timestamp']}]\n  {txt}")

    def do_exit(self, arg):
        """Exit DNSmo CLI"""
        print("👋 Bye.")
        return True

    # Add your other methods (post, comment, timeline, menu, etc.) here
    # If you want I can paste the rest of them again too!

if __name__ == '__main__':
    DNSmoCLI().cmdloop()
