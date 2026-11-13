import {films} from '../content/films';
import {writeFileSync} from 'node:fs';
import {birthdayConfig as c} from '../content/birthday-config';
import {places} from '../content/places';
import {worlds} from '../src/world';
import {giftGames} from '../src/minigames';
let out='# 文案\n\n替换标记之间的文字，保留 copy ID。执行 python tools/apply_copy.py 文案.md 后构建，即可应用；也可以直接填写后发回。称呼在游戏开局输入。\n';
const section=(id:string,label:string,text:string)=>{out+='\n## '+label+'\n\n<!-- copy:'+id+' -->\n'+text+'\n<!-- /copy:'+id+' -->\n'};
c.keychainLines.forEach((v,i)=>section('keychain.'+i,'钥匙扣短句 '+(i+1),v));section('welcome','开场',c.welcome);section('birthday.letter','生日信',c.letterText);c.notes.forEach((v,i)=>section('note.'+i,'日常便签 '+(i+1),v));for(const g of c.gifts)section('gift.'+g.id+'.message',g.name,g.message);for(const [id,p]of Object.entries(places)){section('place.'+id+'.text',id+' · 对话',p.text);section('place.'+id+'.choice',id+' · 选择',p.choice);section('place.'+id+'.response',id+' · 回应',p.response)}
for(const [id,film]of Object.entries(films))film.shots.forEach((shot,i)=>section('film.'+id+'.'+i,film.title+' · 镜头 '+(i+1),shot.line));
out+='\n# 场景与小游戏说明（设计参考）\n';for(const w of Object.values(worlds))out+='\n- '+w.name+'：'+w.caption;for(const g of Object.values(giftGames))out+='\n- '+g.title+'：'+g.rule;
writeFileSync('文案.md',out);console.log('Exported '+Object.keys(places).length+' place conversations');
