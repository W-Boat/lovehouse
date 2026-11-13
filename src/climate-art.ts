import type {CalendarSnapshot} from './calendar';
type Textures={exists:(key:string)=>boolean;get:(key:string)=>{getSourceImage:()=>unknown}};
type Rect={x:number;y:number;w:number;h:number};
/** One renderer is shared by the setting preview and the actual window panes. */
export function drawClimateView(g:CanvasRenderingContext2D,textures:Textures,s:CalendarSnapshot,rect:Rect){
 const seasonal=s.enabled&&textures.exists('season-views'),source=textures.get(seasonal?'season-views':'window-views').getSourceImage() as HTMLImageElement;
 const columns=seasonal?4:3,column=seasonal?['spring','summer','autumn','winter'].indexOf(s.season):s.weather==='rain'?1:s.weather==='snow'?2:0;
 const cellW=source.width/columns,cellH=source.height/3;
 const sampleH=Math.min(cellH,cellW/1.5),sampleW=Math.min(cellW,sampleH*1.5),sx=column*cellW+(cellW-sampleW)/2;
 const weights=s.enabled?s.skyBlend:([s.period==='night'?1:0,s.period==='dawn'||s.period==='dusk'?1:0,s.period==='day'?1:0] as [number,number,number]);
 g.save();g.imageSmoothingEnabled=false;let accumulated=0;
 weights.forEach((weight,row)=>{if(weight<=0)return;g.globalAlpha=accumulated===0?1:weight/(accumulated+weight);g.drawImage(source,sx,row*cellH+(cellH-sampleH)/2,sampleW,sampleH,rect.x,rect.y,rect.w,rect.h);accumulated+=weight});
 g.globalAlpha=1;
 if(seasonal){
  if(s.weather!=='clear'){g.fillStyle=s.period==='night'?'#253c55':'#8eabb8';g.globalAlpha=.19;g.fillRect(rect.x,rect.y,rect.w,rect.h*.55);g.globalAlpha=1}
  const night=s.minutes<s.sunrise||s.minutes>=s.sunset,adjusted=night&&s.minutes<s.sunrise?s.minutes+1440:s.minutes,start=night?s.sunset:s.sunrise,length=night?1440-s.sunset+s.sunrise:s.sunset-s.sunrise,phase=Math.max(0,Math.min(1,(adjusted-start)/length));
  const x=rect.x+rect.w*(.08+.84*phase),y=rect.y+rect.h*(.46-.32*Math.sin(phase*Math.PI)),r=rect.w*(night?.053:.064);
  g.fillStyle=night?'#f7e8bc':'#ffe0a0';g.globalAlpha=s.weather==='clear'?.95:.35;
  if(night){g.save();g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.clip();g.beginPath();g.rect(x-r,y-r,r*2,r*2);g.moveTo(x+r*1.4,y-r*.25);g.arc(x+r*.5,y-r*.25,r*.9,0,Math.PI*2);g.fill('evenodd');g.restore()}
  else{g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill()}
 }
 g.restore();
}
