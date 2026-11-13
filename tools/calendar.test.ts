import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarDefaults,enableCalendar,advanceCalendar,calendarSnapshot,parseCalendar,seasonForDate,solarTimes,skyBlend,clockLabel,validCalendarDate} from '../src/calendar';
import {parseSave,defaults} from '../src/state';
const sky={weather:'clear',time:'night'};
test('first enabling starts on 2026-10-23, later enabling resumes the chosen date',()=>{
 const c=calendarDefaults();assert.equal(c.enabled,false);assert.equal(c.initialized,false);enableCalendar(c,true);assert.equal(c.date,'2026-10-23');assert.equal(c.minutes,1080);assert.equal(c.initialized,true);assert.equal(calendarSnapshot(c,sky).weekday,5);
 c.date='2027-02-14';c.minutes=700;enableCalendar(c,false);enableCalendar(c,true);assert.equal(c.date,'2027-02-14');assert.equal(c.minutes,700);
});
test('automatic time crosses midnight, month boundaries, leap days and year end correctly',()=>{
 for(const [before,after]of [['2026-10-23','2026-10-24'],['2026-10-31','2026-11-01'],['2028-02-28','2028-02-29'],['2028-02-29','2028-03-01'],['2026-12-31','2027-01-01']]){
  const c=calendarDefaults();enableCalendar(c,true);c.date=before;c.minutes=1439;c.timeScale=60;advanceCalendar(c,2);assert.equal(c.date,after);assert.equal(c.minutes,1);
 }
});
test('paused and disabled clocks do not advance, while speed is measured in game minutes per real minute',()=>{
 const c=calendarDefaults(),initial=c.minutes;advanceCalendar(c,60);assert.equal(c.minutes,initial);enableCalendar(c,true);advanceCalendar(c,60);assert.equal(c.minutes,initial+10);c.timeMode='manual';advanceCalendar(c,1000);assert.equal(c.minutes,initial+10);assert.equal(advanceCalendar(c,-1),false);assert.equal(advanceCalendar(c,NaN),false);
});
test('date validation rejects impossible dates without rejecting leap-year dates',()=>{
 for(const value of ['2026-02-29','2026-02-30','2026-13-01','2026-1-01','not-a-date','1899-12-31'])assert.equal(validCalendarDate(value),false,value);
 for(const value of ['2026-10-23','2028-02-29','2000-02-29'])assert.equal(validCalendarDate(value),true,value);
});
test('automatic seasons follow the date and manual season overrides remain independent',()=>{
 const c=calendarDefaults();enableCalendar(c,true);for(const [date,season]of [['2026-04-01','spring'],['2026-07-01','summer'],['2026-10-23','autumn'],['2026-12-31','winter']]){c.date=date;assert.equal(seasonForDate(date),season);assert.equal(calendarSnapshot(c,sky).season,season)}
 c.date='2026-07-01';c.seasonMode='manual';c.season='winter';assert.equal(calendarSnapshot(c,sky).season,'winter');
});
test('manual weather, temperature, date and time persist independently of automatic climate',()=>{
 const c=calendarDefaults();enableCalendar(c,true);c.timeMode='manual';c.minutes=12*60;c.seasonMode='manual';c.season='winter';c.weatherMode='manual';c.weather='snow';c.temperatureMode='manual';c.temperature=-8.5;const snap=calendarSnapshot(c,sky);assert.equal(snap.period,'day');assert.equal(snap.weather,'snow');assert.equal(snap.temperature,-8.5);assert.equal(snap.season,'winter');
 const loaded=parseSave(JSON.stringify({...defaults(),calendar:c}));assert.deepEqual(loaded.calendar,c);
});
test('automatic weather is deterministic and warm automatic precipitation never becomes snow',()=>{
 const c=calendarDefaults();enableCalendar(c,true);c.temperatureMode='manual';c.temperature=30;for(let day=1;day<=28;day++){c.date='2026-01-'+String(day).padStart(2,'0');for(let hour=0;hour<24;hour+=3){c.minutes=hour*60;const a=calendarSnapshot(c,sky),b=calendarSnapshot(c,sky);assert.equal(a.weather,b.weather);assert.notEqual(a.weather,'snow')}}
});
test('sky blend remains opaque and transitions continuously through morning and evening',()=>{
 for(let m=0;m<1440;m++){const weights=skyBlend(m,solarTimes('2026-10-23'));assert.ok(weights.every(w=>w>=0&&w<=1));assert.ok(Math.abs(weights.reduce((a,b)=>a+b,0)-1)<1e-10);if(m){const previous=skyBlend(m-1,solarTimes('2026-10-23'));assert.ok(weights.every((w,i)=>Math.abs(w-previous[i])<.02))}}
 const summer=solarTimes('2026-06-21'),winter=solarTimes('2026-12-21');assert.ok(summer.sunset-summer.sunrise>winter.sunset-winter.sunrise);assert.equal(clockLabel(0),'00:00');assert.equal(clockLabel(1439),'23:59');
});
test('v1 and existing v2 saves keep progress and leave the calendar disabled until first enabled',()=>{
 for(const version of [1,2]){const s=parseSave(JSON.stringify({version,opened:['moon'],following:true,music:false}));assert.deepEqual(s.opened,['moon']);assert.equal(s.following,true);assert.equal(s.music,false);assert.equal(s.calendar.enabled,false);assert.equal(s.calendar.initialized,false);enableCalendar(s.calendar,true);assert.equal(s.calendar.date,'2026-10-23')}
});
test('corrupt calendar data is bounded and cannot introduce invalid dates or nonfinite climate',()=>{
 const c=parseCalendar({enabled:true,initialized:true,date:'2026-02-30',minutes:Infinity,temperature:999,timeScale:999,weather:'tornado',season:'unknown'});assert.equal(c.date,'2026-10-23');assert.equal(c.minutes,1080);assert.equal(c.temperature,45);assert.equal(c.timeScale,10);assert.equal(c.weather,'clear');assert.equal(c.season,'autumn');
 const first=parseCalendar({enabled:true,initialized:false,date:'2050-01-01'});assert.equal(first.date,'2026-10-23');assert.equal(first.initialized,true);
});
