# Apps Script Setup Guide

The Apps Script proxy enables two optional features:

- **CLA via Google Sheets** — fetch your CLA exports directly from Google Sheets by URL, instead of pasting CSV manually
- **Item icon lookups** — automatically fetch Wowhead icons for items not already in the item database

If you set `"enable_apps_script": false` in `config.json`, neither feature is needed and you can skip this guide entirely. CLA data can still be imported by pasting raw CSV directly in the dashboard.

---

## Create the Apps Script Project

1. Go to [script.google.com](https://script.google.com) and click **New project**
2. Add four files to the project (use the **+** button next to Files):

### `main.gs` — router
```javascript
function doGet(e) {
  const action = e.parameter.action;
  if (action === 'wclAuth' || action === 'wclQuery') return handleWcl(e);
  if (e.parameter.itemId) return handleIconLookup(e);
  return handleProxy(e);
}
```

### `proxy.gs` — sheet fetches + item lookups
Paste the contents of `scripts/proxy.gs` from the repo.

### `wcl-proxy.gs` — WarcraftLogs OAuth + GraphQL
Paste the contents of `scripts/wcl-proxy.gs` from the repo.
Only needed if you are also enabling WarcraftLogs integration.

### `icon-lookup.gs` — Wowhead icon lookup
Paste the contents of `scripts/icon-lookup.gs` from the repo.

3. Click **Deploy → New deployment**
4. Type: **Web app** · Execute as: **Me** · Who has access: **Anyone**
5. Click **Deploy** and copy the URL

Set this URL as `apps_script` in `config.json` and set `enable_apps_script: true`.

---

## Using CLA with Apps Script Enabled

When `enable_apps_script` is `true`, the CLA tab shows URL and GID fields instead of paste fields.

**Finding GIDs:** Open the CLA Google Sheet, click the tab you want, and look at the URL: `...#gid=123456789` — the number after `gid=` is what you need.

For each raid CLA:
1. Navigate to the **CLA** tab → click **+ Add**
2. Fill in:
   - **Label** — short name shown in attendance table (e.g. `Mar 25`)
   - **Google Sheet URL** — the full URL of the CLA export sheet
   - **Issues GID** — gid of the Gear Issues tab
   - **Gear GID** — gid of the Gear Listing tab *(optional)*
   - **Consumes GID** — gid of the Buff Consumables tab
3. Click **+ Add** — data is fetched and parsed immediately

Make sure each CLA Google Sheet is set to **"Anyone with the link can view"**.

---

## Troubleshooting

**CLA sheets fail to load**
- Verify the sheet is set to "Anyone with the link can view"
- Check the GIDs are correct by inspecting the tab URLs
- Verify the `apps_script` URL in `config.json` is correct and deployed with "Anyone" access
- Check the Apps Script **Executions** tab for errors

**Icons not appearing**
- Icons only load for items not already in `gear-item-ids.json`
- If `enable_apps_script` is false, icons will not load for unknown items
