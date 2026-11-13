import type {GiftId} from '../content/birthday-config';
import {furnishings,backgroundSeats} from './layouts';
import {roomWalkable,gardenWalkable,type Point,inside,inPolygon,type Polygon,segmentWalkable,nearestWalkable,type Walkable} from './navigation';
export type Zone=`cloud-${string}`|'room'|'garden'|'forest'|'pier'|'greenhouse'|'memory'|'station'|'postoffice'|'aquarium'|'camp'|'magic'|'haunted'|'cinema'|'ferris'|'mars'|'hotspring'|'market'|'aurora'|'shichahai'|'gulou'|'chaya'|'tianmo'|'tanghulu'|'catcottage'|'highschool'|'musicroom';
export type Item={id:string;name:string;x:number;y:number;point:[number,number];action?:string;kind?:'place'|'collect'|'slot'|'event';collect?:string;prop?:number;texture?:string;to?:Zone;practiceGame?:GiftId; webPortal?:string; externalGame?:string};
export type World={name:string;caption:string;texture:string;backgroundUrl?:string;spawn:[number,number];boy:[number,number];items:Item[];walkable:(point:Point)=>boolean};
// Broad walkable floor regions match the painted clearing/deck instead of invisible center lines.
const forestGround:Polygon=[[293,417],[338,417],[337,355],[350,315],[390,289],[438,269],[482,246],[516,221],[510,202],[490,193],[468,205],[444,218],[408,222],[379,208],[354,190],[348,155],[334,133],[305,133],[290,157],[282,191],[256,211],[230,219],[204,214],[181,200],[156,189],[134,200],[139,218],[167,236],[195,246],[219,259],[240,278],[253,291],[229,287],[210,293],[210,316],[242,337],[282,337],[294,365]];
export const forestWalkable=(p:Point)=>inPolygon(p,forestGround)&&!inside(p,{x:294,y:94,w:51,h:36},4)&&!inside(p,{x:505,y:165,w:65,h:31},4)&&!inside(p,{x:170,y:280,w:36,h:27},3);
export const pierWalkable=(p:Point)=>(inside(p,{x:107,y:187,w:467,h:119})||inside(p,{x:106,y:292,w:101,h:121}))&&!inside(p,{x:232,y:181,w:80,h:27},3)&&!inside(p,{x:493,y:185,w:34,h:22},3);
export const worlds:Record<Zone,World>={
 aquarium:{name:'潮汐水族馆',caption:'隔着一片蓝，也能靠得很近',texture:'aquarium',spawn:[320,370],boy:[346,370],walkable:p=>p.x>80&&p.x<560&&p.y>225&&p.y<399,items:[
 {id:'aquarium-seat',name:'水母窗前的长椅',action:'坐着看水母',x:200,y:173,point:[200,237]},
 {id:'jellyfish',name:'会发光的小水母',action:'等它靠近',x:320,y:120,point:[320,240]},
 {id:'ocean-echo',name:'海底回声听筒',action:'一起听听',x:468,y:180,point:[468,240]},
 {id:'aquarium-wish',name:'留在玻璃上的悄悄话',action:'写一句话',x:390,y:180,point:[390,242]},
 {id:'game-pairs',name:'找找相伴的小鱼',action:'玩一局',x:485,y:308,point:[485,308]},
 {id:'aquarium-return',name:'回星光栈桥',action:'返回',x:320,y:400,point:[320,380],prop:7,to:'pier'}]},
 camp:{name:'星野露营地',caption:'营灯亮着，今晚有地方安心停留',texture:'camp',spawn:[320,370],boy:[346,370],walkable:p=>p.x>80&&p.x<560&&p.y>225&&p.y<399,items:[
 {id:'camp-seat',name:'篝火旁的原木长椅',action:'围着火坐',x:160,y:150,point:[160,237]},
 {id:'marshmallow',name:'两串软软的棉花糖',action:'烤棉花糖',x:416,y:180,point:[416,240]},
 {id:'camp-lights',name:'等你点亮的营灯',action:'点灯',x:320,y:180,point:[320,240]},
 {id:'camp-story',name:'帐篷里留着的晚安故事',action:'听个故事',x:490,y:160,point:[490,240]},
 {id:'game-rhythm',name:'跟着篝火打节拍',action:'玩一局',x:485,y:308,point:[485,308]},
 {id:'camp-return',name:'回云上终点站',action:'沿灯下山',x:320,y:400,point:[320,380],prop:7,to:'station'}]},
 station:{name:'云上终点站',caption:'今天不赶末班车，陪你等天亮',texture:'station',spawn:[320,370],boy:[346,370],walkable:p=>p.x>80&&p.x<560&&p.y>225&&p.y<399,items:[
 {id:'camp-trail',name:'去星野露营地',action:'沿灯上山',x:520,y:330,point:[520,330],prop:7,to:'camp'},
 {id:'station-seat',name:'候车长椅',action:'坐着等天亮',x:160,y:180,point:[160,237]},
 {id:'paper-plane',name:'装着愿望的纸飞机',action:'放飞',x:448,y:184,point:[448,239]},
 {id:'station-bell',name:'迟到也没关系的站钟',action:'听钟声',x:320,y:160,point:[320,242]},
 {id:'clouds',name:'慢慢经过的云海',action:'看云',x:390,y:200,point:[390,240]},
 {id:'game-ribbon',name:'下一站的车票',action:'玩一局',x:475,y:300,point:[475,300]},
 {id:'station-return',name:'回萤火森林',action:'下山',x:320,y:400,point:[320,380],prop:7,to:'forest'}]},
 postoffice:{name:'晚安邮局',caption:'有些想念，写下来就有了去处',texture:'postoffice',spawn:[320,370],boy:[346,370],walkable:p=>p.x>80&&p.x<560&&p.y>225&&p.y<399,items:[
 {id:'postal-seat',name:'檐下的候信长椅',action:'一起躲雨',x:160,y:180,point:[160,237]},
 {id:'post-letter',name:'寄给明年的明信片',action:'写一封信',x:460,y:180,point:[460,239]},
 {id:'postmark',name:'今日限定的生日邮戳',action:'盖个邮戳',x:320,y:170,point:[320,240]},
 {id:'rain-awning',name:'屋檐下的雨滴',action:'听雨',x:390,y:202,point:[390,242]},
 {id:'game-wish',name:'散落的星星邮票',action:'玩一局',x:480,y:310,point:[480,310]},
 {id:'postal-return',name:'回月光海岸',action:'沿巷返回',x:320,y:400,point:[320,380],prop:7,to:'garden'}]},
 greenhouse:{name:'玻璃花房',caption:'把明年的花，也种在今晚',texture:'greenhouse',spawn:[320,370],boy:[345,370],walkable:p=>p.x>80&&p.x<560&&p.y>150&&p.y<400,items:[{id:'greenhouse-water',name:'花床旁的浇水壶',action:'给花浇点水',kind:'event',x:440,y:120,point:[440,180]},{id:'greenhouse-seat',name:'花房软椅',action:'依偎坐下',x:140,y:125,point:[150,165]},{id:'seed',name:'写给明年的种子',action:'种下心愿',x:320,y:110,point:[320,165]},{id:'game-pairs',name:'花瓣配对',action:'玩一局',x:440,y:265,point:[440,290]},{id:'greenhouse-return',name:'回海岸',action:'回去',x:320,y:397,point:[320,380],to:'garden'}]},
 memory:{name:'回忆放映室',caption:'普通的日子，也值得反复播放',texture:'room-after',spawn:[320,353],boy:[363,338],walkable:roomWalkable,items:[{id:'memory-seat',name:'回忆沙发',action:'坐下听故事',x:77,y:284,point:[214,320]},{id:'future',name:'给未来的一句话',action:'写下来',x:197,y:320,point:[220,324]},{id:'game-sequence',name:'记忆放映机',action:'玩一局',x:490,y:180,point:[474,246]},{id:'memory-return',name:'回到小屋',action:'回去',x:320,y:393,point:[320,379],to:'room'}]},
 room:{name:'温暖的小屋',caption:'壁炉暖着，今晚不用赶路',texture:'room',spawn:[320,353],boy:[363,338],walkable:roomWalkable,items:[
 {id:'taoyuan-portal',name:'通往桃源乡的门',action:'一起去田庄',x:320,y:282,point:[320,318]},
 {id:'chair-left',name:'蛋糕桌左侧大椅子',action:'坐下',x:252,y:201,point:[221,242]},{id:'chair-right',name:'蛋糕桌右侧大椅子',action:'坐下',x:388,y:201,point:[430,242]},{id:'record',name:'唱片机的秘密节拍',action:'来段鬼畜舞',x:534,y:177,point:[477,247]},{id:'memory-door',name:'回忆放映室',action:'推开回忆',x:437,y:112,point:[440,146],to:'memory'},
 {id:'cake',name:'生日蛋糕',action:'许愿',x:320,y:170,point:[320,272]},
 {id:'sofa',name:'壁炉旁的沙发',action:'坐下',x:77,y:284,point:[214,320]},
 {id:'fireplace',name:'壁炉里的暖光',action:'添柴',x:78,y:103,point:[92,136]},
 {id:'tea',name:'两杯热茶',action:'倒茶',x:197,y:320,point:[220,324],prop:4},
 {id:'flowers',name:'窗边的花束',action:'闻花香',x:440,y:117,point:[442,146]},
 {id:'window',name:'留给两个人的月光',action:'看月亮',x:361,y:99,point:[369,143]},
 {id:'luggage',name:'放在门边的小行李',action:'看看',x:89,y:363,point:[120,352],texture:'pink-case'},
 {id:'door',name:'小屋的门',action:'出门',x:320,y:393,point:[320,379],to:'garden'}]},
 garden:{name:'月光海岸',caption:'秋千轻晃，海风正好',texture:'garden',spawn:[155,365],boy:[178,354],walkable:gardenWalkable,items:[
 {id:'postal-trail',name:'去晚安邮局',action:'沿巷走走',x:345,y:300,point:[345,300],prop:7,to:'postoffice'},
 {id:'greenhouse-door',name:'玻璃花房',action:'去花房',x:360,y:281,point:[360,281],prop:7,to:'greenhouse'},{id:'game-catch',name:'接住一阵花雨',action:'玩一局',x:400,y:277,point:[400,277]},
 {id:'swing',name:'花架秋千',action:'一起坐',x:307,y:140,point:[309,179]},
 {id:'bench',name:'树下长椅',action:'靠一会儿',x:153,y:188,point:[158,217]},
 {id:'keepsake',name:'海边的纪念物',action:'看看',x:463,y:214,point:[459,245]},
 {id:'sea',name:'月色里的海',action:'听海',x:505,y:222,point:[490,250]},
 {id:'chime',name:'树梢的风铃',action:'轻碰',x:214,y:191,point:[227,210],prop:2},
 {id:'shell',name:'路边的小海螺',action:'听一听',x:175,y:286,point:[188,289],prop:5},
 {id:'forest-trail',name:'萤火森林的小径',action:'去森林',x:239,y:182,point:[241,202],prop:7,to:'forest'},
 {id:'pier-trail',name:'通往星光栈桥',action:'去栈桥',x:532,y:246,point:[513,249],prop:7,to:'pier'},
 {id:'home',name:'小屋门口',action:'回屋',x:82,y:350,point:[137,365],to:'room'}]},
 forest:{name:'萤火森林',caption:'慢一点，等萤火落进眼睛',texture:'forest',spawn:[320,382],boy:[336,369],walkable:forestWalkable,items:[
 {id:'station-trail',name:'去云上终点站',action:'上山',x:352,y:308,point:[352,308],prop:7,to:'station'},
 {id:'game-rhythm',name:'萤火节拍',action:'玩一局',x:320,y:329,point:[320,329]},
 {id:'picnic',name:'林间野餐毯',action:'坐一坐',x:170,y:208,point:[195,240]},
 {id:'fireflies',name:'树桩上的微光',action:'等萤火',x:225,y:284,point:[225,306],prop:1},
 {id:'lanterns',name:'还没点亮的灯',action:'点灯',x:360,y:218,point:[355,245],prop:0},
 {id:'fountain',name:'林间许愿泉',action:'留个愿望',x:320,y:133,point:[320,174]},
 {id:'oak',name:'大树下的空位',action:'并肩坐',x:486,y:217,point:[475,240]},
 {id:'forest-return',name:'回海岸的小路',action:'沿路返回',x:320,y:407,point:[320,394],prop:7,to:'garden'}]},
 pier:{name:'星光栈桥',caption:'把说不完的话，交给潮汐',texture:'pier',spawn:[177,383],boy:[197,368],walkable:pierWalkable,items:[
 {id:'aquarium-trail',name:'去潮汐水族馆',action:'去看水母',x:450,y:270,point:[450,270],prop:7,to:'aquarium'},
 {id:'game-wish',name:'星星许愿签',action:'玩一局',x:340,y:260,point:[340,260]},
 {id:'telescope',name:'面向星空的望远镜',action:'看星星',x:514,y:180,point:[474,221],prop:3},
 {id:'pier-bench',name:'栈桥尽头的长椅',action:'靠近坐',x:270,y:184,point:[270,226]},
 {id:'bottle',name:'写给未来的瓶中信',action:'读一读',x:522,y:287,point:[499,284],prop:6},
 {id:'tide',name:'脚下的潮汐',action:'听浪',x:365,y:292,point:[374,280]},
 {id:'starlight',name:'一小片安静的星空',action:'等流星',x:416,y:157,point:[413,209]},
 {id:'pier-return',name:'回海岸的木栈道',action:'沿桥返回',x:173,y:406,point:[173,392],prop:7,to:'garden'}]}
} as Record<Zone,World>;
export function entrySpawn(from:Zone,to:Zone):[number,number]{if(to==='garden'&&from==='forest')return[270,199];if(to==='garden'&&from==='pier')return[486,250];return worlds[to].spawn}
export function actionLabel(item:Item,opened:boolean){if(item.action)return item.action;return opened?'重看':'拆开'}
export function inReach(player:Point,item:Item,walkable?:Walkable){if(item.id==='boy')return Math.hypot(player.x-item.x,player.y-(item.y+14))<43&&(!walkable||segmentWalkable(player,{x:item.x,y:item.y+14},walkable));return Math.hypot(player.x-item.point[0],player.y-item.point[1])<(item.to?14:25)}


