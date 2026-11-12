import {furnishings} from '../src/layouts';
import {worlds} from '../src/world';
export type PlaceContent={text:string;choice:string;response:string;sit?:string};
export const places:Record<string,PlaceContent>={
 'aquarium-seat':{text:'玻璃另一边，水母像一盏盏小灯。它们没有急着去哪里，我们也不用。',choice:'坐下来，把时间放慢',response:'海水那么蓝，身边这一点暖却很清楚。',sit:'aquarium-seat'},
 jellyfish:{text:'那只小水母正在慢慢游过来。把手心靠在玻璃外，等它经过吧。',choice:'陪它游一小段',response:'你看，不用追赶，也会有柔软的光向你靠近。'},
 'ocean-echo':{text:'听筒里传来一声低低的回响。像很远的海，又像一句没有说完的晚安。',choice:'把另一边听筒分给你',response:'隔着同一片海，我们听见了同一句祝福。'},
 'camp-seat':{text:'原木上铺了软垫，火光把两个人的影子拉得很近。今晚不用把自己绷得那么紧。',choice:'围着篝火坐下来',response:'愿你新的一岁，总有一盏灯、一团火，和愿意等你的人。',sit:'camp-seat'},
 marshmallow:{text:'棉花糖要离火远一点，慢慢转。想把第一串烤得金黄的留给谁？',choice:'把第一串递给你',response:'外面一点脆，里面很软。你一口，我一口，甜味刚刚好。'},
 'camp-lights':{text:'灯串绕过树梢，一端的开关就在手边。把回来的路照亮吧。',choice:'一盏接一盏，点亮',response:'不用记住每个岔路。看见这串灯，就知道有人在等你。'},
 'camp-story':{text:'故事里的小熊总担心自己走得太慢。有一天，它回头看见，朋友一直在身后，提着灯陪它。',choice:'再听一小段',response:'后来它们没有赶上日落，却一起看见了第一颗星星。故事到这里，也很好。'},

 'station-seat':{text:'长椅没有写着必须出发的时间。今天可以只是坐着，等云被太阳一点点照亮。',choice:'肩并肩等一会儿',response:'下一站去哪里都好。此刻，我想和你坐在一起。',sit:'station-seat'},
 'paper-plane':{text:'折痕里藏着一个小愿望。不必用力，它已经知道该往哪里飞。',choice:'把愿望交给风',response:'飞得远不远都没关系。愿你想去的地方，总有人愿意陪你。'},
 'station-bell':{text:'站钟响了，却没有催促任何人。有些路可以慢慢走，有些人值得多等一会儿。',choice:'听完这三声钟响',response:'生日快乐。新的一岁，愿你有出发的勇气，也有停下来的自由。'},
 clouds:{text:'云走得很慢。你看，它也没有因为晚一点到达，就少了一点好看。',choice:'把这一片云记下来',response:'不需要每一天都有答案。今天先和你一起看看天。'},
 'postal-seat':{text:'雨落在屋檐外，长椅上的位置却一直是干的。有人把伞往你这边挪了一点。',choice:'坐下来，一起躲雨',response:'等雨停吧。或者再坐一会儿，也很好。',sit:'postal-seat'},
 postmark:{text:'邮戳上的日期属于今天。想把生日的这一刻，盖进自己的小手记里吗？',choice:'盖下今日邮戳',response:'已珍藏：我们在晚安邮局，认真地过了这一天。'},
 'rain-awning':{text:'滴答，滴答。屋檐替我们把雨声收得很轻。不是每一句想念，都要立刻寄出。',choice:'安静听一会儿',response:'今天没说出口的话，也可以明天慢慢讲。'},

 luggage:{text:'先把行李放下来吧。今天没有要赶的下一站。',choice:'把脚步放慢一点',response:'走了多远都没关系，这里为你留着灯。'},
 fireplace:{text:'木柴轻轻响了一声，暖光落在地板上。要把这一角再烘暖一点吗？',choice:'添一小块木柴',response:'火光亮了一点。冷的时候，就回这里坐坐。'},
 tea:{text:'茶壶里还留着热水，杯子恰好是两只。',choice:'倒两杯，一起坐下',response:'热茶的白雾慢慢升起来。等它凉一点，我们再喝。',sit:'tea'},
 flowers:{text:'花香很淡，凑近才能闻见。好像有些喜欢，也是这样安安静静的。',choice:'多停留一会儿',response:'不必把所有美好都带走，记住这一点香气就好。'},
 window:{text:'隔着玻璃，月色落在肩膀上。窗外很远，身边的人很近。',choice:'并肩看一会儿月亮',response:'今晚的月光，我们一人一半。',sit:'window'},
 chime:{text:'风铃停着，像一句还没说出口的话。',choice:'轻轻碰一下',response:'叮——短短的一声，被海风带得很远。'},
 shell:{text:'把海螺靠近耳边，像听见一片小小的海。',choice:'也给你听一听',response:'你听，海浪没有催我们回去。'},
 keepsake:{text:'这盏灯替路过的人记着海边的夜晚。想在这里留一会儿吗？',choice:'一起看海',response:'这一晚，有海风，有灯火，也有你。',sit:'sea'},
 picnic:{text:'毯子铺好了，空位也留好了。没有安排，只等你坐下。',choice:'把脚步放下来',response:'树叶挡住了远处的声音，这里只剩我们和风。',sit:'picnic'},
 fireflies:{text:'先别急着追。安静一点，它们会自己靠近。',choice:'坐下来等萤火',response:'一颗、两颗……有些微小的光，会主动走向你。',sit:'fireflies'},
 lanterns:{text:'灯串还暗着。要不要亲手点亮这片小小的森林？',choice:'把灯点起来',response:'一盏接一盏亮了。愿你走到哪里，都有温柔的光。'},
 fountain:{text:'泉水听过很多愿望。你的这一句，可以只说给自己听。',choice:'悄悄留一个愿望',response:'水面轻轻晃了一下。愿望已经好好收下了。'},
 oak:{text:'大树替我们挡住了风，长椅上还能靠近一点。',choice:'并肩坐下',response:'你不说话也很好。我喜欢这样陪着你。',sit:'oak'},
 telescope:{text:'镜筒里是装饰性的遥远星光。今晚没有要记住的星座，只要你看得开心。',choice:'把星光分给你看',response:'有些光走了很远，才恰好在今晚遇见我们。'},
 'pier-bench':{text:'木板被夜风吹凉了，披毯就在旁边。',choice:'把毯子分一半',response:'靠近一点吧。这一小块暖和的地方，是我们的。',sit:'pier-bench'},
 bottle:{text:'【可替换示例】写给未来的你：愿你偶尔回头时，也能记起，自己曾被这样认真地祝福。',choice:'把信重新收好',response:'瓶中信留在栈桥上，想读的时候再来。'},
 tide:{text:'潮水来，又退回去。好像在提醒我们，慢一点也来得及。',choice:'听一会儿浪声',response:'什么都不做，也是在一起过生日。',sit:'tide'},
 starlight:{text:'不用盯紧整片天空。我们坐着等，错过一颗，也还有下一颗。',choice:'一起等一颗流星',response:'如果看见了，就悄悄再许一个愿。',sit:'starlight'}
};
export const restingLines:Record<string,string>={'aquarium-seat':'水母慢慢游着，我们慢慢坐着。','camp-seat':'火光还暖着，晚安不用急着说。','station-seat':'今天不赶车。下一站，我们慢慢想。','postal-seat':'雨还在下，身边的空位一直留给你。',
 sofa:'壁炉暖暖的，有你在身边就很好。',tea:'不急，茶还热着。',swing:'风把秋千轻轻推了一下，也把时间放慢了。',bench:'把肩膀借给你。今晚，不急着回去。',sea:'听，海浪也在轻轻说生日快乐。',window:'今晚的月光，我们一人一半。',picnic:'把脚步放下来，世界会等我们一会儿。',fireflies:'再安静一点，微光就会靠近。',oak:'你不说话也很好，我就在旁边。','pier-bench':'把披毯分一半，也把这一晚分给你。',tide:'听完这一阵浪，再听下一阵。',starlight:'错过一颗也没关系，我们有一整晚。'
};

