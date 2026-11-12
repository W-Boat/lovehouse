/** Reject an adjacent cell's disconnected spill before finding a furniture anchor. */
export function isolateFurniture(data:Uint8ClampedArray,width:number,height:number){
 const labels=new Int32Array(width*height);let label=0,largest=0,best=0;
 for(let first=0;first<labels.length;first++){
  if(labels[first]||data[first*4+3]<=64)continue;
  label++;const stack=[first];labels[first]=label;let size=0;
  while(stack.length){const i=stack.pop()!;size++;const x=i%width,y=Math.floor(i/width);
   for(const next of [x>0?i-1:-1,x+1<width?i+1:-1,y>0?i-width:-1,y+1<height?i+width:-1]){
    if(next>=0&&!labels[next]&&data[next*4+3]>64){labels[next]=label;stack.push(next)}
   }
  }
  if(size>best){best=size;largest=label}
 }
 for(let i=0;i<labels.length;i++)if(labels[i]!==largest)data[i*4+3]=0;
}
