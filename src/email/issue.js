/**
 * Validation for a weekly issue file (data/newsletter/<date>.json).
 *
 * The plan's format is three picks and one deal. Picks must be reviewed books. A deal is optional
 * (there are no price feeds yet) but, when present, must name the date the price was checked so a
 * stale price is visible to the editor before sending.
 */
import { allStores } from '../shared/registry.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {object} issue
 * @param {Set<string>} reviewedSlugs  Slugs of reviewed books
 * @returns {string[]} problems; empty when the issue is sendable
 */
export function validateIssue(issue, reviewedSlugs) {
  const errors = [];
  if (!DATE.test(issue.date ?? '')) errors.push('date must be YYYY-MM-DD');
  if (!issue.subject?.trim()) errors.push('subject is required');
  else if (issue.subject.length > 60) errors.push('subject is longer than 60 characters');
  if (!issue.intro?.trim()) errors.push('intro is required');

  const picks = issue.picks ?? [];
  if (picks.length !== 3) errors.push(`needs exactly 3 picks, found ${picks.length}`);
  const seen = new Set();
  for (const pick of picks) {
    if (!reviewedSlugs.has(pick.slug)) errors.push(`pick "${pick.slug}" is not a reviewed book`);
    if (seen.has(pick.slug)) errors.push(`pick "${pick.slug}" appears twice`);
    seen.add(pick.slug);
  }

  const deal = issue.deal;
  if (deal) {
    if (!reviewedSlugs.has(deal.slug))
      errors.push(`deal book "${deal.slug}" is not a reviewed book`);
    if (!allStores.some((s) => s.id === deal.store))
      errors.push(`deal store "${deal.store}" is unknown`);
    if (!deal.headline?.trim()) errors.push('deal needs a headline');
    if (!DATE.test(deal.checkedOn ?? ''))
      errors.push('deal needs checkedOn (YYYY-MM-DD): when you saw the price');
  }
  return errors;
}
