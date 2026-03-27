# Loot Council Dashboard — Setup Guide

A TBC Classic loot council dashboard that tracks raid attendance, consumable usage, gear issues, BiS lists, and loot distribution, and customizable prioritization, to generate data-driven priority recommendations.

---

## Prerequisites

- FREE - A GitHub account (for hosting dashboard via GitHub Pages)
- FREE - A Cloudflare account (for hosting data storage)
- FREE - Your guild's [CLA](https://docs.google.com/spreadsheets/d/1TaL0zufIhSNhAVIfpsBXMT0JXL3ptpbA7vZnXCWOlBs/edit?gid=1843677088#gid=1843677088) Google Sheets
- *(Optional)* A WarcraftLogs account with API access
- *(Optional)* FREE - A Google account (for hosting apps scripts for data proxies)

---

## 1. Fork the Repository

1. Go to [github.com/bunzosteele/lc-dashboard](https://github.com/bunzosteele/lc-dashboard)
2. Click **Fork** → choose your account
3. In your fork, go to **Settings → Pages**
4. Set **Source** to `Deploy from a branch`, branch `main`, folder `/ (root)`
5. After a minute your dashboard will be live at `https://<your-username>.github.io/<your-repo>/`

---

## 2. Set Up the Google Apps Script Proxy *(Optional)*

The Apps Script proxy enables fetching CLA data directly from Google Sheets by URL, loading item icons from Wowhead, and fetching Warcraftlogs player data. **This step is optional** and requires a non-trivial amount of work. — if you leave `"enable_apps_script": false` in `config.json`, you can skip it entirely and paste CLA CSV data manually in the dashboard instead.

If you want to enable Apps Script, see **[APPS-SCRIPT.md](APPS-SCRIPT.md)** for full setup instructions.

---

## 3. Set Up Cloudflare KV

### Create the KV Namespace

1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com), making a new account is free.
2. Go to **Storage & databases → Workers KV**
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
  "page_title": "Your Guild Name",
  "cf_worker_url": "https://your-worker.your-subdomain.workers.dev",
  "enable_apps_script": false,
  "enable_wcl": false
}
```

To enable Apps Script (Google Sheets CLA fetching + item icons), add:
```json
  "enable_apps_script": true,
  "apps_script": "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"
```
See [APPS-SCRIPT.md](APPS-SCRIPT.md) for how to deploy the script.

If you want WarcraftLogs integration (see Section 6), change "enable_wcl" to true and add:
```json
  "wcl_client_id": "your-wcl-oauth-client-id",
  "wcl_realm": "your-realm-name"
```
This also requires completion of the Apps Script set-up.

Commit and push — GitHub Pages will redeploy automatically.

> **Tip:** To use a custom browser tab icon, replace `favicon.ico` in the root of your repo with your own 32×32 or 64×64 pixel `.ico` file.

---

## 5. Seed the KV Store

The dashboard reads all its data from Cloudflare KV. You need to push the initial JSON files from your repo into KV once.

### Creating initial data

1. Open your [deployed dashboard](https://<your-username>.github.io/<your-repo>/) in a browser
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

---

## 6. Set Up CLA Sheets

CLA (Combat Log Analytics) is the source of attendance, current gear, gear issues, and consumable data.

1. Navigate to the **CLA** tab in the dashboard (requires write token)
2. Click **+ Add** for each raid you want to import

**If `enable_apps_script` is false (paste mode):**
- Enter a **Label** (e.g. `Mar 25`)
- Open your CLA Google Sheet, go to each tab, press **Ctrl+A** then **Ctrl+C**
- Paste directly into the **Gear Issues**, **Gear Listing** (optional), and **Buff Consumables** fields
- Click **+ Add** — data is parsed immediately
- Both tab-separated (clipboard) and CSV (downloaded) formats are accepted

**If `enable_apps_script` is true (URL mode):**
- Enter a **Label**, the **Google Sheet URL**, and the GID for each tab
- See [APPS-SCRIPT.md](APPS-SCRIPT.md) for details on finding GIDs

---

## 7. Populate Your Roster

1. Navigate to the **Roster** tab (part of the Management dropdown, requires write token)
2. Use the **Add Raider** form at the bottom to add each player with their role and class
3. As you add CLA sheets, any players seen in CLA exports but not on the roster will appear in the **Seen in CLA — Not on Roster** panel. Click ✕ to permanently exclude old players

---

## 8. Ongoing Maintenance

### After Each Raid

1. Export the CLA sheet from your raid
2. On the **CLA** tab, add a new entry pointing to the export
3. Attendance, gear issues, and consumable scores update automatically

### Adding Loot

On the **Loot Log** tab items can be assigned to raiders. Alternatively the **+ LOG** button in any player's loot dropdown on the Loot Distribution tab will add the item to that player on the most recent raid.

### Updating BiS Lists and Priorities

- **Item Glossary** tab: set prioritization multipliers per item, this is how the loot council can include custom role/class/player priorities in the Priority calculation. Tier tokens can have bonuses assigned to set completions to reflect the added value of set bonuses.
- **BiS Lists** tab: set EPV values per spec/slot, EPV values are calculated via a mathematical formula, but if the loot council does not think the calculated value accurately represents the value of the item, it can be overridden.

---

## Troubleshooting

**Dashboard shows no data after setup**
- Check the browser console for errors
- Verify `cf_worker_url` in `config.json` matches your Worker URL exactly
- Ensure the KV binding is named `DB` (case sensitive)

**"Invalid token" on write token entry**
- Double-check the token matches `WRITE_TOKEN` in your Worker code exactly

**CLA sheets fail to load (URL mode)**
- See [APPS-SCRIPT.md](APPS-SCRIPT.md) for troubleshooting

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
