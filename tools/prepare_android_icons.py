"""Export launcher resources from the imagegen master without changing the master."""
from pathlib import Path
from math import hypot
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = Image.open(root / 'tools/android-icon-source.png').convert('RGBA')
size = max(source.size)
center = (source.width / 2, source.height / 2)
extent = max(hypot(x - center[0], y - center[1])
             for y in range(source.height) for x in range(source.width)
             if source.getpixel((x, y))[3] > 64)
# Keep every visible roof and wall inside Android's central safe circle.
scale = min(1, size * .30 / extent)
small = source.resize((round(source.width * scale), round(source.height * scale)), Image.Resampling.NEAREST)
foreground = Image.new('RGBA', (size, size))
foreground.alpha_composite(small, ((size - small.width) // 2, (size - small.height) // 2))
resources = root / 'android/app/src/main/res'

def write(relative, data):
    path = resources / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(data, str):
        path.write_text(data, encoding='utf8')
    else:
        data.save(path, optimize=True)

fore = foreground.resize((432, 432), Image.Resampling.NEAREST)
write('drawable-xxxhdpi/launcher_foreground.png', fore)
mono = Image.new('RGBA', fore.size, 'white')
mono.putalpha(fore.getchannel('A'))
write('drawable-xxxhdpi/launcher_monochrome.png', mono)
write('values/launcher_colors.xml', '<resources><color name="launcher_background">#263E3B</color></resources>')
for density, pixels in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
    icon = Image.new('RGBA', (pixels, pixels), '#263E3B')
    cottage = foreground.crop(foreground.getbbox())
    cottage.thumbnail((round(pixels * .8), round(pixels * .8)), Image.Resampling.NEAREST)
    icon.alpha_composite(cottage, ((pixels - cottage.width) // 2, (pixels - cottage.height) // 2))
    write(f'mipmap-{density}/ic_launcher.png', icon)
adaptive = ('<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">'
            '<background android:drawable="@color/launcher_background"/>'
            '<foreground android:drawable="@drawable/launcher_foreground"/>{}</adaptive-icon>')
write('mipmap-anydpi-v26/ic_launcher.xml', adaptive.format(''))
write('mipmap-anydpi-v33/ic_launcher.xml', adaptive.format('<monochrome android:drawable="@drawable/launcher_monochrome"/>'))
print('Exported legacy, adaptive and monochrome Android launcher icons.')
