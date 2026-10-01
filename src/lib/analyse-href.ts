/** Link to the analysis page of one listing (it runs the analysis on open). */
export function analyseHref(listingUrl: string): string {
  return `/analyse?url=${encodeURIComponent(listingUrl)}`;
}
