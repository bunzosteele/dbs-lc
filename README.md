# Loot Council Dashboard — Setup Guide

A TBC Classic loot council dashboard that tracks raid attendance, consumable usage, gear issues, BiS lists, and loot distribution to generate data-driven priority recommendations.

---

## Prerequisites

- A GitHub account (for hosting via GitHub Pages)
- A Cloudflare account (free tier is sufficient)
- A Google account (for the Apps Script proxy)
- Your guild's CLA (Combat Log Analytics) Google Sheet IDs
- *(Optional)* A WarcraftLogs account with API access

---

## 1. Fork the Repository

1. Go to [github.com/bunzosteele/dbs-lc](https://github.com/bunzosteele/dbs-lc)
2. Click **Fork** → choose your account
3. In your fork, go to **Settings → Pages**
4. Set **Source** to `Deploy from a branch`, branch `main`, folder `/ (root)`
5. After a minute your dashboard will be live at `https://<your-username>.github.io/<your-repo>/`

---

## 2. Set Up the Google Apps Script Proxy

The dashboard uses up to three Google Apps Script web apps as server-side proxies. Each is deployed the same way:

1. Go to [script.google.com](https://script.google.com) and click **New project**
2. Paste in the script contents (see below)
3. Click **Deploy → New deployment**
4. Type: **Web app** · Execute as: **Me** · Who has access: **Anyone**
5. Click **Deploy** and copy the URL

### Main Proxy Script (`apps_script`) — required

Paste the contents of `apps-script/proxy.gs`. This handles CLA Google Sheet fetches and Wowhead item lookups. It is **safe to share** — the repository's own hosted URL can be reused by multiple guilds if you prefer not to deploy your own. The script is stateless, involves no credentials, and consumes negligible quota (a few milliseconds per sheet fetch).

Copy the deployed URL — this is your `apps_script` value in `config.json`.

### WCL Proxy Script (`wcl_apps_script`) — required only if `enable_wcl: true`

Paste the contents of `apps-script/wcl-proxy.gs`. This handles WarcraftLogs OAuth token exchange and GraphQL queries. **Each guild must deploy their own copy** — this script consumes quota proportional to your roster size each time WCL data is refreshed, and handles OAuth tokens that should not be proxied through another guild's Google account.

Copy the deployed URL — this is your `wcl_apps_script` value in `config.json`.

### Icon Lookup Script (`icon_script`) — optional

Paste the contents of `apps-script/icon-lookup.gs`. Only called when an item appears in a CLA sheet that isn't already in `gear-item-ids.json`. If you fully seed your own item map, it is never invoked.

Copy the deployed URL — this is your `icon_script` value in `config.json`.

---

## 3. Set Up Cloudflare Worker + KV

### Create the KV Namespace

1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Go to **Workers & Pages → KV**
3. Click **Create a namespace**, name it anything (e.g. `LC_DATA`)
4. Note the namespace ID

### Deploy the Worker

1. Go to **Workers & Pages → Create application → Create Worker**
2. Name it anything (e.g. `my-lc-worker`)
3. Click **Deploy**, then **Edit code**
4. Paste the contents of `cloudflare-worker.js` from the repo
5. At the top of the file, replace `REPLACE_WITH_YOUR_TOKEN` with a secret string of your choice — this is your **write token** (keep it safe, share only with officers):
   ```js
   const WRITE_TOKEN = 'your-secret-token-here';
   ```
6. Click **Deploy**

### Bind the KV Namespace to the Worker

1. In your Worker, go to **Settings → Bindings**
2. Click **Add binding → KV Namespace**
3. Variable name: **`DB`** (must be exactly `DB`)
4. Select the KV namespace you created
5. Click **Save**

### Get Your Worker URL

Your Worker URL is shown on the Worker overview page:
```
https://your-worker-name.your-subdomain.workers.dev
```

---

## 4. Configure `config.json`

Edit `config.json` in the root of your repo:

```json
{
  "guild_name": "Your Guild Name",
  "guild_subtitle": "Loot Council Summary",
  "page_title": "Your LC",
  "cf_worker_url": "https://your-worker.your-subdomain.workers.dev",
  "apps_script": "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec",
  "icon_script": "https://script.google.com/macros/s/YOUR_ICON_SCRIPT_ID/exec",
  "enable_wcl": false
}
```

If you want WarcraftLogs integration (see Section 6), also add:
```json
  "enable_wcl": true,
  "wcl_apps_script": "https://script.google.com/macros/s/YOUR_WCL_SCRIPT_ID/exec",
  "wcl_client_id": "your-wcl-oauth-client-id",
  "wcl_realm": "your-realm-slug"
```

Commit and push — GitHub Pages will redeploy automatically.

---

## 5. Seed the KV Store

The dashboard reads all its data from Cloudflare KV. You need to push the initial JSON files from your repo into KV once.

### Prepare the JSON files

The following files in the `/data` subdirectory need to be populated before seeding:

| File | What it contains | How to populate |
|---|---|---|
| `roster.json` | Player names, roles, classes | Edit manually or via the Roster tab |
| `loot-glossary.json` | Raids, bosses, items, priorities | Edit via the Item Glossary tab |
| `bis-data.json` | BiS EPV data per spec/slot | Edit via the BiS Lists tab |
| `attendance.json` | Raid dates and attendance | Populated from CLA imports |
| `loot-distribution.json` | Historical loot per raid | Edit via the Loot Log tab |
| `gear-item-ids.json` | Item name → Wowhead ID map | Add items as they appear |
| `set-bonuses.json` | Tier set bonus multipliers | Edit via the T4/T5/T6 tab |
| `cla-sheets.json` | CLA sheet references | Added via the CLA tab |

The repo ships with template/empty versions of all these files.

### Run the seed command

1. Open your deployed dashboard in a browser
2. Enter your write token in the **Write Token** field and click **Save Token**
3. Open the browser developer console (F12 → Console)
4. Run:

```javascript
migrateFromGitHub()
```

5. Confirm the prompt — this reads each JSON file from your GitHub Pages URL and writes it to KV
6. You should see a summary like:
   ```
   loot-glossary.json: ✓
   roster.json: ✓
   attendance.json: ✓
   ...
   ```

> **Tip:** You can also seed individual files without re-seeding everything. For example, to push just `set-bonuses.json`:
> ```javascript
> saveJsonToGitHub('set-bonuses.json', { /* your data */ })
> ```

---

## 6. Set Up WarcraftLogs Integration (Optional)

Skip this section and set `"enable_wcl": false` in `config.json` if you don't want WCL performance data in the dashboard.

### Create a WarcraftLogs API Client

1. Go to [www.warcraftlogs.com/api/clients](https://www.warcraftlogs.com/api/clients)
2. Click **Create Client**
3. Fill in:
   - **Name**: anything (e.g. "My LC Dashboard")
   - **Redirect URL**: your GitHub Pages URL exactly, e.g. `https://yourusername.github.io/your-repo/`  
     *(Must match exactly — no trailing slash issues)*
4. Click **Create** and copy the **Client ID**

### Deploy Your WCL Proxy Script

Follow the Apps Script deployment steps from Section 2, using the contents of `apps-script/wcl-proxy.gs`. Add the deployed URL as `wcl_apps_script` in `config.json`. This must be your own deployment — do not reuse another guild's WCL proxy.

### Add WCL config to `config.json`

```json
{
  ...
  "enable_wcl": true,
  "wcl_client_id": "paste-your-client-id-here",
  "wcl_realm": "your-realm-slug"
}
```

The realm slug is the lowercase hyphenated version of your realm name as it appears in WarcraftLogs URLs, e.g. `area-52`, `benediction`, `dreamscythe`.

### Connect in the Dashboard

1. Open the dashboard — a **⚡ Connect WarcraftLogs** button appears at the bottom right
2. Click it — you'll be redirected to WarcraftLogs to authorise
3. After authorising, you'll be redirected back and the button changes to **⚡ Connected to WarcraftLogs**
4. WCL performance data will now appear in the WCL column on all player tables

WCL data automatically uses the most recent raid zone — no zone ID configuration required.

---

## 7. Set Up CLA Sheets

CLA (Combat Log Analyser) is the source of attendance, gear issues, and consumable data.

1. Navigate to the **CLA** tab in the dashboard (requires write token)
2. Click **+ Add CLA Sheet** for each raid you want to import
3. For each entry, provide:
   - **Label**: a short name shown in the attendance table (e.g. `Mar 19`)
   - **Google Sheet URL**: the URL of the CLA export sheet
   - **Issues GID**: the `gid=` parameter from the gear issues tab URL
   - **Gear GID** *(optional)*: the `gid=` parameter from the gear listing tab URL
   - **Consumes GID**: the `gid=` parameter from the buff consumables tab URL
4. Click **Save** — data is fetched and attendance/gear scores update immediately

> **Finding GIDs:** Open the CLA Google Sheet, click the tab you want, and look at the URL: `...#gid=123456789` — the number after `gid=` is what you need.

---

## 8. Populate Your Roster

1. Navigate to the **Roster** tab (part of the Management dropdown, requires write token)
2. Use the **Add Raider** form at the bottom to add each player with their role and class
3. As you add CLA sheets, any players seen in CLA exports but not on the roster will appear in the **Seen in CLA — Not on Roster** panel. Click ✕ to permanently exclude bench players

---

## 9. Ongoing Maintenance

### After Each Raid

1. Export the CLA sheet from your raid
2. On the **CLA** tab, add a new entry pointing to the export
3. Attendance, gear issues, and consumable scores update automatically

### Adding Loot

On the **Loot Distribution** tab or via the **+ LOG** button in any player's loot dropdown on the Loot Distribution tab.

### Updating BiS Lists and Priorities

- **Item Glossary** tab: set prioritization multipliers per item
- **BiS Lists** tab: set EPV values per spec/slot
- **T4/T5/T6** tabs: configure set bonus multipliers

---

## Troubleshooting

**Dashboard shows no data after setup**
- Check the browser console for errors
- Verify `cf_worker_url` in `config.json` matches your Worker URL exactly
- Ensure the KV binding is named `DB` (case sensitive)

**"Invalid token" on write token entry**
- Double-check the token matches `WRITE_TOKEN` in your Worker code exactly

**CLA sheets fail to load**
- Verify the Google Sheet is set to "Anyone with the link can view"
- Check the GIDs are correct by inspecting the sheet tab URLs
- Verify the `apps_script` URL in `config.json` is correct and deployed as "Anyone" access

**WCL shows spinners but no data**
- Verify the redirect URL in your WCL client matches your GitHub Pages URL exactly
- Check that `wcl_realm` matches the realm slug on WarcraftLogs (check character URLs)
- Try disconnecting and reconnecting via the button at the bottom of the sidebar

**`migrateFromGitHub()` fails**
- Make sure GitHub Pages has finished deploying (check the Actions tab in your repo)
- Ensure your write token is saved in the dashboard before running the command
- Check the console for specific file errors

---

## Architecture Overview

```
Browser (GitHub Pages)
    ↕ reads config
config.json

    ↕ all data reads/writes
Cloudflare Worker (KV)
├── roster.json
├── loot-glossary.json
├── bis-data.json
├── attendance.json
├── loot-distribution.json
├── gear-item-ids.json
├── set-bonuses.json
├── cla-sheets.json
└── wcl-config.json

    ↕ CLA sheet fetches + WCL OAuth
Google Apps Script (proxy)
    ↕ CLA Google Sheets (read-only)
    ↕ WarcraftLogs API (optional)
```

All persistent data lives in Cloudflare KV. The GitHub repo contains only the application code and the initial seed files in `/data/` — after `migrateFromGitHub()` is run once, KV is the source of truth and the repo files are only used for redeployment.
