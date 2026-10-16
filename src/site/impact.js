/**
 * Impact (impact.com) universal tracking tag, pasted from the Impact dashboard to verify this site for
 * their affiliate programs (for example ThriftBooks). It is added to the HOME PAGE ONLY.
 *
 * The site's Content-Security-Policy has no 'unsafe-inline', so this inline script is allowed by its
 * SHA-256 hash in public/_headers. If you change the snippet, a test fails until the hash matches.
 * Remove this tag (and the matching CSP entries) if you leave the Impact program.
 */
export const IMPACT_SNIPPET = `(function(i,m,p,a,c,t){c.ire_o=p;c[p]=c[p]||function(){(c[p].a=c[p].a||[]).push(arguments)};t=a.createElement(m);var z=a.getElementsByTagName(m)[0];t.async=1;t.src=i;z.parentNode.insertBefore(t,z)})('https://utt.impactcdn.com/P-A7985227-bca6-48cf-a5ea-591508e934b01.js','script','impactStat',document,window);impactStat('transformLinks');impactStat('trackImpression');`;

export const IMPACT_TAG = `<script type="text/javascript">${IMPACT_SNIPPET}</script>`;
