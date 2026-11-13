"""Check that the APK embeds the exact production build."""
from pathlib import Path
from sys import argv
from zipfile import ZipFile
import hashlib

build = Path('dist')
with ZipFile(argv[1]) as apk:
    entries = set(apk.namelist())
    required = ['index.html', 'assets/fonts/core.woff2', 'assets/cottage.webp',
                'taoyuan/index.html', 'taoyuan/LICENSE']
    for name in required:
        assert f'assets/{name}' in entries, f'Missing offline asset: {name}'
    assert sum(name.startswith('assets/assets/seasons/') and name.endswith('.webp')
               for name in entries) == 72
    for file in build.rglob('*'):
        if file.is_file():
            name = 'assets/' + file.relative_to(build).as_posix()
            assert hashlib.sha256(apk.read(name)).digest() == hashlib.sha256(file.read_bytes()).digest(), name
    print(f'Validated {len(entries)} APK entries and every production asset.')
