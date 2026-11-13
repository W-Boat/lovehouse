import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCloudPlaylist} from '../content/cloud-playlist.mjs';
import {parseSave} from '../src/state';
import {defaultMusicConfig} from '../src/music-config';
import {findPath} from '../src/navigation';
import {worlds} from '../src/world';

test('both Ferris boarding points have walkable routes from the scene entrance',()=>{
 const zone=worlds.ferris;
 for(const [x,y] of [[309,327],[331,327]]){
  assert.equal(zone.walkable({x,y}),true);
  assert.deepEqual(findPath({x:zone.spawn[0],y:zone.spawn[1]},{x,y},zone.walkable).at(-1),{x,y});
 }
});
test('cloud playlists accept HTTPS and shipped media, with the same validation as the CLI',()=>{
 assert.equal(validateCloudPlaylist(undefined),undefined);
 const playlist={mode:'online',server:'netease',type:'playlist',id:'123',api:'https://example.org/?id=:id'};
 assert.equal(validateCloudPlaylist(playlist)?.id,'123');
 assert.throws(()=>validateCloudPlaylist({...playlist,api:'http://example.org/'}));
 const track={name:'Moonlight',artist:'Scott Buckley',url:'audio/moonlight.m4a',cover:'',lrc:''};
 assert.deepEqual(validateCloudPlaylist({mode:'offline',localTracks:[track]})?.localTracks,[track]);
 assert.throws(()=>validateCloudPlaylist({mode:'offline',localTracks:[{...track,url:'assets/../bad'}]}));
});
test('older custom playlists keep priority while original default follows published playlist',()=>{
 const musicRoom=defaultMusicConfig();
 assert.equal(parseSave(JSON.stringify({version:2,musicRoom})).musicRoomSource,'cloud');
 assert.equal(parseSave(JSON.stringify({version:2,musicRoom:{...musicRoom,id:'123'}})).musicRoomSource,'local');
 assert.equal(parseSave(JSON.stringify({version:2,musicRoom,musicRoomSource:'local'})).musicRoomSource,'local');
});