export const openFloor=(p:Point)=>p.x>72&&p.x<568&&p.y>218&&p.y<396;
const newRoom=(name:string,caption:string,texture:string,back:Zone,items:Item[]):World=>({name,caption,texture,spawn:[320,370],boy:[346,370],walkable:openFloor,items:[...items,{id:texture+'-return',name:'返回'+(worlds[back]?.name??'来时的路'),action:'返回',x:320,y:401,point:[320,379],to:back}]});
const spot=(id:string,name:string,x:number,y:number,action:string,kind:Item['kind']='event',collect?:string):Item=>({id,name,x,y,point:[x,Math.max(232,y+28)],action,kind,collect});
worlds.magic=newRoom('魔法世界','今天，给普通的日子施一点魔法','magic','forest',[
 spot('magic-seat','蘑菇软座',109,161,'并肩坐下'),spot('potion','调色药水',475,147,'调一杯星光'),spot('spell','会回应的魔杖',389,245,'一起施法'),spot('floating-book','漂浮的书',245,245,'翻一页'),spot('wish-tree','发光的愿望树',320,140,'挂上愿望'),spot('magic-crystal','落在脚边的晶石',441,318,'拾取','collect','crystal'),{...spot('haunted-door','去鬼屋做客',520,280,'去看看'),to:'haunted'}]);
