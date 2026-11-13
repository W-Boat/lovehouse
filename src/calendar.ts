export type Season='spring'|'summer'|'autumn'|'winter';
export type Weather='clear'|'rain'|'snow';
export type DayPeriod='night'|'dawn'|'day'|'dusk';
export type CalendarSettings={enabled:boolean;initialized:boolean;date:string;minutes:number;timeMode:'auto'|'manual';timeScale:1|10|30|60;seasonMode:'auto'|'manual';season:Season;weatherMode:'auto'|'manual';weather:Weather;temperatureMode:'auto'|'manual';temperature:number};
export const FIRST_CALENDAR_DATE='2026-10-23';
export const calendarDefaults=():CalendarSettings=>({enabled:false,initialized:false,date:FIRST_CALENDAR_DATE,minutes:18*60,timeMode:'auto',timeScale:10,seasonMode:'auto',season:'autumn',weatherMode:'auto',weather:'clear',temperatureMode:'auto',temperature:16});
export const seasonNames:Record<Season,string>={spring:'春天',summer:'夏天',autumn:'秋天',winter:'冬天'};
export const weatherNames:Record<Weather,string>={clear:'晴朗',rain:'细雨',snow:'飘雪'};
export const periodNames:Record<DayPeriod,string>={night:'月夜',dawn:'清晨',day:'日间',dusk:'傍晚'};
const bounded=(n:unknown,lo:number,hi:number,fallback:number)=>typeof n==='number'&&Number.isFinite(n)?Math.max(lo,Math.min(hi,n)):fallback;
export function validCalendarDate(value:unknown):value is string{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const [year,month,day]=value.split('-').map(Number);if(year<1900||year>9998||month<1||month>12||day<1||day>31)return false;
 return new Date(Date.UTC(year,month-1,day)).toISOString().slice(0,10)===value;
}
export function enableCalendar(calendar:CalendarSettings,enabled:boolean){
 if(enabled&&!calendar.initialized){Object.assign(calendar,calendarDefaults());calendar.initialized=true}
 calendar.enabled=enabled;
}
export function parseCalendar(raw:unknown):CalendarSettings{
 const c=calendarDefaults();if(!raw||typeof raw!=='object')return c;const d=raw as Partial<CalendarSettings>;
 c.initialized=d.initialized===true;c.enabled=d.enabled===true;
 if(c.initialized){if(validCalendarDate(d.date))c.date=d.date;c.minutes=bounded(d.minutes,0,1439.999,c.minutes)}
 c.timeMode=d.timeMode==='manual'?'manual':'auto';c.timeScale=([1,10,30,60] as number[]).includes(d.timeScale as number)?d.timeScale!:10;
 for(const key of ['seasonMode','weatherMode','temperatureMode'] as const)c[key]=d[key]==='manual'?'manual':'auto';
 if(['spring','summer','autumn','winter'].includes(d.season as string))c.season=d.season!;
 if(['clear','rain','snow'].includes(d.weather as string))c.weather=d.weather!;
 c.temperature=bounded(d.temperature,-30,45,16);
 if(c.enabled&&!c.initialized)enableCalendar(c,true);
 return c;
}
export function advanceCalendar(c:CalendarSettings,realSeconds:number){
 if(!c.enabled||c.timeMode!=='auto'||!Number.isFinite(realSeconds)||realSeconds<=0)return false;
 const total=c.minutes+realSeconds*c.timeScale/60,days=Math.floor(total/1440);c.minutes=total%1440;
 if(days){const [y,m,d]=c.date.split('-').map(Number);const next=new Date(Date.UTC(y,m-1,d+days));if(next.getUTCFullYear()<=9998)c.date=next.toISOString().slice(0,10);else{c.date='9998-12-31';c.minutes=1439;c.timeMode='manual'}}
 return true;
}
export function seasonForDate(date:string):Season{const month=Number(date.slice(5,7));return month>=3&&month<=5?'spring':month>=6&&month<=8?'summer':month>=9&&month<=11?'autumn':'winter'}
export function solarTimes(date:string,manualSeason?:Season){
 const month=Number(date.slice(5,7)),day=Number(date.slice(8,10));
 const seasonal=manualSeason?({spring:0,summer:1,autumn:0,winter:-1}[manualSeason]):Math.cos(((month-1+(day-1)/31)-6)/12*Math.PI*2);
 const length=12+2.4*seasonal;return{sunrise:(12.5-length/2)*60,sunset:(12.5+length/2)*60};
}
export function periodForMinutes(minutes:number,times?:{sunrise:number;sunset:number}):DayPeriod{
 if(times)return minutes<times.sunrise-60||minutes>=times.sunset+75?'night':minutes<times.sunrise+60?'dawn':minutes<times.sunset-60?'day':'dusk';
 return minutes<5*60||minutes>=20*60?'night':minutes<8*60?'dawn':minutes<17*60?'day':'dusk';
}
export function skyBlend(minutes:number,times?:{sunrise:number;sunset:number}):[number,number,number]{
 if(times){const{sunrise,sunset}=times;if(minutes<sunrise-60||minutes>=sunset+75)return[1,0,0];if(minutes<sunrise){const t=(minutes-sunrise+60)/60;return[1-t,t,0]}if(minutes<sunrise+75){const t=(minutes-sunrise)/75;return[0,1-t,t]}if(minutes<sunset-75)return[0,0,1];if(minutes<sunset){const t=(minutes-sunset+75)/75;return[0,t,1-t]}const t=(minutes-sunset)/75;return[t,1-t,0]}
 const hour=minutes/60;
 if(hour<5||hour>=20)return[1,0,0];if(hour<6){const t=hour-5;return[1-t,t,0]}
 if(hour<8){const t=(hour-6)/2;return[0,1-t,t]}
 if(hour<16)return[0,0,1];if(hour<18){const t=(hour-16)/2;return[0,t,1-t]}
 const t=(hour-18)/2;return[t,1-t,0];
}
function hash(text:string){let h=2166136261;for(const char of text)h=Math.imul(h^char.charCodeAt(0),16777619);return h>>>0}
export type CalendarSnapshot={enabled:boolean;date:string;minutes:number;weekday:number;season:Season;weather:Weather;period:DayPeriod;temperature:number;skyBlend:[number,number,number];daylight:number;sunrise:number;sunset:number};
export function calendarSnapshot(c:CalendarSettings,fallback:{weather:string;time:string}):CalendarSnapshot{
 const minutes=c.enabled?c.minutes:({night:21*60,dawn:6*60,day:12*60,dusk:18*60}[fallback.time]??21*60),season=c.seasonMode==='auto'?seasonForDate(c.date):c.season;
 const [year,month,day]=c.date.split('-').map(Number),daily=(hash(c.date)%101/100-.5)*5;
 const base=c.seasonMode==='auto'?14+12*Math.cos(((month-1+(day-1)/31)-6)/12*Math.PI*2):({spring:14,summer:27,autumn:15,winter:1}[season]);
 let temperature=c.temperatureMode==='manual'?c.temperature:base+daily+4.5*Math.cos((minutes/60-14)/24*Math.PI*2);
 let weather:Weather=c.weather;
 if(c.weatherMode==='auto'){const chance=hash(c.date+':'+Math.floor(minutes/180))%100,wet=chance<({spring:32,summer:35,autumn:26,winter:38}[season]);weather=wet?(temperature<=3?'snow':'rain'):'clear'}
 if(c.temperatureMode==='auto')temperature-=weather==='snow'?3:weather==='rain'?2:0;
 if(!c.enabled)weather=['clear','rain','snow'].includes(fallback.weather)?fallback.weather as Weather:'clear';
 const times=c.enabled?solarTimes(c.date,c.seasonMode==='manual'?c.season:undefined):{sunrise:6*60,sunset:18*60},blend=skyBlend(minutes,c.enabled?times:undefined),fallbackPeriod=['night','dawn','day','dusk'].includes(fallback.time)?fallback.time as DayPeriod:'night';
 return{enabled:c.enabled,date:c.date,minutes,weekday:new Date(Date.UTC(year,month-1,day)).getUTCDay(),season,weather,period:c.enabled?periodForMinutes(minutes,times):fallbackPeriod,temperature:Math.round(temperature*10)/10,skyBlend:blend,daylight:blend[2]+blend[1]*.45,...times};
}
export function clockLabel(minutes:number){const n=Math.floor(minutes)%1440;return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
