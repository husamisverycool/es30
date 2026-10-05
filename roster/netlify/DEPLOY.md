# Put Roster on Netlify

This folder is the whole site:
- the page: `index.html`, `setup.html` and `vendor/`
- the class server: `netlify/functions/api.mjs`, one ready-to-run file with nothing to install

The server is the class's shared database, stored in Netlify Blobs, which needs no setup. It is what puts real classmates in the same chat. Without it, the site runs only the demo class.

## 1. Deploy (pick one)

### A. Drag and drop (easiest)
1. Log in at app.netlify.com. Sign up free if you need to.
2. Unzip `roster-netlify.zip` so you have a folder.
3. On the **Projects** page, drag the folder onto the drop box at the bottom.
4. Open the new site. If the first screen says **"Your class is live. You're the first one here."**, the server is on.

   If you see the regular welcome screen with a note that says **"This copy has no class server yet"**, Netlify published only the page. Use B.

`yoursite.netlify.app/setup.html` always tells you whether the server is on.

### B. From GitHub (always includes the server)
1. In Netlify, go to **Add new project → Import an existing project → GitHub**.
2. Pick `es30`, branch `claude/vibe-coding-mvps-twhakh`.
3. Set **Base directory** to `roster/netlify`. Leave everything else empty, then click **Deploy**.

### C. Netlify CLI
```sh
cd roster-netlify && npx netlify-cli deploy --prod
```

## 2. Set up the class (organizer, once)
1. Open your site before you share it, and click **I'm running this class**. The first person to click it becomes the organizer.
2. Finish the short setup. STAT 110's pset dates, the two experiment cycles and a PSet board are filled in for you.
3. Your **Now** screen has a checklist:
   - check the dates
   - invite students: paste names, then send each person their own link
   - save your organizer link, which makes another device the organizer too
   - copy the demo link for your TF
   - open the results

Optional: to draft lecture recaps with Claude, add the environment variable `ANTHROPIC_API_KEY` under **Project configuration → Environment variables**, then deploy again. Without it, the organizer writes recap lines by hand.

## 3. Links for the submission
- **Live class:** `https://<your-site>.netlify.app/`. Students use their personal links.
- **Demo class** for your TF or anyone else, with example classmates and nothing shared: `https://<your-site>.netlify.app/?demo`

## How it works
- **Identity:** there are no accounts. Each browser gets a random id and key.
  - A student's placement link is their way in on any device.
  - The organizer link does the same for the organizer.
- **Sync:** every change is an entry in an ordered log in Netlify Blobs.
  - Each entry claims its slot with a create-only write, so nothing is lost or overwritten.
  - Browsers check for new entries every 3 seconds while someone is active, less often when idle, and never in hidden tabs.
- **Privacy:**
  - Only the organizer can change dates, recaps, settings and placements.
  - Only the organizer sees survey answers, reports and placements.
  - Tasks and saved messages are private to each person.
- **Results:** Organizer tools → Results answers the research question. Export gives a pseudonymous CSV with no names and no message text.

## For developers
- The function's source is `lib/function.mjs` and `lib/api-core.mjs`. `roster/build.mjs` bundles them into `netlify/functions/api.mjs`; run `npm install` here first.
- To run it locally: `node ../test/netlify-local.mjs 8888`. Add `--bundled` to run the deployable file.
