import {puzzleLevel,type PuzzleKind} from '../src/puzzle-levels';
export function solveGiftPuzzle(kind:PuzzleKind,level:number){
 const spec=puzzleLevel(kind,level),queue=[{p:spec.player,b:spec.buddy,box:spec.box,hearts:spec.hearts,path:[] as {side:number;target:number}[]}],seen=new Set<string>();
 for(let cursor=0;cursor<queue.length;cursor++){
  const state=queue[cursor],key=[state.p,state.b,state.box,...state.hearts].join(',');if(seen.has(key)||state.path.length>spec.steps)continue;seen.add(key);
  if(kind==='band'?state.p===spec.goal&&!state.hearts.length:kind==='labubu'?state.box===spec.boxGoal:(state.p===spec.goal&&state.b===spec.partnerGoal)||(state.b===spec.goal&&state.p===spec.partnerGoal))return state.path;
  for(const side of kind==='mystery'?[0,1]:[0])for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const pos=side?state.b:state.p,x=pos%5+dx,y=Math.floor(pos/5)+dy,n=y*5+x;
   if(x<0||x>4||y<0||y>4||spec.walls.includes(n))continue;
   if(kind==='mystery'&&n===spec.gate&&!spec.switches.some(s=>s===state.p||s===state.b))continue;
   let box=state.box;if(kind==='labubu'&&n===box){const bx=x+dx,by=y+dy;if(bx<0||bx>4||by<0||by>4||spec.walls.includes(by*5+bx))continue;box=by*5+bx}
   queue.push({p:side?state.p:n,b:side?n:state.b,box,hearts:state.hearts.filter(h=>h!==n),path:[...state.path,{side,target:n}]});
  }
 }
 throw Error(`No solution for ${kind} ${level}`);
}