worlds.haunted=newRoom('幽灵来做客','别怕，它只是想一起过生日','haunted','magic',[
 spot('haunted-seat','幽灵家的沙发',141,159,'抱团坐一会'),spot('ghost','害羞的小幽灵',430,247,'打个招呼'),spot('portrait','偷偷眨眼的画像',211,246,'对视三秒'),spot('ghost-lights','忽明忽暗的灯',491,244,'把灯点亮'),spot('ghost-box','咯咯笑的玩具箱',530,249,'打开看看'),spot('ghost-ribbon','幽灵送的小丝带',396,320,'收下','collect','ribbon')]);
worlds.cinema=newRoom('两个人的电影院','电影会散场，今晚可以慢慢来','cinema','memory',[
 spot('cinema-seat','双人红绒座',106,163,'坐下选片'),spot('movie','只放给你看的电影',320,153,'选择影片'),spot('popcorn','两人份爆米花',530,239,'分一半'),spot('projector','还热着的放映机',493,245,'开机'),spot('movie-note','片尾的一句话',386,315,'写片尾留言'),spot('ticket','我们的电影票根',173,310,'收藏','collect','ticket')]);
worlds.ferris=newRoom('海边摩天轮','慢慢升高，也慢慢靠近','ferris','garden',[
 spot('ferris-seat','候车软椅',112,190,'靠肩等一会'),spot('ferris-ride','只属于我们的车厢',320,316,'一起乘坐'),spot('ferris-wish','最高处的小愿望',390,286,'许愿'),spot('ferris-photo','拍下一点心动',232,287,'合影'),spot('ferris-lights','游乐园的灯海',473,245,'点亮灯海'),spot('ferris-token','小小乘车纪念章',490,328,'收藏','collect','token')]);
