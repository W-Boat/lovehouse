import test from 'node:test';
import assert from 'node:assert/strict';
import {letterPieces,snapPaper,paperContains} from '../src/letter-puzzle';
test('three irregular letter layouts completely cover the envelope without square slots',()=>{
 const signatures=new Set<string>();for(let level=0;level<3;level++){const pieces=letterPieces(level);assert.equal(pieces.length,6);const area=pieces.reduce((sum,p)=>sum+Math.abs(p.outline.reduce((n,v,i,a)=>n+v.x*a[(i+1)%a.length].y-v.y*a[(i+1)%a.length].x,0))/2,0);assert.equal(area,220*218);signatures.add(JSON.stringify(pieces.map(p=>p.outline)));for(const p of pieces){assert.equal(paperContains(p,{x:p.x,y:p.y}),true);assert.equal(paperContains(p,{x:p.x+200,y:p.y+200}),false)}}assert.equal(signatures.size,3);
});
test('letter scraps snap only near their matching contour with correct rotation, scoring only once',()=>{
 const p=letterPieces(0)[0];p.x=p.target.x;p.y=p.target.y;p.rotation=1;assert.equal(snapPaper(p),false);p.rotation=0;p.x+=50;assert.equal(snapPaper(p),false);p.x=p.target.x+10;p.y=p.target.y-9;assert.equal(snapPaper(p),true);assert.deepEqual({x:p.x,y:p.y},p.target);assert.equal(p.placed,true);assert.equal(snapPaper(p),false);
});
