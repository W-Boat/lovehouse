export type PaperPoint={x:number;y:number};
export type PaperPiece={id:number;outline:PaperPoint[];target:PaperPoint;x:number;y:number;rotation:number;placed:boolean};
/** Shared torn edges: neighbouring scraps fit without square slots. */
export function letterPieces(level:number):PaperPiece[]{
 const xs=[190,263,337,410],ys=[48,157,266],nodes:PaperPoint[][]=[];
 for(let row=0;row<3;row++)nodes.push(xs.map((x,col)=>({x:x+(row===1&&col>0&&col<3?([13,-11,5][(col+level)%3]):0),y:ys[row]+(row===1?([12,-9,4][(col+level)%3]):0)})));
 const out:PaperPiece[]=[];
 for(let row=0;row<2;row++)for(let col=0;col<3;col++){
  const corners=[nodes[row][col],nodes[row][col+1],nodes[row+1][col+1],nodes[row+1][col]];

  const target={x:corners.reduce((n,p)=>n+p.x,0)/4,y:corners.reduce((n,p)=>n+p.y,0)/4},id=out.length;
  out.push({id,outline:corners,target,x:col===0?75:col===1?525:(row?520:80),y:col===2?305:75+row*115,rotation:(id+level+1)%4,placed:false});
 }
 return out;
}
export function snapPaper(piece:PaperPiece,tolerance=23){
 if(piece.placed||piece.rotation%4!==0||Math.hypot(piece.x-piece.target.x,piece.y-piece.target.y)>tolerance)return false;
 piece.x=piece.target.x;piece.y=piece.target.y;piece.rotation=0;piece.placed=true;return true;
}
export function paperContains(piece:PaperPiece,point:PaperPoint){
 const angle=-piece.rotation*Math.PI/2,dx=point.x-piece.x,dy=point.y-piece.y,p={x:dx*Math.cos(angle)-dy*Math.sin(angle)+piece.target.x,y:dx*Math.sin(angle)+dy*Math.cos(angle)+piece.target.y};
 let inside=false;const a=piece.outline;for(let i=0,j=a.length-1;i<a.length;j=i++)if((a[i].y>p.y)!==(a[j].y>p.y)&&p.x<(a[j].x-a[i].x)*(p.y-a[i].y)/(a[j].y-a[i].y)+a[i].x)inside=!inside;return inside;
}
