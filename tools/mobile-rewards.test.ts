import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_DPI,DPI_STEPS,stickVector} from '../src/display';
import {defaults,parseSave} from '../src/state';
import {unlockGift,achievements} from '../src/reward-progress';
import {birthdayConfig} from '../content/birthday-config';
test('DPI migration preserves valid settings and rejects invalid values',()=>{
 assert.equal(DEFAULT_DPI,80);
 for(const scale of DPI_STEPS)assert.equal(parseSave(JSON.stringify({version:2,settings:{uiScale:scale}})).settings.uiScale,scale);
 for(const scale of [-1,0,49,161,1000,'80',null])assert.equal(parseSave(JSON.stringify({version:2,settings:{uiScale:scale}})).settings.uiScale,80);
});
test('joystick physical travel is invariant across DPI and its vector is bounded',()=>{
 for(const dpi of DPI_STEPS){const scale=dpi/100,v=stickVector(90,120,108,scale);assert.ok(Math.abs(Math.hypot(v.x,v.y)-1)<1e-9);assert.ok(Math.abs(Math.hypot(v.offsetX,v.offsetY)*scale-108*.32)<1e-9)}
 assert.deepEqual(stickVector(0,0,108,.8),{x:0,y:0,offsetX:0,offsetY:0});
});
test('wish all is idempotent and never invents wins or destroys previous scores',()=>{
 const s=defaults();s.games.moon={status:'won',score:420};
 for(let i=0;i<3;i++)for(const gift of birthdayConfig.gifts)unlockGift(s,gift.id);
 assert.equal(s.opened.length,12);assert.equal(s.inventory.length,12);assert.deepEqual(s.games.moon,{status:'won',score:420});assert.equal(s.games.letter.status,'skipped');assert.equal(s.snackPortions.chocolate,3);
 assert.equal(achievements.find(a=>a.id==='all-gifts')!.check(s),true);
});
test('resume validates coordinates and old explicit calendar choices survive migration',()=>{
 const raw={version:2,resume:{zone:'forest',x:320,y:250,boyX:340,boyY:250},calendar:{enabled:false,initialized:true,date:'2027-02-14',minutes:700}};
 assert.deepEqual(parseSave(JSON.stringify(raw)).resume,raw.resume);
 const s=parseSave(JSON.stringify(raw));assert.equal(s.calendar.enabled,false);assert.equal(s.calendar.date,'2027-02-14');assert.equal(s.calendar.minutes,700);
 assert.equal(parseSave(JSON.stringify({...raw,resume:{...raw.resume,x:-1}})).resume,undefined);
 assert.equal(defaults().calendar.date,'2026-11-23');assert.equal(defaults().calendar.enabled,true);
});
