/**
 * Weekly email: three picks and, when there is one, a deal. Pure: takes data in, returns strings.
 * HTML uses table layout and inline styles because email clients ignore most modern CSS, and
 * system fonts because web fonts are not reliable in email.
 */
import { esc } from '../site/html.js';
import { goPath } from '../shared/links.js';
import { allStores } from '../shared/registry.js';

const INK = '#14213D';
const SKY = '#EAF5FF';
const SUNSHINE = '#FFC933';
const FONT = "'Trebuchet MS', 'Segoe UI', Arial, sans-serif";

const names = (slugs, vocab) => slugs.map((s) => vocab.find((v) => v.slug === s)?.name ?? s);

function utm(url, date) {
  const u = new URL(url);
  u.searchParams.set('utm_source', 'newsletter');
  u.searchParams.set('utm_medium', 'email');
  u.searchParams.set('utm_campaign', date);
  return u.toString();
}

/**
 * @param {object} issue  Validated issue file
 * @param {{bySlug: Map<string, object>, moods: object[], site: {name: string, url: string},
 *          config: {postalAddress?: string, unsubscribeTag?: string, replyTo?: string}}} ctx
 * @returns {{subject: string, html: string, text: string, warnings: string[]}}
 */
export function renderIssue(issue, { bySlug, moods, site, config }) {
  const warnings = [];
  if (!config.postalAddress?.trim()) {
    warnings.push(
      'config/newsletter.json has no postalAddress. Commercial email must carry a physical address: add one, or confirm your email service appends it.',
    );
  }
  if (!config.unsubscribeTag?.trim()) {
    warnings.push(
      'No unsubscribeTag set: confirm your email service adds an unsubscribe link automatically.',
    );
  }

  const picks = issue.picks.map((pick) => {
    const book = bySlug.get(pick.slug);
    return {
      book,
      url: utm(`${site.url}/books/${book.slug}/`, issue.date),
      tags: names(book.moods, moods).slice(0, 3),
      why: pick.note?.trim() || book.readIf,
    };
  });

  // Resolved objects go last: the issue file names the store and book by string id.
  const deal = issue.deal && {
    ...issue.deal,
    book: bySlug.get(issue.deal.slug),
    store: allStores.find((s) => s.id === issue.deal.store),
  };
  const dealUrl = deal
    ? utm(
        site.url +
          goPath(deal.store.id, deal.book.isbn13, `${deal.book.title} ${deal.book.author}`),
        issue.date,
      )
    : null;

  const button = (href, label, bg = INK, fg = '#FFFFFF') =>
    `<a href="${esc(href)}" style="display:inline-block;background:${bg};color:${fg};font-family:${FONT};font-weight:bold;font-size:16px;text-decoration:none;padding:12px 20px;border-radius:12px;">${esc(label)}</a>`;

  const pickHtml = picks
    .map(
      ({ book, url, tags, why }) => `
<tr><td style="padding:0 0 20px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SKY};border-radius:16px;">
    <tr><td style="padding:20px;font-family:${FONT};color:${INK};">
      <div style="font-size:22px;font-weight:bold;line-height:1.2;">${esc(book.title)}</div>
      <div style="font-size:16px;margin:4px 0 10px 0;">by ${esc(book.author)}</div>
      <div style="font-size:14px;margin:0 0 12px 0;">${tags.map((t) => `<span style="background:${SUNSHINE};border-radius:999px;padding:3px 10px;margin-right:6px;display:inline-block;">${esc(t)}</span>`).join('')}</div>
      <div style="font-size:16px;line-height:1.5;margin:0 0 14px 0;"><strong>Read this if</strong> ${esc(why)}</div>
      ${button(url, 'See where to get it')}
    </td></tr>
  </table>
</td></tr>`,
    )
    .join('');

  const dealHtml = deal
    ? `
<tr><td style="padding:0 0 20px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px solid ${INK};border-radius:16px;">
    <tr><td style="padding:20px;font-family:${FONT};color:${INK};">
      <div style="font-size:14px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">This week's deal</div>
      <div style="font-size:20px;font-weight:bold;margin:6px 0;">${esc(deal.headline)}</div>
      <div style="font-size:16px;line-height:1.5;margin:0 0 6px 0;">${esc(deal.book.title)} at ${esc(deal.store.name)}${deal.detail ? `. ${esc(deal.detail)}` : ''}</div>
      <div style="font-size:13px;color:#4A5568;margin:0 0 14px 0;">Price seen ${esc(deal.checkedOn)}. Prices change, so check the store.</div>
      ${button(dealUrl, deal.store.label, SUNSHINE, INK)}
    </td></tr>
  </table>
</td></tr>`
    : '';

  const footerLines = [
    `Some links are affiliate links: if you buy through them we may earn a small commission at no extra cost to you. It never changes what we recommend. ${site.url}/about/affiliate-disclosure/`,
    config.postalAddress?.trim(),
    config.unsubscribeTag?.trim() ? `Unsubscribe: ${config.unsubscribeTag.trim()}` : null,
  ].filter(Boolean);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(issue.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#FFFFFF;">
<div style="display:none;max-height:0;overflow:hidden;">${esc(issue.intro)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="padding:0 0 16px 0;font-family:${FONT};color:${INK};">
    <div style="font-size:26px;font-weight:bold;">${esc(site.name)}</div>
    <div style="font-size:17px;line-height:1.5;margin-top:12px;">${esc(issue.intro)}</div>
  </td></tr>
  ${pickHtml}
  ${dealHtml}
  <tr><td style="padding:8px 0 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:#4A5568;">
    ${footerLines.map((line) => `<p style="margin:0 0 8px 0;">${esc(line)}</p>`).join('')}
  </td></tr>
</table>
</td></tr></table>
</body>
</html>
`;

  const text = [
    site.name,
    '',
    issue.intro,
    '',
    ...picks.flatMap(({ book, url, tags, why }) => [
      `${book.title} by ${book.author}`,
      tags.join(', '),
      `Read this if ${why}`,
      `Where to get it: ${url}`,
      '',
    ]),
    ...(deal
      ? [
          `THIS WEEK'S DEAL: ${deal.headline}`,
          `${deal.book.title} at ${deal.store.name}${deal.detail ? `. ${deal.detail}` : ''}`,
          `Price seen ${deal.checkedOn}. Prices change, so check the store.`,
          dealUrl,
          '',
        ]
      : []),
    '--',
    ...footerLines,
    '',
  ].join('\n');

  return { subject: issue.subject, html, text, warnings };
}