worlds.mars=newRoom('火星演唱会','把今晚，唱给宇宙听','mars','station',[
 spot('mars-seat','月岩双人座',68,149,'坐下等开场'),spot('concert','火星主舞台',320,160,'观看演出'),spot('lightstick','属于你的应援棒',468,275,'举起应援棒'),spot('mars-dance','月球重力舞步',230,286,'跳一段'),spot('mars-message','写在星球上的话',390,310,'留句话'),spot('mars-stone','带一点星光回家',495,329,'收藏','collect','mars-stone')]);
worlds.memory={...newRoom('回忆放映室','让平凡的一天，也拥有片尾字幕','memory','room',[
 spot('memory-seat','回忆软座',135,183,'坐下看一会'),spot('memory-projector','老电影的第一束光',510,246,'打开投影'),spot('memory-photos','留在墙上的旧时光',204,240,'看一张照片'),spot('future','给未来的一句话',350,271,'写下来'),spot('memory-film','收好一卷胶片',490,318,'收藏','collect','film'),{...spot('cinema-door','去两个人的电影院',428,280,'推开胶片门'),to:'cinema'}]),texture:'memory'};
worlds.forest.items.push({...spot('magic-door','去魔法世界',300,345,'穿过传送门'),to:'magic'});
worlds.garden.items.push({...spot('ferris-trail','去海边摩天轮',430,262,'去游乐园'),to:'ferris'});
worlds.station.items.push({...spot('mars-train','乘星际列车去火星',520,310,'登车'),to:'mars'});
worlds.room.items.push(spot('books','书桌上没读完的书',101,163,'翻一页'),spot('room-lights','今晚的灯串',422,140,'调暖一点'),spot('candles','桌上的烛光',290,257,'点亮烛光'),spot('cabinet','收好心意的柜子',530,157,'整理礼物'),spot('flower-pick','可以带走的一朵花',446,155,'拾取','collect','flower'));
worlds.hotspring={...newRoom('暖汤足浴屋','鞋子放好，疲惫也放下来','hotspring','camp',[
 spot('hotspring-seat','中央双人足浴座',322,205,'一起泡泡脚'),spot('spring-tea','足浴旁的樱花茶',195,265,'倒两杯茶'),spot('spring-towel','晒得暖暖的毛巾',480,254,'拿条热毛巾'),spot('spring-petals','水面上的花瓣',326,253,'拨一下水'),spot('spring-lantern','池边的小灯',346,182,'调暗灯光'),spot('spring-snow','窗外的雪山',159,104,'看看远山')]),walkable:p=>p.x>90&&p.x<567&&p.y>237&&p.y<403&&!(p.x<177&&p.y<326)&&!inside(p,{x:182,y:219,w:117,h:38},5)&&!inside(p,{x:371,y:219,w:115,h:38},5)&&!inside(p,{x:232,y:232,w:65,h:34},5)&&!inside(p,{x:374,y:232,w:67,h:34},5)&&!inside(p,{x:80,y:255,w:180,h:65},5)&&!inside(p,{x:462,y:246,w:70,h:35},5)&&!inside(p,{x:429,y:285,w:61,h:41},5),spawn:[340,385],boy:[364,385]};
