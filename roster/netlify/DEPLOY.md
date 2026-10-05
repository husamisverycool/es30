# Deploy Roster on Netlify

This folder is the whole site: the page (`index.html`, `vendor/`) and one Netlify Function (`netlify/functions/api.mjs`).

The function is the class's shared database. It stores data in Netlify Blobs, which needs no setup. It is what lets real classmates land in the same chat. Without it, the site can only run the demo class.

## 1. Deploy (pick one)

### A. From GitHub (recommended, about 3 minutes)
1. In Netlify, go to **Add new project → Import an existing project → GitHub**.
2. Pick `husamisverycool/es30`, and the branch that has this folder.
3. Set **Base directory** to `roster/netlify`.
4. Leave the build command empty. `netlify.toml` already sets the publish folder and the functions folder.
5. Click **Deploy**. Netlify installs the two dependencies and bundles the function.

### B. From your computer (Netlify CLI)
```sh
unzip roster-netlify.zip -d roster-netlify && cd roster-netlify
npm install
npx netlify-cli deploy --prod     # log in when asked; choose "create a new project"
```

### C. Drag and drop (demo only)
Dropping the zip on app.netlify.com/drop publishes static files only. Netlify Drop doesn't run functions, so that site shows the demo class and can't host the live class.

## 2. Set up the class (organizer, once)
1. Open your new site.
2. On the first screen, click **Running this study? Set this class up as the organizer**. The first person to click it becomes the organizer, so do this before sharing anything.
3. Go through onboarding and add STAT 110.
4. In the class, open **Organizer tools** (the chart button):
   - **Dates:** set the two experiment cycles (pset cycle 1 and cycle 2), the pinned due dates, and the PSet board.
   - **Placement:** paste your sign-up list, one student per line (`Name` or `Name, email`), then **Create links**. Send each student their own link with **Copy message**, by email, text or DM.
   - **Placement → Show my organizer link:** keep it private. It makes any other device or browser you open it on the organizer too.
5. Optional: to draft lecture recaps with Claude, add an environment variable `ANTHROPIC_API_KEY` under **Project configuration → Environment variables**, then redeploy. Without it you write recap lines yourself under **Recap → Add a line**.

## 3. Links for the submission
- **Live class:** `https://<your-site>.netlify.app/`. Placed students use their personal links.
- **Demo class** for your TF or anyone else, with example classmates and nothing shared: `https://<your-site>.netlify.app/?demo`

## How it works
- **Identity:** there are no accounts. Each browser gets a random id and key.
  - A student's placement link is their way in, on any device.
  - Opening the link again on a phone makes that phone the same student.
- **Sync:** every change is an entry in an ordered log in Netlify Blobs.
  - Each entry claims its slot with a create-only write, so messages are never lost or overwritten.
  - Browsers check for new entries every 3 seconds while someone is active, less often when idle, and not at all in hidden tabs.
- **Privacy:**
  - Students can't edit due dates, recaps, settings or placements.
  - Only the organizer sees survey answers, reports and placements.
  - Tasks and saved messages are private to each person.
  - Photos are stored as separate files.
- **Results:** Organizer tools → Results answers the research question with only the students you placed, or with everyone who joined. Export gives a pseudonymous CSV with no names and no message text.

## Run it locally
```sh
npm install                                    # in this folder
node ../test/netlify-local.mjs 8888            # serves the site + API on http://127.0.0.1:8888 with local Blobs
```
