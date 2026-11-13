export function validatePortalUrl(value) {
 if (typeof value !== 'string' || value.length > 2048 || /[<>"'\s]/.test(value)) throw Error('Invalid portal URL');
 const url = new URL(value);
 if (url.protocol !== 'https:' || url.username || url.password) throw Error('Portal requires HTTPS without embedded credentials');
 return url.href;
}
