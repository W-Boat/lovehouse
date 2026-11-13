"""Verify the distributable uses the project's stable Android certificate."""
from pathlib import Path
import os
import re
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
signer = Path(os.environ['ANDROID_HOME']) / 'build-tools/35.0.0/apksigner'
result = subprocess.check_output([str(signer), 'verify', '--print-certs', sys.argv[1]], text=True)
certificates = re.findall(r'certificate SHA-256 digest:\s*([0-9a-fA-F]+)', result)
expected = (root / 'docs/android-signing-cert.sha256').read_text().strip()
assert certificates == [expected], 'Android signing certificate differs from the fixed release certificate'
print('Verified fixed Android certificate SHA256', expected)
