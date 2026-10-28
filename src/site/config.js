/** Site-wide settings shared by the page build and the newsletter. */
export const SITE_NAME = 'ReadYourMood'; // change in one place

export function getSite({ includeDrafts = false, env = process.env } = {}) {
  return {
    name: SITE_NAME,
    url: (env.SITE_URL || 'https://readyourmood.app').replace(/\/$/, ''),
    preview: includeDrafts,
    includeDrafts,
  };
}
