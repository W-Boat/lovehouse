"""Publish the signed Android update directory produced by GitHub Actions."""
import argparse
import hashlib
import json
import os
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


def publish(folder, base, token):
    parsed = urlsplit(base)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.query or parsed.fragment:
        raise ValueError('Use an HTTPS publisher base URL')
    base = base.rstrip('/') + '/'
    endpoint = base + 'admin/api/android-update/'

    def post(path, stream, size, content_type):
        request = Request(endpoint + path, data=stream, method='POST', headers={
            'Authorization': 'Bearer ' + token, 'Content-Length': str(size), 'Content-Type': content_type,
        })
        try:
            with urlopen(request, timeout=180) as response:
                return json.load(response)
        except HTTPError as error:
            detail = json.loads(error.read(8192)).get('error', error.reason)
            raise RuntimeError(f'HTTP {error.code}: {detail}') from None

    for asset in sorted((folder / 'blobs').iterdir()):
        with asset.open('rb') as stream:
            if hashlib.file_digest(stream, 'sha256').hexdigest() != asset.name:
                raise ValueError(f'Invalid resource file: {asset.name}')
            stream.seek(0)
            post('blobs/' + asset.name, stream, asset.stat().st_size, 'application/octet-stream')
    manifest = folder / 'update.json'
    with manifest.open('rb') as stream:
        return post('publish', stream, manifest.stat().st_size, 'application/json')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('directory', type=Path)
    parser.add_argument('base')
    args = parser.parse_args()
    print(json.dumps(publish(args.directory, args.base, os.environ['LOVEHOUSE_ADMIN_TOKEN'])))
