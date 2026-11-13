export type FilmAction='arrive'|'greet'|'flower'|'hug'|'leave'|'walk'|'fireflies'|'boat'|'rest'|'pack'|'decorate'|'light'|'surprise'|'wish'|'celebrate';
export type FilmShot={zone:'room'|'garden'|'forest'|'pier';action:FilmAction;seconds:number;scale:number;line:string};
const shot=(zone:FilmShot['zone'],action:FilmAction,line:string,scale=1,seconds=12):FilmShot=>({zone,action,line,scale,seconds});
export const films={
 meet:{title:'相遇',duration:72,shots:[shot('garden','arrive','那天，你从小路的另一头走来。',1),shot('garden','greet','我们停了一下，认真说了声你好。',1.35),shot('garden','flower','一朵小花，让开场白没那么紧张。',1.5),shot('forest','walk','聊着聊着，路就走长了。'),shot('pier','rest','后来，安静待着也不觉得尴尬。',1.3),shot('garden','hug','这一刻，就当作故事的开头。',1.45)]},
 travel:{title:'一起旅行',duration:72,shots:[shot('room','pack','带上水和一点甜的，我们出发。',1.25),shot('garden','leave','不用赶路，今天没有最后一班车。'),shot('forest','fireflies','在森林里，等一盏小灯飞过来。',1.3),shot('pier','boat','把纸船放下，看它带走一点烦恼。',1.2),shot('pier','rest','走累了，就把肩膀借给对方。',1.45),shot('garden','walk','回去的路，还想和你一起走。')]},
 birthday:{title:'生日惊喜',duration:72,shots:[shot('room','decorate','先把房间布置好，留着你喜欢的位置。'),shot('room','light','最后一盏灯，也悄悄点亮。',1.25),shot('room','surprise','门开了——生日快乐。'),shot('room','flower','这束花，和今天一样属于你。',1.5),shot('room','wish','闭上眼睛，慢慢许一个愿。',1.4),shot('room','celebrate','愿新的一岁，有人陪你把小事过好。',1.25)]}
};
export type FilmId=keyof typeof films;
export function filmMoment(id:FilmId,time:number){const spec=films[id];let start=0;for(let i=0;i<spec.shots.length;i++){const shot=spec.shots[i];if(time<start+shot.seconds||i===spec.shots.length-1)return{shot,index:i,local:Math.max(0,Math.min(shot.seconds,time-start)),progress:Math.max(0,Math.min(1,(time-start)/shot.seconds))};start+=shot.seconds}throw Error('empty film')}
export function concertSection(time:number){return time<6?'countdown':time<28?'opening':time<55?'verse':time<79?'climax':time<87?'bow':'curtain'}
export function rideProgress(time:number){const t=Math.max(0,Math.min(60,time));return t<5?0:t<25?(t-5)/40:t<35?.5:t<55?.5+(t-35)/40:1}
