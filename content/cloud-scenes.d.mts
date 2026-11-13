export type CloudScene = {
 id:`cloud-${string}`; parent:string; name:string; caption:string; background:string;
 entrance:[number,number]; spawn:[number,number]; exit:[number,number];
 floor:[[number,number],[number,number]];
};
export function validateCloudScenes(input:unknown):CloudScene[]|undefined;
