/** Public assets live beside the built JS, including deployments under /birthday/. */
export const textureFiles={'world-actors':'world-actors.webp','wheel-actors':'wheel-actors.webp','girl-heads':'girl-heads.webp','boy-heads':'boy-heads.webp',magic:'magic.webp',haunted:'haunted.webp',cinema:'cinema.webp',ferris:'ferris-clean.webp',mars:'mars.webp',memory:'memory-v2.webp','girl-walk':'girl-walk.webp','boy-walk':'boy-walk.webp','girl-actions':'girl-actions.webp','boy-actions':'boy-actions.webp','icons-v2':'icons-v2.webp','gifts-v2':'gifts-v2.webp',aquarium:'aquarium-clean.webp',camp:'camp.webp',station:'station-clean.webp',postoffice:'postoffice.webp',sitting:'sitting.webp',greenhouse:'greenhouse.webp',room:'cottage.webp',garden:'coast.webp','room-after':'cottage-after.webp',forest:'forest.webp',pier:'pier.webp',characters:'characters.webp',gifts:'gifts.webp',props:'props.webp',hero:'hero.webp',cake:'birthday-cake.webp'} as const;
export function resolveAssetUrl(filename:string,moduleUrl:string,development=false,publicBase='./'){
 return new URL(development?`${publicBase}assets/${filename}`:filename,development?new URL('../',moduleUrl):moduleUrl).href;
}
export function assetUrl(filename:string){return resolveAssetUrl(filename,import.meta.url,import.meta.env.DEV,import.meta.env.BASE_URL)}
export function mediaUrl(value:string){const match=/^\.?\/?assets\/(.+)$/.exec(value);return match?assetUrl(match[1]):value}

export const coreTextureKeys=['room','room-after','hero','characters','gifts','props','sitting','cake','girl-actions','boy-actions','girl-walk','boy-walk','icons-v2','gifts-v2','world-actors','wheel-actors','girl-heads','boy-heads'] as const;
