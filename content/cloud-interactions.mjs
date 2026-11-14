import {validateLayers} from './cloud-layers.mjs';
import {validatePortalUrl} from './cloud-portal-url.mjs';

const games = new Set(['moon','keychain','chestnuts','earphones','band','doll','chocolate','letter','notes','hat','labubu','mystery']);

export function validateGiftGames(input) {
 if (input === undefined) return;
 if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Expected giftGames object');
 return Object.fromEntries(Object.entries(input).sort().map(([id,url])=>{
  if (!games.has(id)) throw Error('Unknown gift ID');
  return [id,validatePortalUrl(url)];
 }));
}

export function validateCloudInteractions(input) {
 if (input === undefined) return;
 if (!Array.isArray(input) || input.length > 100) throw Error('Expected up to 100 interactions');
 const seen = new Set();
 return input.map(item => {
  if (!item || typeof item !== 'object') throw Error('Invalid interaction');
  const {id,zone,x,y,point,name,action,response,game,url,gameUrl,visual} = item;
  if (typeof id !== 'string' || !/^cloud-[a-z-]{1,33}$/.test(id) || seen.has(id)) throw Error('Invalid or duplicate interaction ID');
  seen.add(id);
  const within = (value,limit) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= limit;
  if (typeof zone !== 'string' || !/^(?:[a-z]{1,24}|cloud-[a-z]{1,18})$/.test(zone) || !within(x,640) || !within(y,426) ||
      !Array.isArray(point) || point.length !== 2 || !within(point[0],640) || !within(point[1],426)) throw Error('Invalid interaction coordinates');
  for (const [value,limit] of [[name,48],[action,24],[response,500]]) {
   if (typeof value !== 'string' || !value.trim() || value.length > limit) throw Error('Invalid interaction copy');
  }
  if (game !== undefined && !games.has(game)) throw Error('Unknown interaction game');
  if ([game,url,gameUrl].filter(value=>value!==undefined).length>1) throw Error('Choose one interaction destination');
  return {id,zone,x,y,point:[...point],name,action,response,game,url:url===undefined?undefined:validatePortalUrl(url),
   gameUrl:gameUrl===undefined?undefined:validatePortalUrl(gameUrl),visual:visual===undefined?undefined:validateLayers([visual])[0]};
 });
}
