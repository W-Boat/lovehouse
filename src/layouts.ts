import type {Zone} from './world';
import type {Rect} from './navigation';
/** The base of each object is its ground contact. Seating uses cushion anchors. */
export type Furnishing={id:string;name:string;frame:number;x:number;y:number;w:number;h:number;solid?:Rect;hips?:[number,number,number,number];floor?:boolean;texture?:string;facing?:number;occlusion?:'rear'|'arms'};
const prop=(id:string,name:string,frame:number,x:number,y:number,w:number,h:number,hips?:Furnishing['hips']):Furnishing=>({id,name,frame,x,y,w,h,hips,solid:{x:x-w*.36,y:y-17,w:w*.72,h:19}});
const rug=(x:number,y:number,w=190,h=65):Furnishing=>({id:'central-rug',name:'脚下的软地毯',frame:7,x,y,w,h,floor:true});
export const furnishings:Partial<Record<Zone,Furnishing[]>>={
 memory:[rug(320,334,235,100),prop('memory-seat','中央双人观影软座',1,245,286,110,90,[222,254,266,254]),prop('memory-tea','胶片旁的热茶',0,365,302,78,78),prop('memory-books','可以借走的故事',5,472,292,75,85),prop('memory-lamp','观影落地灯',6,160,288,36,105)],
 magic:[rug(320,330),prop('magic-seat','愿望树下的双人软座',1,174,295,100,82,[153,266,195,266]),prop('potion','中央药水工作台',0,391,286,88,90),prop('magic-potion-cart','魔法茶水车',4,487,332,66,83),prop('magic-flowers','会发光的花',3,100,337,50,68)],
 haunted:[rug(320,337,210,85),prop('haunted-seat','幽灵留出的双人软座',1,194,291,108,89,[172,259,216,259]),prop('ghost-chess','会自己走棋的棋盘',13,350,299,72,54),prop('ghost-box','会咯咯笑的玩具箱',12,472,323,76,58),prop('ghost-blanket','替胆小鬼准备的毯子',14,119,343,48,32)],
 cinema:[rug(321,342,260,85),prop('cinema-seat','中央双人观影座',1,213,287,110,90,[190,255,236,255]),prop('cinema-back-seat','后排双人座',1,429,324,110,90,[406,292,452,292]),prop('popcorn','两人份点心车',4,119,334,63,84),prop('cinema-lamp','散场留灯',6,526,298,32,95)],
 ferris:[rug(320,342,180,60),prop('ferris-seat','中央候车双人座',1,193,316,108,89,[171,284,215,284]),prop('ferris-tea','乘车前的热茶',0,442,339,68,68),prop('ferris-flowers','游乐园花车',10,480,325,91,106)],
 mars:[prop('mars-seat','中央观演双人座',1,197,312,106,87,[175,281,219,281]),prop('mars-supplies','星球补给箱',12,451,316,81,62),prop('mars-tea','低重力热可可',0,340,329,69,69),prop('mars-lamp','返航引路灯',6,522,341,29,87)],
};
export function furnishingSeats(zone:Zone,id:string){return furnishings[zone]?.find(p=>p.id===id)?.hips}

export const actorHeights:Partial<Record<Zone,number>>={memory:72,hotspring:96,aurora:88,market:80};
export type BuiltSeat={id:string;name:string;zone:Zone;hips:[number,number,number,number];facing?:number};
export const backgroundSeats:BuiltSeat[]=[
 {id:'music-seat',name:'唱片机旁的双人沙发',zone:'musicroom',hips:[98,229,132,229],facing:3},
 {id:'music-window-seat',name:'窗边听歌长椅',zone:'musicroom',hips:[563,237,591,237],facing:1},
 {id:'school-seat',name:'银杏树下的双人长椅',zone:'highschool',hips:[120,250,145,250]},
 {id:'school-court-seat',name:'操场边的双人长椅',zone:'highschool',hips:[530,252,553,252]},
 {id:'catcottage-seat',name:'和猫一起发呆的长椅',zone:'catcottage',hips:[148,210,204,210]},
 {id:'shichahai-seat',name:'湖畔长椅',zone:'shichahai',hips:[180,274,222,274]},
 {id:'gulou-seat',name:'银杏下的长椅',zone:'gulou',hips:[153,285,193,285]},
 {id:'chaya-seat',name:'山风长椅',zone:'chaya',hips:[151,271,193,271]},
 {id:'tianmo-seat',name:'湖边木椅',zone:'tianmo',hips:[158,264,202,264]},
 {id:'tanghulu-seat',name:'等糖衣冷却的木凳',zone:'tanghulu',hips:[32,253,47,229],facing:3},

 {id:'chair-left',name:'蛋糕桌左侧大椅子',zone:'room',hips:[253,197,388,197]},
 {id:'chair-right',name:'蛋糕桌右侧大椅子',zone:'room',hips:[388,197,253,197]},
 {id:'sofa',name:'壁炉旁的沙发',zone:'room',hips:[68,281,101,281]},
 {id:'tea',name:'两杯热茶旁的沙发',zone:'room',hips:[68,281,101,281]},
 {id:'memory-armchair-left',name:'左边的大扶手椅',zone:'memory',hips:[100,169,185,169]},
 {id:'memory-armchair-right',name:'右边的大扶手椅',zone:'memory',hips:[185,169,100,169]},
 {id:'magic-mushroom-seat',name:'树边的蘑菇软座',zone:'magic',hips:[99,146,126,146]},
 {id:'haunted-back-sofa',name:'幽灵家的靠墙沙发',zone:'haunted',hips:[117,159,146,159]},
 {id:'cinema-side-armchairs',name:'散场聊天的大扶手椅',zone:'cinema',hips:[80,150,158,150]},
 {id:'ferris-back-bench',name:'站台旁的候车软椅',zone:'ferris',hips:[72,190,141,190]},
 {id:'hotspring-seat',name:'中央双人足浴座',zone:'hotspring',hips:[258,201,408,204]},
 {id:'market-seat',name:'花摊边的双人座',zone:'market',hips:[63,237,173,241]},
 {id:'aurora-seat',name:'中央双人摇椅',zone:'aurora',hips:[211,241,433,245]},
];
for(const zone of ['memory','cinema'] as Zone[])for(const p of furnishings[zone]??[])if(p.hips){p.texture=zone==='cinema'?'seat-cinema-back':'seat-memory-back';p.facing=2;p.occlusion='rear';p.hips=[p.hips[0],p.y-66,p.hips[2],p.y-66]}
export function seatDefinition(zone:Zone,id:string){return furnishings[zone]?.find(p=>p.id===id&&p.hips)??backgroundSeats.find(p=>p.zone===zone&&p.id===id)}
