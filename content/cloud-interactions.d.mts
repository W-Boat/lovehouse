import type {CloudLayer} from './cloud-layers.mjs';
import type {GiftId} from './birthday-config';

export function validateGiftGames(input:unknown):Partial<Record<GiftId,string>>|undefined;
export type CloudInteraction = {
 id:string; zone:string; x:number; y:number; point:[number,number];
 name:string; action:string; response:string; visual?:CloudLayer; game?:GiftId; url?:string; gameUrl?:string;
};
export function validateCloudInteractions(input:unknown):CloudInteraction[]|undefined;
