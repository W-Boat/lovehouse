import test from 'node:test';
import assert from 'node:assert/strict';
import {beats,chooseCards,classify} from '../src/heartbeat-cards';
import {parseSave} from '../src/state';

test('landlord rules recognize rockets, bombs and consecutive pairs without including twos',()=>{
 const rocket=classify([52,53])!,bomb=classify([0,1,2,3])!,pairs=classify([0,1,4,5,8,9])!;
 assert.equal(rocket.kind,'rocket');assert.equal(bomb.kind,'bomb');assert.equal(pairs.kind,'pairs');
 assert.ok(beats(rocket,bomb));assert.ok(beats(bomb,pairs));assert.equal(beats(pairs,bomb),false);
 assert.equal(classify([32,36,40,44,48]),undefined);
 assert.equal(classify([0,1,2,4,5,6,8,12])?.kind,'plane-single');
});

test('hints only choose legal cards and pass when no play can beat the table',()=>{
 const hand=[4,5,8,9,12,13],next=chooseCards(hand,classify([0,1]));
 assert.deepEqual(next,[4,5]);
 assert.deepEqual(chooseCards(hand,classify([52,53])),[]);
});

test('old saves receive a workshop budget and settlement values survive reload',()=>{
 assert.deepEqual(parseSave('{"version":2}').workshop,{day:1,coins:12,best:0,stove:0});
 const state=parseSave('{"version":2,"workshop":{"day":3,"coins":24,"best":7,"stove":1},"jumpBest":14,"cardsWins":3}');
 assert.deepEqual(state.workshop,{day:3,coins:24,best:7,stove:1});
 assert.equal(state.jumpBest,14);assert.equal(state.cardsWins,3);
});
