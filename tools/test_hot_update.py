import base64
import datetime
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from zipfile import ZipFile

from cryptography import x509
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.x509.oid import NameOID
from package_hot_update import create_package


class ResourcePackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'test only')])
        now = datetime.datetime.now(datetime.timezone.utc)
        cls.cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name)
                    .public_key(cls.key.public_key()).serial_number(1)
                    .not_valid_before(now - datetime.timedelta(days=1))
                    .not_valid_after(now + datetime.timedelta(days=1))
                    .sign(cls.key, hashes.SHA256()))

    def test_package_signature_and_every_file_match(self):
        with tempfile.TemporaryDirectory() as directory:
            build, output = Path(directory) / 'build', Path(directory) / 'output'
            build.mkdir()
            (build / 'index.html').write_text('<html>小屋</html>', encoding='utf8')
            (build / '游戏.js').write_bytes(b'game')
            manifest = create_package(build, output, 17, self.key, self.cert)
            envelope = json.loads((output / 'update.json').read_text())
            payload = base64.b64decode(envelope['payload'])
            signature = base64.b64decode(envelope['signature'])
            self.key.public_key().verify(signature, payload, padding.PKCS1v15(), hashes.SHA256())
            self.assertEqual(json.loads(payload), manifest)
            with self.assertRaises(InvalidSignature):
                self.key.public_key().verify(signature, payload + b' ', padding.PKCS1v15(), hashes.SHA256())
            archive = output / manifest['archive']
            self.assertEqual(hashlib.sha256(archive.read_bytes()).hexdigest(), manifest['archiveSha256'])
            with ZipFile(archive) as package:
                self.assertEqual(set(package.namelist()), set(manifest['files']))
                for name, metadata in manifest['files'].items():
                    data = package.read(name)
                    self.assertEqual(len(data), metadata['bytes'])
                    self.assertEqual(hashlib.sha256(data).hexdigest(), metadata['sha256'])

    def test_delta_blobs_are_addressed_by_content_and_deduplicated(self):
        with tempfile.TemporaryDirectory() as directory:
            build = Path(directory) / 'build'
            output = Path(directory) / 'output'
            build.mkdir()
            (build / 'index.html').write_bytes(b'entry')
            (build / 'one.txt').write_bytes(b'shared')
            (build / 'two.txt').write_bytes(b'shared')
            first = create_package(build, output, 1, self.key, self.cert)
            self.assertEqual(first['blobDirectory'], 'blobs/')
            self.assertEqual(len(list((output / 'blobs').iterdir())), 2)
            (build / 'index.html').write_bytes(b'updated entry')
            (build / 'two.txt').unlink()
            second = create_package(build, output, 2, self.key, self.cert)
            missing = {item['sha256'] for item in second['files'].values()} - {
                item['sha256'] for item in first['files'].values()
            }
            self.assertEqual(len(missing), 1)
            self.assertEqual((output / 'blobs' / missing.pop()).read_bytes(), b'updated entry')
            self.assertNotIn('two.txt', second['files'])

    def test_output_inside_resources_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            build = Path(directory)
            (build / 'index.html').write_text('game')
            with self.assertRaises(ValueError):
                create_package(build, build / 'updates', 1, self.key, self.cert)

    def test_hidden_files_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            build = Path(directory) / 'build'
            build.mkdir()
            (build / 'index.html').write_text('game')
            (build / '.env').write_text('private')
            with self.assertRaises(ValueError):
                create_package(build, Path(directory) / 'output', 1, self.key, self.cert)

    def test_a_different_certificate_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            build = Path(directory) / 'build'
            build.mkdir()
            (build / 'index.html').write_text('game')
            other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
            with self.assertRaises(ValueError):
                create_package(build, Path(directory) / 'output', 1, other_key, self.cert)


if __name__ == '__main__':
    unittest.main()
