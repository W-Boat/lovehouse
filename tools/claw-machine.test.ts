import test from 'node:test';import assert from 'node:assert/strict';import {ClawMachine} from '../src/claw-machine';
test('coarse and fine frames reach the same contact and carrying pose',()=>{
 const fine=new ClawMachine(300),slow=new ClawMachine(300);fine.press();slow.press();
 for(let i=0;i<300;i++)fine.advance(.01);slow.advance(3);
 assert.equal(fine.phase,'carry');assert.equal(slow.phase,'carry');assert.equal(fine.hasDoll,slow.hasDoll);assert.equal(fine.y,slow.y);assert.ok(Math.abs(fine.time-slow.time)<1e-8);
});
test('the prize cannot be delivered or moved while the lift is unfinished',()=>{
 const machine=new ClawMachine(300);machine.press();machine.advance(1.3);assert.equal(machine.phase,'rise');assert.equal(machine.hasDoll,true);
 machine.move(70);assert.equal(machine.x,300);assert.equal(machine.press(),false);
 machine.advance(1.3);assert.equal(machine.phase,'carry');machine.move(70);assert.equal(machine.press(),true);
});
test('missing the prize returns to aim, and assistance starts on the third attempt',()=>{
 const machine=new ClawMachine(300);machine.move(365);
 for(let i=0;i<2;i++){machine.press();machine.advance(3);assert.equal(machine.hasDoll,false);assert.equal(machine.phase,'aim')}
 machine.press();machine.advance(3);assert.equal(machine.tries,3);assert.equal(machine.phase,'carry');
});