const extra:Record<string,[string,string,string,string?]>={
 'hotspring-seat':['两张软椅紧挨着温热的水，毛巾就在旁边。','坐下来泡泡脚','今天走过的路，到这里可以先放下了。','hotspring-seat'],
 'market-seat':['逛累了吗？花摊边的茶还热着。','坐下分一杯茶','等会儿再逛。现在先陪你坐一会。','market-seat'],
 'aurora-seat':['两把摇椅对着整片天空，毯子也备好了。','坐着等极光','出现了。你看，绿色的光正在山尖上慢慢走。','aurora-seat'],
 'spring-tea':['樱花落进杯子里，香气很淡。','给你那一杯','小心烫，先捧在手里暖一会儿。'],
 'spring-towel':['毛巾刚烘好，折得方方正正。','替你拿一条','很暖。等会儿起来，脚也不会凉。'],
 'spring-petals':['花瓣顺着水波绕了半圈。','用脚尖拨一下水','两片花瓣碰到一起，又慢慢漂远了。'],
 'spring-snow':['屋里暖着，山上的雪还没化。','一起看一会儿','雪落得很慢，今天的时间也是。'],
 'market-flower':['这朵花的颜色，很像你刚才挑的衣服。','挑一朵送给你','不用等特别的日子，今天也可以买花。'],
 'market-bread':['刚出炉的面包太大了，一个人吃不完。','把软的那半给你','边走边吃，掉一点面包屑也没关系。'],
 'market-cake':['小摊上的蛋糕留了两把勺子。','点亮一根蜡烛','不用再许一次愿。先吃一口甜的吧。'],
 'aurora-tea':['杯沿还冒着白雾。','把杯子递给你','捧一会儿，等窗外的光慢慢变色。'],
 'aurora-fire':['木柴噼啪响了一声。','添一块柴','火旺了一点。想坐多久都可以。'],
 'aurora-blanket':['毯子够大，可以盖住两个人。','分一半给你','你那边暖了吗？再往你那里挪一点。'],
 'aurora-wish':['玻璃上起了一点薄雾，刚好够写几个字。','写下：明年也来','字会慢慢淡掉，约定先记在这里。'],

 'magic-seat':['这里的蘑菇长得像一把小椅子。软垫已经铺好了。','一起坐下','今天也可以做一个不必解释的梦。','magic-seat'],
 'haunted-seat':['幽灵挪开了靠垫：别怕，我只是有点怕孤单。','挨着坐一会','好啦，今晚谁也不是一个人。','haunted-seat'],
 'cinema-seat':['座位只有两张。爆米花可以一人一半。','坐下等开场','灯暗下来了，身边的人更清楚了。','cinema-seat'],
 'ferris-seat':['下一趟车厢还没到。要把肩膀借给你吗？','靠一会儿','等一等也很好，我们又多坐了一会。','ferris-seat'],
 'mars-seat':['演出还没开始，红色的山丘已经亮起了灯。','坐在一起','今晚的第一束光，留给你。','mars-seat'],
 potion:['两滴月光，一点莓果色。要调成什么颜色？','调一杯粉色星光','药水亮了一下。愿今天的普通小事，也有一点魔法。'],
 spell:['魔杖有点紧张，好像第一次给人过生日。','数到三，一起挥','一、二、三！星光很认真地撒了出来。'],
 ghost:['它本来准备吓你一跳，结果先被自己的影子吓到了。','一起做个鬼脸','你笑出来的时候，它也就不怕了。'],
 portrait:['画像眨了一下眼，又装作什么都没发生。','我看见啦','它悄悄红了脸。今晚的小秘密又多了一个。'],
 'ghost-box':['箱子里没有怪物，只有一个笑得停不下来的玩具熊。','跟着它笑一下','今天允许两个人一起有点不正常。'],
 popcorn:['爆米花有一点甜，杯子上还留着温度。','把最大的那颗给你','你一颗，我一颗。片头还没有结束。'],
 'memory-photos':['没有特别盛大的事，只是某天，我们一起走了一段路。','多看一眼','原来平凡的日子，回头看也会发光。'],
 'room-lights':['光太亮了吗？把这一角调成适合休息的样子吧。','留一盏暖光','灯还亮着，什么时候回来都可以。'],
 books:['书页停在一段旅行的开头，旁边夹着一张小纸条。','读读那张纸条','不必每次出发都很勇敢。愿意走，就很好。'],
 candles:['烛火很轻，像一个还没说出口的小愿望。','点亮这一点光','愿你需要的时候，总能找到一点暖。'],
 cabinet:['礼物收在这里，喜欢的物件也可以摆出来。','替它们理理位置','每一份心意都有地方放，不用急着拆完。'],
};
for(const [id,[text,choice,response,sit]]of Object.entries(extra))places[id]={text,choice,response,sit};
for(const w of Object.values(worlds))for(const i of w.items)if(!i.to&&!places[i.id]&&i.kind==='event')places[i.id]={text:i.name+'就在这里。想和身边的人一起试一试吗？',choice:i.action??'试一试',response:'这一小段时间，也一起记住了。'};

for(const props of Object.values(furnishings))for(const p of props){if(p.hips){places[p.id]={text:'软垫铺好了，旁边的空位是留给你的。',choice:'一起坐下',response:'现在不用去别处，再陪你坐一会儿。',sit:p.id};restingLines[p.id]='灯还亮着，身边也有人。'}else if(!p.floor&&!places[p.id])places[p.id]={text:p.name+'就在手边。',choice:'和你一起看看',response:'小小的日常，今天也一起记住了。'}}
