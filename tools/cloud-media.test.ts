import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCloudMedia} from '../content/cloud-media.mjs';

test('cloud media supports partial overrides and explicit removal',()=>{
 assert.equal(validateCloudMedia(undefined),undefined);
 assert.deepEqual(validateCloudMedia({memoryPhotos:[],moonImage:''}),{moonImage:'',memoryPhotos:[]});
 assert.deepEqual(validateCloudMedia({
  birthDateForMoon:'2024-02-29',
  labubuImage:'https://example.org/reveal.webp',
  concertAudio:'https://example.org/song.m4a',
  memoryPhotos:['https://example.org/memory.webp']
 }),{
  birthDateForMoon:'2024-02-29',labubuImage:'https://example.org/reveal.webp',
  concertAudio:'https://example.org/song.m4a',memoryPhotos:['https://example.org/memory.webp']
 });
});
test('cloud media rejects invalid dates, unbounded lists, credentials and unsafe URLs',()=>{
 for(const value of [
  {birthDateForMoon:'2025-02-29'}, {birthDateForMoon:'2024-04-31'},
  {moonImage:'javascript:alert(1)'}, {moonImage:'https://user:password@example.org/'},
  {memoryPhotos:['']}, {memoryPhotos:Array(25).fill('https://example.org/p.webp')}, {unknown:true}
 ]) assert.throws(()=>validateCloudMedia(value));
});
