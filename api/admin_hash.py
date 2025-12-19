import hashlib

password = "admin"

# MD5
md5_hash = hashlib.md5(password.encode()).hexdigest()

# SHA256
sha256_hash = hashlib.sha256(password.encode()).hexdigest()

print("MD5:", md5_hash)
print("SHA256:", sha256_hash)
