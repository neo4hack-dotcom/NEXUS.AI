/**
 * webhookService (#5) — outbound Slack / Teams / generic notifications.
 *
 * Fire-and-forget POST to an incoming webhook URL. Slack and Teams accept
 * different JSON shapes, so we format per provider. Best-effort: failures are
 * swallowed (logged) so a flaky webhook never blocks the app.
 *
 * Note: many corporate Slack/Teams endpoints block cross-origin browser POSTs.
 * If that's the case in your environment, route this through the FastAPI
 * backend instead — the payload builder here is reusable as-is.
 */

import { WebhookConfig, WebhookEvent } from '../types';

const formatPayload = (cfg: WebhookConfig, title: string, body: string): string => {
  if (cfg.provider === 'teams') {
    return JSON.stringify({
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: 'FF3E00',
      summary: title,
      sections: [{ activityTitle: `**${title}**`, text: body }],
    });
  }
  if (cfg.provider === 'slack') {
    return JSON.stringify({
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: title } },
        { type: 'section', text: { type: 'mrkdwn', text: body } },
        { type: 'context', elements: [{ type: 'mrkdwn', text: 'DOINg.AI' }] },
      ],
    });
  }
  return JSON.stringify({ title, body, source: 'DOINg.AI' });
};

/**
 * Send a webhook for a given event if the config is enabled and subscribes to it.
 * Returns the new partial config telemetry to merge back into state, or null
 * if nothing was sent (disabled / not subscribed).
 */
export const sendWebhook = async (
  cfg: WebhookConfig,
  event: WebhookEvent,
  title: string,
  body: string,
): Promise<Partial<WebhookConfig> | null> => {
  if (!cfg.enabled || !cfg.url || !cfg.events.includes(event)) return null;
  try {
    await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: formatPayload(cfg, title, body),
      // Corporate webhooks rarely send CORS headers; no-cors lets the POST
      // leave the browser even though we can't read the response.
      mode: 'no-cors',
    });
    return { lastSentAt: new Date().toISOString(), lastStatus: 'success', lastMessage: `Sent: ${title}` };
  } catch (e: any) {
    console.warn('[DOINg] webhook send failed', e);
    return { lastSentAt: new Date().toISOString(), lastStatus: 'error', lastMessage: e?.message || 'Send failed' };
  }
};

export const EVENT_LABELS: Record<WebhookEvent, string> = {
  project_red:      'Project goes off-track',
  wg_session:       'Working-group session recorded',
  wish_accepted:    'Wish accepted by an admin',
  agent_production: 'Agent reaches production',
};
