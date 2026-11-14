import assets from '../content/actor-art.json';
type Atlas={source:string;file:string;cols:number;rows:number;frames:string[]};
type FrameMap=Record<string,string>;
export const actorArt=assets as {atlases:Atlas[];solo:Record<string,Record<number,FrameMap>>;pairs:Record<string,Atlas>;duo:Record<string,FrameMap>};
export const actorAtlases=actorArt.atlases;