worlds.hotspring.items.find(i=>i.id==='spring-snow')!.point=[310,275];
worlds.market={...newRoom('云端生日集市','花、甜点，还有一个等你坐下的位置','market','ferris',[
 spot('market-seat','花摊边的双人座',112,251,'坐下喝茶'),spot('market-flower','今天新到的花',160,158,'挑一朵花'),spot('market-bread','刚出炉的面包',465,155,'掰一半分享'),spot('market-cake','中央生日甜点摊',330,263,'给蛋糕点灯'),spot('market-cart','绕着花车走一圈',330,173,'闻闻花香'),spot('market-lantern','屋顶的许愿灯',430,83,'点亮心愿')]),walkable:p=>p.x>72&&p.x<570&&p.y>150&&p.y<407&&!inside(p,{x:85,y:150,w:145,h:40},5)&&!inside(p,{x:400,y:150,w:132,h:38},5)&&!inside(p,{x:255,y:218,w:185,h:102},5)&&!inside(p,{x:62,y:218,w:144,h:67},5),spawn:[340,386],boy:[365,386]};
worlds.aurora={...newRoom('极光玻璃屋','摇椅轻轻晃，天上的光也慢慢走','aurora','station',[
 spot('aurora-seat','中央双人摇椅',320,240,'坐着等极光'),spot('aurora-tea','中央圆桌上的热饮',322,263,'一起喝点热的'),spot('aurora-telescope','窗边的望远镜',531,156,'看看雪山'),spot('aurora-fire','一直暖着的壁炉',79,204,'添一块柴'),spot('aurora-blanket','留在摇椅上的毯子',199,242,'分一半毯子'),spot('aurora-wish','写在玻璃上的愿望',345,153,'留一个愿望')]),walkable:p=>p.x>82&&p.x<560&&p.y>285&&p.y<401&&!inside(p,{x:154,y:223,w:112,h:60},5)&&!inside(p,{x:374,y:223,w:112,h:63},5)&&!inside(p,{x:267,y:255,w:108,h:42},5),spawn:[320,370],boy:[346,370]};
