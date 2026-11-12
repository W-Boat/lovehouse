import type {Zone} from './world';
import type {Rect} from './navigation';
/** The base of each object is its ground contact. Seating uses cushion anchors. */
export type Furnishing={id:string;name:string;frame:number;x:number;y:number;w:number;h:number;solid?:Rect;hips?:[number,number,number,number];floor?:boolean};
const prop=(id:string,name:string,frame:number,x:number,y:number,w:number,h:number,hips?:Furnishing['hips']):Furnishing=>({id,name,frame,x,y,w,h,hips,solid:{x:x-w*.36,y:y-17,w:w*.72,h:19}});
const rug=(x:number,y:number,w=190,h=65):Furnishing=>({id:'central-rug',name:'脚下的软地毯',frame:7,x,y,w,h,floor:true});
export const furnishings:Partial<Record<Zone,Furnishing[]>>={
 memory:[rug(320,334,235,100),prop('memory-seat','中央双人观影软座',1,245,286,110,90,[222,254,266,254]),prop('memory-tea','胶片旁的热茶',0,365,302,78,78),prop('memory-books','可以借走的故事',5,472,292,75,85),prop('memory-lamp','观影落地灯',6,160,288,36,105)],
 magic:[rug(320,330),prop('magic-seat','愿望树下的双人软座',1,174,295,100,82,[153,266,195,266]),prop('potion','中央药水工作台',0,391,286,88,90),prop('magic-potion-cart','魔法茶水车',4,487,332,66,83),prop('magic-flowers','会发光的花',3,100,337,50,68)],
 haunted:[rug(320,337,210,85),prop('haunted-seat','幽灵留出的双人软座',1,194,291,108,89,[172,259,216,259]),prop('ghost-chess','会自己走棋的棋盘',13,350,299,72,54),prop('ghost-box','会咯咯笑的玩具箱',12,472,323,76,58),prop('ghost-blanket','替胆小鬼准备的毯子',14,119,343,48,32)],
 cinema:[rug(321,342,260,85),prop('cinema-seat','中央双人观影座',1,213,287,110,90,[190,255,236,255]),prop('cinema-back-seat','后排双人座',1,429,324,110,90,[406,292,452,292]),prop('popcorn','两人份点心车',4,119,334,63,84),prop('cinema-lamp','散场留灯',6,526,298,32,95)],
 ferris:[rug(320,342,180,60),prop('ferris-seat','中央候车双人座',1,193,316,108,89,[171,284,215,284]),prop('ferris-tea','乘车前的热茶',0,350,325,68,68),prop('ferris-flowers','游乐园花车',10,480,325,91,106)],
 mars:[prop('mars-seat','中央观演双人座',1,197,312,106,87,[175,281,219,281]),prop('mars-supplies','星球补给箱',12,451,316,81,62),prop('mars-tea','低重力热可可',0,340,329,69,69),prop('mars-lamp','返航引路灯',6,522,341,29,87)],
};
export function furnishingSeats(zone:Zone,id:string){return furnishings[zone]?.find(p=>p.id===id)?.hips}
