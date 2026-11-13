import assert from 'node:assert/strict';
import test from 'node:test';
import {RoomService} from '../server/rooms.mjs';

test('either seat can author a private quiz and both receive authoritative scored results',()=>{
 let time=10000;
 const server=new RoomService({now:()=>time});
 const host: any[]=[],guest: any[]=[];
 const h=(m:object)=>server.receive('h',m,(v:unknown)=>host.push(v));
 const g=(m:object)=>server.receive('g',m,(v:unknown)=>guest.push(v));
 h({type:'create',name:'你'});
 const roomId=host[0].roomId;
 h({type:'quiz-invite',count:5});assert.equal(host.at(-1).code,'QUIZ');
 g({type:'join',roomId,name:'我'});
 g({type:'quiz-invite',count:7});assert.equal(guest.at(-1).code,'QUIZ');
 g({type:'quiz-invite',count:5});
 const id=guest.at(-1).snapshot.quiz.id;
 h({type:'quiz-accept',id});
 const questions=Array.from({length:5},(_,i)=>({text:'第'+(i+1)+'题',options:['甲','乙','丙'],correct:1}));
 h({type:'quiz-publish',id,questions});assert.equal(host.at(-1).code,'QUIZ');
 g({type:'quiz-publish',id,questions});
 assert.deepEqual(host.at(-1).snapshot.quiz.question,{text:'第1题',options:['甲','乙','丙']});
 assert.equal(host.at(-1).snapshot.quiz.questions,undefined);
 g({type:'quiz-answer',id,index:0,choice:1});assert.equal(guest.at(-1).code,'QUIZ');
 h({type:'quiz-answer',id,index:0,choice:0});
 assert.equal(guest.at(-1).snapshot.quiz.penaltyUntil,time+3000);
 h({type:'quiz-next',id,index:0});assert.equal(host.at(-1).code,'QUIZ');
 time+=3001;
 h({type:'quiz-next',id,index:0});
 h({type:'quiz-answer',id,index:0,choice:1});assert.equal(host.at(-1).code,'QUIZ');
 for(let index=1;index<5;index++){
  time+=1001;
  h({type:'quiz-answer',id,index,choice:1});
  assert.equal(guest.at(-1).snapshot.quiz.correctCount,index);
  h({type:'quiz-next',id,index});
 }
 for(const inbox of [host,guest]){
  assert.equal(inbox.at(-1).snapshot.quiz.phase,'finished');
  assert.equal(inbox.at(-1).snapshot.quiz.results.length,5);
  assert.equal(inbox.at(-1).snapshot.quiz.correctCount,4);
 }
});
