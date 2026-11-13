import {birthdayConfig as config,type GiftId} from '../content/birthday-config';
import type {Save} from './state';
export function unlockGift(s:Save,id:GiftId){
 if(!s.opened.includes(id))s.opened.push(id);
 if(!s.inventory.includes(id))s.inventory.push(id);
 if(!s.games[id])s.games[id]={status:'skipped',score:0};
 if(id==='chestnuts'||id==='chocolate')s.snackPortions[id]=Math.max(s.snackPortions[id],3);
}
export const achievements=[
 {id:'first-gift',name:'第一份心意',text:'拆开第一份礼物',check:(s:Save)=>s.opened.length>=1},
 {id:'all-gifts',name:'星辰都给你',text:'珍藏全部十二份礼物',check:(s:Save)=>s.opened.length===config.gifts.length},
 {id:'walk',name:'一起走远一点',text:'到访五处空间',check:(s:Save)=>s.visited.length>=5},
 {id:'world',name:'走遍我们的世界',text:'到访二十处空间',check:(s:Save)=>s.visited.length>=20},
 {id:'memories',name:'日子有了回声',text:'完成十种场景互动',check:(s:Save)=>s.moments.length>=10},
 {id:'games',name:'默契练习生',text:'完成三种礼物小游戏',check:(s:Save)=>Object.values(s.games).filter(g=>g.status==='won').length>=3},
 {id:'birthday',name:'今天属于你',text:'完成生日仪式',check:(s:Save)=>s.celebrated},
 {id:'cats',name:'猫猫认可的人',text:'和猫猫玩一次',check:(s:Save)=>s.moments.includes('cat-play')},
];
