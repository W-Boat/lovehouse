import {readFileSync,statSync,readdirSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {coreTextureKeys,textureFiles} from '../src/assets';
const bytes=(p:string)=>statSync(p).size;
const coreTextureBytes=coreTextureKeys.reduce((n,k)=>n+bytes('public/assets/'+textureFiles[k]),0);
const entryFiles=['dist/index.html',...readdirSync('dist/assets').filter(f=>f!=='fonts.css'&&/\.(js|css)$/.test(f)).map(f=>'dist/assets/'+f)];
const compressedEntryBytes=entryFiles.reduce((n,f)=>n+gzipSync(readFileSync(f)).byteLength,0);
const fontCssBytes=gzipSync(readFileSync('public/assets/fonts.css')).byteLength;
const fixedFontBytes=bytes('public/assets/fonts/core.woff2'),loaderBytes=bytes('public/assets/loading-cottage.webp');
writeFileSync('docs/performance.json',JSON.stringify({
 coreTextureBytes,coreTextureKeys,fixedFontBytes,loaderBytes,compressedEntryBytes,fontCssBytes,
 estimatedCoreWithHttpCompressionBytes:coreTextureBytes+fixedFontBytes+loaderBytes+compressedEntryBytes+fontCssBytes,
 estimateNotes:'Static byte estimate. HTTP compression depends on the selected host; not a measured network transfer. Excludes delayed music, adjacent-scene prefetch and optional name-font chunks.',
 mobilePhysicalDeviceTest:'not performed; browser emulation does not substitute for devices',
 fps:'not measured on physical devices',
},null,2));
