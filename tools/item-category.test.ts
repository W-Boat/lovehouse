import test from 'node:test';
import assert from 'node:assert/strict';
import {isSeatItem} from '../src/item-category';
import {worlds} from '../src/world';
test('replacing action wording cannot change a chair into a generic map object',()=>{
 const chair=worlds.room.items.find(item=>item.id==='chair-left')!;
 assert.ok(chair);assert.equal(isSeatItem('room',{...chair,action:'Take a break'}),true);
 const fire=worlds.room.items.find(item=>item.id==='fireplace')!;
 assert.equal(isSeatItem('room',{...fire,action:'坐在旁边看看火'}),false);
 const swing=worlds.garden.items.find(item=>item.id==='swing')!;
 assert.equal(isSeatItem('garden',{...swing,action:'Enjoy the breeze'}),true);
});
