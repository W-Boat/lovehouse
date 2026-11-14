import {validateLayers} from './cloud-layers.mjs';
import {validatePortalUrl} from './cloud-portal-url.mjs';

export function validateCloudScenes(input) {
 if (input === undefined) return;
 if (!Array.isArray(input) || input.length > 12) throw Error('Expected up to 12 scenes');
 const ids = new Set();
 return input.map(scene => {
  if (!scene || typeof scene !== 'object') throw Error('Invalid scene');
  const {id,parent,name,caption,background,entrance,spawn,exit,floor} = scene;
  if (typeof id !== 'string' || !/^cloud-[a-z]{1,18}$/.test(id) || ids.has(id)) throw Error('Invalid scene ID');
  ids.add(id);
  const point = p => Array.isArray(p) && p.length === 2 && p.every((n,i)=>Number.isFinite(n)&&n>=0&&n<=[640,426][i]);
  if (typeof parent !== 'string' || !/^[a-z]{1,24}$/.test(parent) ||
      ![entrance,spawn,exit].every(point) || !Array.isArray(floor) || floor.length !== 2 || !floor.every(point) ||
      floor[0][0]>=floor[1][0] || floor[0][1]>=floor[1][1]) throw Error('Invalid scene geometry');
  if (typeof name !== 'string' || !name.trim() || name.length > 48 ||
      typeof caption !== 'string' || caption.length > 160) throw Error('Invalid scene copy');
  return {id,parent,name,caption,background:validatePortalUrl(background),entrance,spawn,exit,floor,layers:validateLayers(scene.layers)};
 });
}
