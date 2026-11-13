import {randomBytes} from 'node:crypto';

const allowedCounts = new Set([5, 10, 15, 20]);
const boundedText = (text, max) => typeof text === 'string' ? [...text.trim()].slice(0,max).join('') : '';

export function publicQuiz(quiz) {
 if (!quiz) return null;
 const question = quiz.phase==='answering'||quiz.phase==='result'||quiz.phase==='finished'
  ? quiz.questions[quiz.index] : undefined;
 return {
  id:quiz.id, author:quiz.author, responder:quiz.responder, count:quiz.count,
  phase:quiz.phase, index:quiz.index, correctCount:quiz.correctCount, penaltyUntil:quiz.penaltyUntil,
  question:question&&{text:question.text,options:question.options},
  results:quiz.results.map(result=>({...result}))
 };
}

export function changeQuiz(room, player, message, now=Date.now()) {
 const other=[...room.players.values()].find(member=>member.id!==player.id);
 const quiz=room.quiz;
 if(message.type==='quiz-cancel'){
  if(!quiz||quiz.id!==message.id)return '这局问答已经结束';
  room.quiz=null;
  return;
 }
 if(!other?.connected)return '等另一位玩家上线后继续';
 if(message.type==='quiz-invite'){
  if(quiz&&quiz.phase!=='finished')return '请先结束正在进行的问答';
  if(!allowedCounts.has(message.count))return '请选择 5、10、15 或 20 道题';
  room.quiz={id:randomBytes(12).toString('base64url'),author:player.id,responder:other.id,
   count:message.count,phase:'invited',index:0,correctCount:0,questions:[],results:[]};
  return;
 }
 if(!quiz||message.id!==quiz.id)return '这局问答已经结束';
 if(message.type==='quiz-accept'&&quiz.phase==='invited'&&player.id===quiz.responder){
  quiz.phase='drafting';
  return;
 }
 if(message.type==='quiz-publish'&&quiz.phase==='drafting'&&player.id===quiz.author){
  if(!Array.isArray(message.questions)||message.questions.length!==quiz.count)return '请写完所有题目';
  const questions=message.questions.map(item=>({
   text:boundedText(item?.text,120),options:Array.isArray(item?.options)?item.options.map(option=>boundedText(option,40)):[],
   correct:item?.correct
  }));
  if(questions.some(item=>!item.text||item.options.length!==3||item.options.some(option=>!option)
    ||new Set(item.options).size!==3||!Number.isInteger(item.correct)||item.correct<0||item.correct>2))
   return '每道题需要三个不同的选项和一个答案';
  quiz.questions=questions;
  quiz.phase='answering';
  return;
 }
 if(message.type==='quiz-answer'&&quiz.phase==='answering'&&player.id===quiz.responder&&message.index===quiz.index){
  if(!Number.isInteger(message.choice)||message.choice<0||message.choice>2)return '请选择一个答案';
  const correct=quiz.questions[quiz.index].correct;
  if(message.choice===correct)quiz.correctCount++;
  quiz.results.push({index:quiz.index,choice:message.choice,correct});
  quiz.penaltyUntil=message.choice===correct?undefined:now+3000;
  quiz.phase='result';
  return;
 }
 if(message.type==='quiz-next'&&quiz.phase==='result'&&player.id===quiz.responder&&message.index===quiz.index){
  if(quiz.penaltyUntil>now)return '两人罚站结束后再继续';
  quiz.penaltyUntil=undefined;
  if(quiz.index+1===quiz.count)quiz.phase='finished';
  else{quiz.index++;quiz.phase='answering'}
  return;
 }
 return '这一步需要由另一位玩家操作，或该操作已经提交';
}
