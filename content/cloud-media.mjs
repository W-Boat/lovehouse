export function validateCloudMedia(input) {
 if (input === undefined) return;
 if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Expected a media object');
 const result = {};
 const mediaUrl = value => {
  if (value === '') return value;
  if (typeof value !== 'string' || value.length > 2048 || /[<>"'\s]/.test(value)) throw Error('Invalid media URL');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw Error('Media requires HTTPS without embedded credentials');
  return url.href;
 };
 const keys = ['birthDateForMoon','moonImage','labubuImage','mysteryImage','concertAudio','memoryPhotos'];
 for (const key of Object.keys(input)) {
  if (!keys.includes(key)) throw Error('Unknown media field: ' + key);
 }
 for (const key of keys.slice(1,5)) {
  if (Object.hasOwn(input,key)) result[key] = mediaUrl(input[key]);
 }
 if (Object.hasOwn(input,'birthDateForMoon')) {
  const value = input.birthDateForMoon;
  if (value !== '') {
   if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error('Expected YYYY-MM-DD for birthDateForMoon');
   const date = new Date(value+'T00:00:00Z');
   if (!Number.isFinite(+date) || date.toISOString().slice(0,10) !== value) throw Error('Invalid birthDateForMoon');
  }
  result.birthDateForMoon = value;
 }
 if (Object.hasOwn(input,'memoryPhotos')) {
  const values = input.memoryPhotos;
  if (!Array.isArray(values) || values.length > 24 || values.includes('')) throw Error('Expected up to 24 memory photo URLs');
  result.memoryPhotos = values.map(mediaUrl);
 }
 return result;
}
