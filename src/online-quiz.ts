import {formatCopy,uiCopy} from '../content/ui-copy';
import {persist,save} from './state';
import type {QuizDraft,RoomSnapshot} from './online-protocol';

export const quizPrizes=['quiz-star','quiz-heart','quiz-ribbon'] as const;

export function createOnlineQuiz(send:(message:{type:string;[key:string]:unknown})=>boolean){
 let draftId='',draft:QuizDraft[]=[],renderKey='';
 let section:HTMLElement|undefined;
 let countdown:number|undefined;
 function mount(parent:HTMLElement){
  section=document.createElement('section');
  section.className='online-quiz';
  parent.append(section);
  renderKey='';
 }
 function update(snapshot:RoomSnapshot|undefined,playerId:string,connected:boolean){
  const quiz=snapshot?.quiz;
  if(quiz&&[quiz.author,quiz.responder].includes(playerId)&&/^[A-Za-z0-9_-]{16}$/.test(quiz.id)){
   const credited=save.quizRewards[quiz.id]??0;
   const wins=quiz.results.filter(result=>result.choice===result.correct);
   if(wins.length>credited){
    save.quizStars=Math.min(1000000,save.quizStars+wins.length-credited);
    save.quizRewards[quiz.id]=wins.length;
    const entries=Object.keys(save.quizRewards);
    for(const id of entries.slice(0,-128))delete save.quizRewards[id];
    for(const result of wins.slice(credited)){
     const prize=quizPrizes[result.index%quizPrizes.length];
     if(!save.inventory.includes(prize))save.inventory.push(prize);
    }
    persist();
   }
  }
  if(!section?.isConnected)return;
  const together=connected&&snapshot?.players.filter(player=>player.connected).length===2;
  const key=JSON.stringify([snapshot?.roomId,playerId,together,quiz]);
  if(key===renderKey)return;
  renderKey=key;
  window.clearInterval(countdown);
  const parent=section;
  parent.replaceChildren();
  const node=<K extends keyof HTMLElementTagNameMap>(tag:K,label='',target:HTMLElement=parent)=>{
   const element=document.createElement(tag);element.textContent=label;target.append(element);return element;
  };
  const button=(label:string,action:()=>void,target:HTMLElement=parent)=>{
   const control=node('button',label,target);control.type='button';control.disabled=!together;control.onclick=action;return control;
  };
  node('h3',uiCopy('quiz.title'));
  node('p',formatCopy('quiz.balance',{count:save.quizStars}));
  if(!quiz||quiz.phase==='finished'){
   if(quiz)node('p',formatCopy('quiz.summary',{correct:quiz.correctCount,count:quiz.count}));
   node('p',uiCopy('quiz.intro'));
   const select=node('select','',node('label',uiCopy('quiz.count')));
   for(const count of [5,10,15,20]){const option=node('option',String(count),select);option.value=String(count)}
   button(uiCopy('quiz.invite'),()=>send({type:'quiz-invite',count:Number(select.value)}));
   if(!together)node('p',uiCopy('quiz.wait-online'));
   return;
  }
  const author=quiz.author===playerId;
  const change=(type:string,extra:Record<string,unknown>={})=>send({type,id:quiz.id,...extra});
  if(!together)node('p',uiCopy('quiz.wait-online'));
  if(quiz.phase==='invited'){
   node('p',author?uiCopy('quiz.wait-accept'):formatCopy('quiz.incoming',{count:quiz.count}));
   if(!author)button(uiCopy('quiz.accept'),()=>change('quiz-accept'));
  }else if(quiz.phase==='drafting'){
   if(!author)node('p',uiCopy('quiz.wait-draft'));
   else{
    if(draftId!==quiz.id){draftId=quiz.id;draft=Array.from({length:quiz.count},()=>({text:'',options:['','',''],correct:0}))}
    node('p',uiCopy('quiz.draft-help'));
    const list=node('div');list.className='quiz-draft-list';
    draft.forEach((question,index)=>{
     const group=node('fieldset','',list);
     node('legend',formatCopy('quiz.number',{index:index+1}),group);
     const field=(label:string,value:string,limit:number,onInput:(value:string)=>void)=>{
      const input=node('input','',node('label',label,group));
      input.value=value;input.maxLength=limit;input.oninput=()=>onInput(input.value);
     };
     field(uiCopy('quiz.question'),question.text,120,value=>question.text=value);
     question.options.forEach((option,i)=>field(formatCopy('quiz.option',{letter:'ABC'[i]}),option,40,value=>question.options[i]=value));
     const correct=node('select','',node('label',uiCopy('quiz.correct'),group));
     for(let i=0;i<3;i++){const option=node('option','ABC'[i],correct);option.value=String(i)}
     correct.value=String(question.correct);correct.onchange=()=>question.correct=Number(correct.value);
    });
    button(uiCopy('quiz.publish'),()=>change('quiz-publish',{questions:draft}));
   }
  }else if(quiz.question){
   node('p',formatCopy('quiz.progress',{index:quiz.index+1,count:quiz.count}));
   node('h4',quiz.question.text);
   quiz.question.options.forEach((option,index)=>{
    const label='ABC'[index]+' · '+option;
    if(author||quiz.phase==='result')node('p',label);
    else button(label,()=>change('quiz-answer',{index:quiz.index,choice:index}));
   });
   if(quiz.phase==='result'){
    const result=quiz.results[quiz.index];
    if(result){
     const success=result.choice===result.correct;
     const card=node('p',success?uiCopy('quiz.reward'):uiCopy('quiz.penalty'));
     card.className=success?'quiz-reward':'quiz-penalty';card.setAttribute('role','status');
     node('p',formatCopy('quiz.reveal',{choice:'ABC'[result.choice],correct:'ABC'[result.correct]}));
    }
    const next=author?undefined:button(uiCopy('quiz.next'),()=>change('quiz-next',{index:quiz.index}));
    const delay=(quiz.penaltyUntil??0)-(snapshot?.serverNow??Date.now());
    if(delay>0&&together){
     if(next)next.disabled=true;
     const deadline=performance.now()+delay;
     const counter=node('output');counter.className='quiz-countdown';
     const tick=()=>{
      const seconds=Math.max(0,Math.ceil((deadline-performance.now())/1000));
      counter.textContent=String(seconds);
      if(!seconds||!counter.isConnected){
       window.clearInterval(countdown);counter.remove();
       if(next?.isConnected)next.disabled=false;
      }
     };
     countdown=window.setInterval(tick,100);tick();
    }
   }else if(author)node('p',uiCopy('quiz.wait-answer'));
  }
  button(uiCopy('quiz.cancel'),()=>change('quiz-cancel'));
 }
 return {mount,update};
}
