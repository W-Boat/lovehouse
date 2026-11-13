import test from 'node:test';
import assert from 'node:assert/strict';
import {drawEarphones,drawHat} from '../src/wearable-art';
test('ear hooks stay on distinct ears and side views show only the near hook',()=>{
 const calls:number[][]=[];const ctx={drawImage:(_s:unknown,...p:number[])=>calls.push(p)} as unknown as CanvasRenderingContext2D;
 const source={width:120,height:70} as HTMLCanvasElement,head={x:100,top:20,width:80,height:70,facing:0};
 drawEarphones(ctx,source,head);assert.equal(calls.length,2);assert.ok(calls[0][4]<100);assert.ok(calls[1][4]>100);assert.equal(calls[0][6]/calls[0][7],60/70);
 for(const facing of [1,3]){calls.length=0;drawEarphones(ctx,source,{...head,facing});assert.equal(calls.length,1)}
 calls.length=0;drawEarphones(ctx,source,{...head,facing:2});assert.equal(calls.length,2);
 calls.length=0;drawHat(ctx,{width:80,height:60} as HTMLCanvasElement,head);assert.equal(calls[0][2]/calls[0][3],80/60);
});
