export class ClawMachine{
 phase:'aim'|'drop'|'rise'|'carry'='aim';x=300;y=40;time=0;hasDoll=false;tries=0;
 constructor(readonly target:number){}
 get sway(){return Math.sin(this.time*2)*20}
 move(x:number){if(this.phase==='aim'||this.phase==='carry')this.x=Math.max(45,Math.min(555,x))}
 /** Delivery is accepted only after the claw has finished lifting the prize. */
 press(){if(this.phase==='carry')return this.x<120;if(this.phase==='aim')this.phase='drop';return false}
 advance(seconds:number){
  let remaining=Math.max(0,seconds);if(!Number.isFinite(remaining))return;
  while(remaining>0){
   if(this.phase==='aim'||this.phase==='carry'){this.time+=remaining;return}
   const duration=(this.phase==='drop'?225-this.y:this.y-40)/150,step=Math.min(remaining,Math.max(0,duration));
   this.time+=step;remaining-=step;this.y+=(this.phase==='drop'?1:-1)*150*step;
   if(step+1e-9<duration)return;
   if(this.phase==='drop'){this.y=225;this.tries++;this.hasDoll=Math.abs(this.x+this.sway-this.target)<(this.tries>=3?90:40);this.phase='rise'}
   else{this.y=40;this.phase=this.hasDoll?'carry':'aim'}
  }
 }
}
