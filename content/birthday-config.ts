export type GiftId = 'moon'|'keychain'|'chestnuts'|'earphones'|'band'|'doll'|'chocolate'|'letter'|'notes'|'hat'|'labubu'|'mystery';
export type Gift = { id:GiftId; name:string; subtitle:string; message:string; variant:string; icon:number; x:number; y:number; point:[number,number] };
export const birthdayConfig = {
  girlName:'你', boyName:'我', birthdayDisplayText:'只属于你的特别日子', birthDateForMoon:'', moonImage:'',
  welcome:'你来啦。今天不用赶路，慢慢拆。',
  letterText:'【生日信 · 待填写】\n\n亲爱的你：\n\n这里留给那些想认真对你说的话。\n\n这里尚未放入真正的生日信。可以写下感谢、祝愿，或想一起完成的小事。\n\n不用写得很长，真心就好。\n\n—— 我',
  notes:['【可替换示例】今天的愿望，可以慢慢想。','【可替换示例】累了就坐一会儿，我陪你。','【可替换示例】愿下一岁的日常，也有小小的惊喜。'],
  labubuReveal:{text:'拆开现实中的礼物，看看是哪一只。',image:''},
  mysteryBoxReveal:{text:'真正的惊喜，在现实中的盒子里。',image:''},
  mysteryBoxUnlockMode:'anytime' as 'anytime'|'afterCake',
  musicSources:[] as string[],
  characterAppearance:{girl:'参考图改编：棕灰披肩发、遮眼刘海、蓝白条纹衬衫、编织斜挎猫咪包；四方向行走',boy:'深棕短发、绿色马甲（默认原创形象）'},
  gifts:[
    {id:'moon',name:'出生那天的月亮',subtitle:'把一束月光，留在窗边',icon:0,x:315,y:103,point:[320,139],message:'【待填写赠言】从你来到世界的那天起，月光就有了特别的意义。',variant:''},
    {id:'keychain',name:'歌词钥匙扣',subtitle:'让一句喜欢的话，陪你出门',icon:1,x:505,y:179,point:[461,209],message:'【待填写赠言】把想说的话，挂在你每天经过的地方。',variant:''},
    {id:'chestnuts',name:'一小碗栗子',subtitle:'百草味板栗仁 · 一起分享',icon:2,x:166,y:269,point:[201,291],message:'【待填写赠言】窝在沙发里，分你一半暖乎乎的甜。',variant:''},
    {id:'earphones',name:'胶囊里的小宇宙',subtitle:'水月雨 PILL 耳机',icon:3,x:580,y:174,point:[456,227],message:'【待填写赠言】愿好听的声音，总在你需要的时候出现。',variant:''},
    {id:'band',name:'陪你走过每一天',subtitle:'小米手环 11',icon:4,x:540,y:99,point:[540,155],message:'【待填写赠言】不必追赶什么，按照自己的节奏就好。',variant:''},
    {id:'doll',name:'软绵绵的陪伴',subtitle:'华晨宇属性棉花娃娃',icon:5,x:582,y:76,point:[584,155],message:'【待填写赠言】想抱抱的时候，总有一个小小的陪伴。',variant:''},
    {id:'chocolate',name:'把甜分给你',subtitle:'明治雪吻巧克力',icon:6,x:146,y:255,point:[201,270],message:'【待填写赠言】这一颗给你，下一颗也给你。',variant:''},
    {id:'letter',name:'一封认真写的信',subtitle:'烫金浮雕信封 · 写给你',icon:7,x:96,y:181,point:[167,201],message:'有些话，想写在纸上，慢慢交给你。',variant:''},
    {id:'notes',name:'日子里的小纸条',subtitle:'华晨宇周边便签本',icon:8,x:111,y:152,point:[167,171],message:'几句短短的话，留给平常的每一天。',variant:''},
    {id:'hat',name:'今天也很可爱',subtitle:'猫耳针织帽 · 可以试戴',icon:9,x:57,y:329,point:[99,337],message:'【待填写赠言】天气凉的时候，让它代替我抱抱你的脑袋。',variant:''},
    {id:'labubu',name:'神秘 LABUBU',subtitle:'是哪一只呢？亲手打开才知道',icon:10,x:520,y:69,point:[504,155],message:'答案藏在包装里面。',variant:''},
    {id:'mystery',name:'最后一个小秘密',subtitle:'神秘盒子 · 只等你亲手打开',icon:11,x:550,y:266,point:[495,294],message:'有一个惊喜，一直在这里等你。',variant:''},
  ] as Gift[]
};
