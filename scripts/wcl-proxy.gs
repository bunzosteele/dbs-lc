/**
 * Loot Council Dashboard — WarcraftLogs Proxy Script
 *
 * Handles WarcraftLogs OAuth token exchange and GraphQL queries.
 * Each guild must deploy their own copy of this script — it handles
 * OAuth tokens and consumes Google Apps Script quota proportional
 * to roster size and how often WCL data is refreshed.
 *
 * Handles:
 *   ?action=wclAuth&payload=...   OAuth PKCE token exchange
 *   ?action=wclQuery&q=...&token=... GraphQL query proxy
 *
 * Deploy as:
 *   Execute as: Me
 *   Who has access: Anyone
 */

function handleWcl(e) {
  const params = e.parameter;
  const action = params.action;

  try {

    // ── WCL OAuth Token Exchange ──────────────────────────────────
    // Dashboard sends PKCE token exchange params as base64 JSON payload
    if (action === 'wclAuth') {
      const payload = JSON.parse(atob(params.payload));

      const response = UrlFetchApp.fetch('https://www.warcraftlogs.com/oauth/token', {
        method: 'post',
        contentType: 'application/x-www-form-urlencoded',
        payload: {
          grant_type:    payload.grant_type,
          client_id:     payload.client_id,
          redirect_uri:  payload.redirect_uri,
          code:          payload.code,
          code_verifier: payload.code_verifier,
        },
        muteHttpExceptions: true,
      });

      return ContentService
        .createTextOutput(response.getContentText())
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── WCL GraphQL Query ─────────────────────────────────────────
    // Query is base64-encoded to handle special characters safely
    if (action === 'wclQuery') {
      const query = decodeURIComponent(escape(atob(params.q)));
      const token = params.token;

      const response = UrlFetchApp.fetch('https://www.warcraftlogs.com/api/v2/client', {
        method: 'post',
        contentType: 'application/json',
        headers: {
          Authorization: 'Bearer ' + token,
        },
        payload: JSON.stringify({ query }),
        muteHttpExceptions: true,
      });

      return ContentService
        .createTextOutput(response.getContentText())
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Unknown request ───────────────────────────────────────────
    return ContentService
      .createTextOutput(JSON.stringify({ error: 'Unknown action. Expected wclAuth or wclQuery.' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
