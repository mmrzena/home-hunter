// Seznam's sdn.cz CDN hotlink-protects raw image URLs (401). Only whitelisted
// `fl=` derivatives resolve, referer-free: a 100 px thumbnail (what listings
// store; enough for dHash and feed cards) and a large one for galleries.
export const SDN_THUMBNAIL = "?fl=res,100,100,1|jpg,80";
const SDN_LARGE = "?fl=res,1200,1200,1|shr,,20|jpg,80";

/** The large derivative of a stored Sreality thumbnail; other URLs unchanged. */
export function largePhoto(url: string): string {
  return url.replace(SDN_THUMBNAIL, SDN_LARGE);
}
