import json
import time
import base64
import requests
from collections import OrderedDict
from nacl.signing import SigningKey

# === CONFIG ===
PRIVATE_KEY_B64 = "<PRIVATE KEY>"
ZONE = "<DOMAIN ZONE>"
POST_KEY = "post000"

# === BUILD POST ===
timestamp = int(time.time())
post_value = f"hello from python | ts={timestamp}"

# === BUILD ORDERED PAYLOAD ===
records = OrderedDict()
records[POST_KEY] = post_value

payload = OrderedDict()
payload["zone"] = ZONE
payload["records"] = records
payload["timestamp"] = timestamp

# === SIGN PAYLOAD ===
canonical_json = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
signing_key = SigningKey(base64.b64decode(PRIVATE_KEY_B64))
signature = signing_key.sign(canonical_json.encode()).signature
signature_b64 = base64.b64encode(signature).decode()
public_key_b64 = base64.b64encode(signing_key.verify_key.encode()).decode()

# === FINAL BODY ===
request_data = OrderedDict(payload)  # clone signed fields
request_data["publicKey"] = public_key_b64
request_data["signature"] = signature_b64

# === DEBUG PRINT ===
print("\n--- FINAL REQUEST BODY ---")
print(json.dumps(request_data, indent=2))

# === POST ===
res = requests.post("https://<DOMAIN>/publish", json=request_data)

print("\n--- SERVER RESPONSE ---")
print("Status:", res.status_code)
print("Response:", res.text)

