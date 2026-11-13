export type Play={kind:string;rank:number;size:number};
export const rankOf=(card:number)=>card<52?Math.floor(card/4)+3:card-35;
const consecutive=(ranks:number[])=>ranks.at(-1)!<15&&ranks.every((r,i)=>!i||r===ranks[i-1]+1);
export function classify(cards:number[]):Play|undefined{
 if(!cards.length||new Set(cards).size!==cards.length||cards.some(c=>!Number.isInteger(c)||c<0||c>53))return;
 const counts=new Map<number,number>();
 for(const c of cards){const rank=rankOf(c);counts.set(rank,(counts.get(rank)??0)+1)}
 const ranks=[...counts.keys()].sort((a,b)=>a-b),size=cards.length;
 const play=(kind:string,rank=ranks.at(-1)!):Play=>({kind,rank,size});
 if(size===2&&ranks.join()==='17,18')return play('rocket');
 if(ranks.length===1)return play(['','single','pair','triple','bomb'][size]);
 if(size>=5&&ranks.length===size&&consecutive(ranks))return play('straight');
 if(size>=6&&ranks.length*2===size&&consecutive(ranks)&&ranks.every(r=>counts.get(r)===2))return play('pairs');
 const triple=ranks.filter(r=>counts.get(r)!>=3);
 if(triple.length===1&&size===4)return play('triple-single',triple[0]);
 if(triple.length===1&&size===5&&ranks.some(r=>counts.get(r)===2))return play('triple-pair',triple[0]);
 for(const width of [1,2,0]){
  const n=size/(3+width);
  if(!Number.isInteger(n)||n<2)continue;
  for(let i=0;i+n<=triple.length;i++){
   const run=triple.slice(i,i+n);
   if(!consecutive(run)||run.some(r=>counts.get(r)!==3))continue;
   const wings=ranks.filter(r=>!run.includes(r));
   if(width===2&&!(wings.length===n&&wings.every(r=>counts.get(r)===2)))continue;
   return play(['plane','plane-single','plane-pair'][width],run.at(-1));
  }
 }
 const four=ranks.find(r=>counts.get(r)===4);
 if(four!==undefined&&size===6)return play('four-singles',four);
 if(four!==undefined&&size===8&&ranks.filter(r=>r!==four).length===2&&ranks.every(r=>r===four||counts.get(r)===2))return play('four-pairs',four);
}
export function beats(next:Play,previous?:Play){
 if(!previous)return true;
 if(previous.kind==='rocket')return false;
 if(next.kind==='rocket')return true;
 if(next.kind==='bomb'&&previous.kind!=='bomb')return true;
 return next.kind===previous.kind&&next.size===previous.size&&next.rank>previous.rank;
}
export function chooseCards(hand:number[],previous?:Play){
 const groups=Array.from({length:16},(_,i)=>hand.filter(c=>rankOf(c)===i+3)).filter(g=>g.length);
 const candidates:number[][]=[];
 const add=(cards:number[])=>{const play=classify(cards);if(play&&beats(play,previous))candidates.push(cards)};
 for(const g of groups){
  for(let n=1;n<=g.length;n++)add(g.slice(0,n));
  const others=groups.filter(v=>v!==g);
  if(g.length>=3)for(const v of others){add([...g.slice(0,3),v[0]]);if(v.length>=2)add([...g.slice(0,3),...v.slice(0,2)])}
  if(g.length===4)for(const [i,v] of others.entries())for(const u of others.slice(i+1)){
   add([...g,v[0],u[0]]);
   if(v.length>=2&&u.length>=2)add([...g,...v.slice(0,2),...u.slice(0,2)]);
  }
 }
 for(let i=0;i<groups.length;i++)for(let j=i+2;j<=groups.length;j++){
  const run=groups.slice(i,j),ranks=run.map(g=>rankOf(g[0]));
  if(!consecutive(ranks))break;
  for(const n of [1,2,3])if(run.every(g=>g.length>=n)){
   const base=run.flatMap(g=>g.slice(0,n));add(base);
   if(n===3){
    const others=groups.filter(g=>!run.includes(g));
    const singles=others.flat().slice(0,run.length);
    const pairs=others.filter(g=>g.length>=2).slice(0,run.length).flatMap(g=>g.slice(0,2));
    if(singles.length===run.length)add([...base,...singles]);
    if(pairs.length===run.length*2)add([...base,...pairs]);
   }
  }
 }
 if(hand.includes(52)&&hand.includes(53))add([52,53]);
 const cost=(cards:number[])=>{const p=classify(cards)!;return (p.kind==='bomb'||p.kind==='rocket'?1000:0)+(previous?0:-cards.length*20)+p.rank};
 return candidates.sort((a,b)=>cost(a)-cost(b))[0]??[];
}
