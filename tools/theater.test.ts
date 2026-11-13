import test from 'node:test';
import assert from 'node:assert/strict';
import {films,filmMoment,concertSection,rideProgress} from '../content/films';
test('three distinct shorts have complete bounded timelines with reachable final shots',()=>{
 const signatures=new Set<string>();for(const [id,spec] of Object.entries(films)){
  assert.ok(spec.duration>=60&&spec.duration<=90);assert.equal(spec.shots.reduce((n,s)=>n+s.seconds,0),spec.duration);
  signatures.add(spec.shots.map(s=>s.action).join(','));let boundary=0;
  for(let i=0;i<spec.shots.length;i++){assert.equal(filmMoment(id as keyof typeof films,boundary).index,i);boundary+=spec.shots[i].seconds;}
  const final=filmMoment(id as keyof typeof films,10000);assert.equal(final.index,spec.shots.length-1);assert.equal(final.progress,1);assert.equal(filmMoment(id as keyof typeof films,-1).progress,0);
 }assert.equal(signatures.size,3);
});
test('concert progresses through countdown, distinct performance sections and curtain in 90 seconds',()=>{
 assert.deepEqual([0,6,28,55,79,87,90].map(concertSection),['countdown','opening','verse','climax','bow','curtain','curtain']);
});
test('wheel boards at ground, pauses at the summit and completes an upright cabin circuit',()=>{
 assert.equal(rideProgress(0),0);assert.equal(rideProgress(5),0);assert.equal(rideProgress(25),.5);assert.equal(rideProgress(30),.5);assert.equal(rideProgress(35),.5);assert.equal(rideProgress(55),1);assert.equal(rideProgress(70),1);
 for(let n=0;n<60;n++)assert.ok(rideProgress(n+1)>=rideProgress(n));
});
