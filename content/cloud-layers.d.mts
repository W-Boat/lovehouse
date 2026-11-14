export type CloudLayer={id:string;src:string;x:number;y:number;width:number;height:number;depth:number;autoplay:boolean;trigger?:string;frames?:{columns:number;rows:number;fps:number;loop:boolean};path?:{points:[number,number][];seconds:number}};
export function validateLayers(value:unknown):CloudLayer[]|undefined;
