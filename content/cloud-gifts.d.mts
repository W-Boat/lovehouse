import type {Gift,GiftId} from './birthday-config';
export function validateGiftOverrides(value:unknown):Partial<Record<GiftId,Partial<Omit<Gift,'id'|'icon'>>>>|undefined;
export function validateAnnouncement(value:unknown):{enabled:boolean;title:string;body:string}|undefined;
