# generate_keys.py

from nacl.signing import SigningKey
import base64

signing_key = SigningKey.generate()
verify_key = signing_key.verify_key

print("Private key (save this!):")
print(base64.b64encode(signing_key.encode()).decode())

print("\nPublic key:")
print(base64.b64encode(verify_key.encode()).decode())

