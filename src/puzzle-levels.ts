export type PuzzleKind='band'|'labubu'|'mystery';
export function puzzleLevel(kind:PuzzleKind,level:number){
 const turns=kind==='labubu'?0:[0,1,3][level%3];
 const transform=(n:number)=>{let x=n%5,y=Math.floor(n/5);for(let i=0;i<turns;i++)[x,y]=[4-y,x];return y*5+x};
 return{player:transform(0),buddy:transform(4),walls:(kind==='mystery'?[10,11,13,14]:[6,8,16,18]).map(transform),hearts:[4,20].map(transform),goal:transform(24),partnerGoal:transform(23),box:transform([12,17,7][level%3]),boxGoal:transform(13),gate:transform(12),switches:[6,22].map(transform),steps:38-level*4};
}
