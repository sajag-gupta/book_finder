/** Site-wide settings shared by the page build and the newsletter. */
export const SITE_NAME = 'ReadYourMood'; // change in one place

/** Who runs the site, shown on the About page and in the structured data. */
export const OWNER = { name: 'Sajag Gupta', email: 'stg.violin@gmail.com' };

export function getSite({ includeDrafts = false, env = process.env } = {}) {
  return {
    name: SITE_NAME,
    url: (env.SITE_URL || 'https://readyourmood.app').replace(/\/$/, ''),
    preview: includeDrafts,
    includeDrafts,
  };
}