worlds.camp.items.push({...spot('spring-door','去暖汤足浴屋',530,350,'暖暖脚'),to:'hotspring'});
worlds.ferris.items.push({...spot('market-door','去云端生日集市',520,365,'逛逛集市'),to:'market'});
worlds.station.items.push({...spot('aurora-door','去极光玻璃屋',110,340,'等一场极光'),to:'aurora'});
// Travel scenes use the lower terrace as walkable ground. Art coordinates are in world units.
const trip=(id:Zone,name:string,caption:string,back:Zone,items:Item[],solid:number[][]=[])=>{
 worlds[id]={...newRoom(name,caption,id,back,items),walkable:p=>p.x>67&&p.x<575&&p.y>269&&p.y<399
  &&(p.y<356||p.x>242&&p.x<418)&&!solid.some(([x,y,w,h])=>inside(p,{x,y,w,h},5))};
};
const onward=(id:string,to:Zone,name:string,x=515,y=335):Item=>({id,to,name,x,y,action:'前往',point:[x,Math.min(y+8,350)]});
trip('shichahai','北京 · 什刹海','银锭桥下，灯影摇进水里','station',[
 spot('shichahai-tea','湖边的两杯茶',350,254,'喝口热茶'),
 spot('shichahai-bridge','银锭桥',354,122,'看灯影'),
 spot('shichahai-lantern','柳下的灯',126,216,'看看灯火'),
 spot('shichahai-photo','湖岸合影',466,305,'拍张照'),
 spot('shichahai-note','留在北京的一句话',274,282,'写张便签'),
 onward('to-gulou','gulou','走去鼓楼胡同'),
],[[300,272,112,45],[150,271,92,27]]);
trip('gulou','北京 · 鼓楼胡同','灰瓦下面，听见一天慢慢过去','shichahai',[
 spot('gulou-postcard','胡同明信片架',320,266,'翻一张明信片'),
 spot('gulou-drum','暮色中的鼓楼',367,100,'听一声鼓'),
 spot('gulou-tea','窗边茶桌',413,265,'喝杯热茶'),
 spot('gulou-photo','银杏下的合影',245,316,'拍张照'),
 spot('heartbeat-cards','心跳斗地主',469,296,'坐下打牌'),
 onward('to-tanghulu','tanghulu','去糖葫芦车间'),
],[[130,285,85,27],[296,271,70,25],[378,272,70,27]]);
trip('chaya','遂平 · 嵖岈山','石峰挤在一起，像在讲悄悄话','station',[
 spot('chaya-scope','山崖望远镜',348,219,'找找石猴'),
 spot('chaya-rock','石猴轮廓',384,85,'看奇石'),
 spot('chaya-tea','山风里的野餐篮',84,254,'歇脚喝茶'),
 spot('chaya-photo','石林观景台',445,316,'拍张照'),
 spot('chaya-note','山路便签',252,266,'写句话'),
 onward('to-tianmo','tianmo','下山去天磨湖'),
],[[125,272,98,21],[330,269,44,17],[235,264,54,27]]);
trip('tianmo','遂平 · 天磨湖','湖把一座山轻轻收在怀里','chaya',[
 spot('tianmo-boat','系好的小船',549,200,'看水纹'),
 spot('tianmo-tea','野餐桌上的茶',340,239,'倒两杯茶'),
 spot('tianmo-photo','湖边合影',452,324,'拍张照'),
 spot('tianmo-note','给湖边的一句话',422,297,'写张便签'),
 spot('heartbeat-jump','心跳跳一跳',264,323,'开始跳跃'),
],[[137,265,84,25],[285,246,129,52],[408,291,42,24]]);
trip('tanghulu','糖葫芦制作车间','铜锅冒着泡，等一串红山楂','gulou',[
 spot('sugar-prep','山楂与竹签',162,143,'备料串果'),
 spot('sugar-heat','铜锅与糖浆',317,121,'熬糖裹衣'),
 spot('sugar-cool','中间的晾糖架',315,222,'检查成品'),
 spot('sugar-sell','玻璃柜和订单',504,167,'接单经营'),
 spot('sugar-photo','今日糖葫芦',462,322,'拍张照'),
],[[235,233,160,39],[12,181,52,117]]);
worlds.station.items.push(onward('to-shichahai','shichahai','列车去北京',390,350),onward('to-chaya','chaya','列车去遂平',240,350));

