"""Build signed offline resource updates for the Android content loader."""
import argparse
import base64
import hashlib
import json
import os
import time
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.serialization import pkcs12


def create_package(build, output, version, key, certificate):
    build, output = Path(build).resolve(), Path(output).resolve()
    if not (build / 'index.html').is_file():
        raise ValueError('Production index.html is required')
    if output == build or build in output.parents:
        raise ValueError('Update output must be outside the resource directory')
    if not isinstance(key, rsa.RSAPrivateKey):
        raise ValueError('The Android update signing key must use RSA')
    if certificate.public_key().public_numbers() != key.public_key().public_numbers():
        raise ValueError('The resource signing key and certificate must match')
    if not isinstance(version, int) or version < 1:
        raise ValueError('Update version must be a positive integer')
    output.mkdir(parents=True, exist_ok=True)
    archive = output / 'lovehouse-content.zip'
    staging = archive.with_suffix('.zip.stage')
    files = {}
    blobs = output / 'blobs'
    blobs.mkdir(exist_ok=True)
    try:
        with ZipFile(staging, 'w', compression=ZIP_DEFLATED, compresslevel=6) as package:
            for path in sorted(build.rglob('*')):
                if path.is_symlink():
                    raise ValueError('Update resources must not contain symlinks')
                if not path.is_file():
                    continue
                relative = path.relative_to(build).as_posix()
                if '\\' in relative or ':' in relative:
                    raise ValueError('Invalid resource path')
                if any(part.startswith('.') for part in Path(relative).parts):
                    raise ValueError('Hidden files are not update resources')
                data = path.read_bytes()
                files[relative] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
                blob = blobs / files[relative]['sha256']
                if not blob.is_file() or blob.read_bytes() != data:
                    temp_blob = blob.with_suffix('.stage')
                    temp_blob.write_bytes(data)
                    os.replace(temp_blob, blob)
                entry = ZipInfo(relative, date_time=(1980, 1, 1, 0, 0, 0))
                entry.compress_type = ZIP_DEFLATED
                entry.external_attr = 0o100644 << 16
                package.writestr(entry, data)
        os.replace(staging, archive)
    finally:
        staging.unlink(missing_ok=True)
    with archive.open('rb') as stream:
        archive_hash = hashlib.file_digest(stream, 'sha256').hexdigest()
    manifest = {
        'format': 1,
        'builtAt': int(time.time()),
        'version': version,
        'requiredNativeApi': 1,
        'entry': 'index.html',
        'archive': archive.name,
        'archiveBytes': archive.stat().st_size,
        'archiveSha256': archive_hash,
        'certificateSha256': certificate.fingerprint(hashes.SHA256()).hex(),
        'files': files,
        'blobDirectory': 'blobs/',
    }
    payload = json.dumps(manifest, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()
    signature = key.sign(payload, padding.PKCS1v15(), hashes.SHA256())
    envelope = {
        'payload': base64.b64encode(payload).decode(),
        'signature': base64.b64encode(signature).decode(),
    }
    target = output / 'update.json'
    stage = target.with_suffix('.json.stage')
    stage.write_text(json.dumps(envelope, separators=(',', ':')), encoding='utf8')
    os.replace(stage, target)
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--build', default='dist')
    parser.add_argument('--output', default='hot-update-delivery')
    parser.add_argument('--version', type=int, required=True)
    args = parser.parse_args()
    key, cert, _ = pkcs12.load_key_and_certificates(
        Path(os.environ['ANDROID_KEYSTORE_PATH']).read_bytes(),
        os.environ['ANDROID_KEYSTORE_PASSWORD'].encode(),
    )
    manifest = create_package(args.build, args.output, args.version, key, cert)
    print('Signed resource update', manifest['version'], manifest['archiveBytes'], 'bytes')
