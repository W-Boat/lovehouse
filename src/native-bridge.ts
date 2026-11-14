export type NativeBridge={postMessage:(data:string)=>void|Promise<unknown>};
export function nativeBridge():NativeBridge|undefined{
 const host=window as Window&{CottageSave?:NativeBridge;CottageDesktop?:NativeBridge};
 return host.CottageSave??host.CottageDesktop;
}