worlds.catcottage={...newRoom('猫猫小屋','把脚步放轻，猫咪正在打盹','catcottage','greenhouse',[
 spot('cat-pet','团团',334,210,'摸摸猫'),
 spot('cat-play','羽毛逗猫棒',597,246,'陪它玩'),
 spot('cat-feed','猫咪饭碗',445,226,'添点猫粮'),
 spot('cat-photo','和团团合影',393,331,'拍张照'),
 spot('cat-note','猫爪便签',225,302,'留句话'),
]),walkable:p=>p.x>70&&p.x<566&&p.y>225&&p.y<399
 &&!inside(p,{x:289,y:205,w:97,h:42},5)};
worlds.greenhouse.items.push(onward('to-catcottage','catcottage','去猫猫小屋',469,353));

// A fictional campus inspired by Suiping No.1 Senior High School; not a surveyed replica.
worlds.highschool={...newRoom('某平一高','下课铃响了，这次一起慢慢走','highschool','chaya',[
 spot('school-bell','教学楼的上课铃',320,134,'听一声铃'),
 spot('school-board','银杏树下的布告栏',87,202,'翻看校园便签'),
 spot('school-basketball','操场边的篮球架',608,173,'投一颗球'),
 spot('school-plane','折好的一架纸飞机',365,277,'放飞纸飞机'),
 spot('school-note','毕业册里的空白页',230,307,'写下留言'),
 spot('school-radio','晚自习前的校园广播',407,179,'点一段广播'),
 spot('school-lunch','留给你的那份点心',582,318,'分一半点心'),
 spot('school-book','图书角的小书签',453,213,'收藏书签','collect','school-bookmark'),
 spot('school-photo','教学楼前的合影',320,300,'拍张合影'),
]),walkable:p=>((p.x>65&&p.x<578&&p.y>237&&p.y<400&&(p.y<356||p.x>242&&p.x<415))||(p.x>555&&p.x<627&&p.y>210&&p.y<310))
 &&!inside(p,{x:96,y:234,w:64,h:34},5)
 &&!inside(p,{x:515,y:234,w:63,h:35},5)
 &&!inside(p,{x:545,y:313,w:70,h:41},5)};
worlds.chaya.items.push(onward('to-highschool','highschool','去某平一高',544,337));
worlds.room.items.push(
 spot('room-cat-pet','团团 · 摸摸猫',435,329,'摸摸猫'),
 spot('room-cat-feed','团团的饭碗',461,333,'添点猫粮'),
 spot('room-cat-play','团团的绒线球',417,334,'陪猫玩一会'),
 spot('room-cat-follow','猫猫的小窝',451,316,'跟随 / 回窝'),
);

