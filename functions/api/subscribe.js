import { handleSubscribe } from '../../src/shared/subscribe.js';

/** POST /api/subscribe: add an email to the newsletter (see src/shared/subscribe.js). */
export const onRequestPost = ({ request, env }) => handleSubscribe(request, env);