worlds.musicroom={...newRoom('两个人的唱片房','把喜欢的歌，放给身边的人听','musicroom','room',[
 spot('music-turntable','中央大唱片机',312,150,'播放 / 暂停'),
 spot('music-records','你的歌单与唱片',510,198,'配置歌单'),
 spot('music-next','下一张唱片',534,207,'换一首歌'),
 spot('music-floor','地板上的歌词光影',320,301,'切换投影亮度'),
 spot('music-note','夹在唱片里的小纸条',185,310,'写下点歌留言'),
 spot('music-photo','一起听歌的合影',360,333,'拍张合影'),
]),walkable:p=>p.x>70&&p.x<572&&p.y>218&&p.y<400&&(p.y<363||p.x>244&&p.x<398)
 &&!inside(p,{x:65,y:218,w:98,h:66},5)
 &&!inside(p,{x:537,y:208,w:84,h:89},5)};
worlds.room.items.push(onward('to-musicroom','musicroom','去两个人的唱片房',466,375));

// The painted carpet immediately in front of rear seats is usable floor too.
for(const [zone,rect]of [['memory',{x:75,y:202,w:142,h:32}],['magic',{x:80,y:184,w:92,h:50}],['cinema',{x:65,y:185,w:115,h:49}],['haunted',{x:90,y:195,w:95,h:39}]] as [Zone,{x:number;y:number;w:number;h:number}][]){const prior=worlds[zone].walkable;worlds[zone].walkable=p=>prior(p)||inside(p,rect)}
for(const seat of backgroundSeats){if(worlds[seat.zone].items.some(i=>i.id===seat.id))continue;worlds[seat.zone].items.push({...spot(seat.id,seat.name,(seat.hips[0]+seat.hips[2])/2,(seat.hips[1]+seat.hips[3])/2,'一起坐下'),kind:'event'})}
// Central furniture is part of navigation and interaction, rather than an ornamental overlay.
for(const [zone,props]of Object.entries(furnishings)){
 if(!props)continue;
 const w=worlds[zone as Zone],floor=w.walkable;
 w.walkable=p=>floor(p)&&!props.some(o=>o.solid&&inside(p,o.solid,7));
 for(const prop of props){if(prop.floor)continue;let item=w.items.find(i=>i.id===prop.id);const point:[number,number]=[prop.x,prop.y+33];
 if(item)Object.assign(item,{name:prop.name,x:prop.x,y:prop.y-prop.h*.45,point});else w.items.push({id:prop.id,name:prop.name,x:prop.x,y:prop.y-prop.h*.45,point,kind:'event',action:prop.hips?'并肩坐下':'一起看看'});
 }
}
for(const [zone,w] of Object.entries(worlds) as [Zone,World][]){
 if(w.items.length<7){w.items.push(spot(zone+'-keepsake','此处的一点小纪念',w.spawn[0],w.spawn[1]-10,'拾取','collect','shell'));}
 if(!w.items.some(i=>i.kind==='slot'))w.items.push({...spot(zone+'-display','放一件喜欢的小物',w.spawn[0]+30,w.spawn[1]-8,'摆放 / 取回','slot'),point:[w.spawn[0]+30,w.spawn[1]-8]});
}
export const links=(zone:Zone)=>worlds[zone].items.flatMap(i=>i.to?[i.to]:[]);
export function routeBetween(from:Zone,to:Zone):Zone[]{const queue:Zone[][]=[[from]],seen=new Set<Zone>([from]);while(queue.length){const path=queue.shift()!,last=path[path.length-1];if(last===to)return path;for(const next of links(last))if(!seen.has(next)){seen.add(next);queue.push([...path,next])}}return[]}

for(const w of Object.values(worlds))for(const item of w.items)if(!w.walkable({x:item.point[0],y:item.point[1]})){const safe=nearestWalkable({x:item.point[0],y:item.point[1]},w.walkable,160);if(safe)item.point=[safe.x,safe.y]}

for(const [zone,w]of Object.entries(worlds) as [Zone,World][]){let n=0;while(w.items.filter(i=>!i.to).length<6){const p=nearestWalkable({x:w.spawn[0]-40+n*45,y:w.spawn[1]-30},w.walkable,80);if(!p)break;w.items.push({id:zone+'-small-note-'+n,name:n?'替你留的一盏灯':'今日的小纸条',action:n?'点灯':'写一句话',x:p.x,y:p.y,point:[p.x,p.y],kind:'event'});n++}}

worlds.greenhouse.items.push({id:'greenhouse-vent',name:'花房的通风天窗',action:'打开或关上天窗',x:495,y:95,point:[495,185],kind:'event'});
