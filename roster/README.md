# Roster MVP

A class group chat for Harvard courses. You add your classes and you're placed in a chat with everyone taking them; there's no link to find. It tests the riskiest assumption from Assignment 2a:

> When Stat 110 students who are not in any class-wide chat get placed, with no link to find, into one course group chat with their classmates, do at least 35% of them post, reply or react at least once during the first pset cycle, and does the chat hold on to at least half of that activity during the second pset cycle without any prompting from me?

## Links

| Build | Link | Who it's for |
|---|---|---|
| Demo class (`dist/roster-demo.html`) | https://claude.ai/artifact/8cBtNpHAs5YLLKPH2zdUMQ | The TF and anyone else. Example classmates, Stat 110 on Sat Oct 3, 2026. Nothing is shared. |
| Live class (`dist/roster.html`) | https://claude.ai/artifact/6RsBLnVaAejQqeh3haNjFV | The real experiment: placed Stat 110 students and the organizer. |

Both links are private until you share them from the page's **Share** menu.

## What the MVP does

Each item lists the 2a element it implements.

- **Placement** (automatic placement): onboarding picks your courses, by search or by pasting from my.harvard, and you're in every chat at once. The arrival screen shows how many classmates are already there.
- **Class chat:** replies, reactions, @mentions, a typing line, and an unread divider. Due dates are pinned with a live countdown.
- **PSet topics with per-problem tags,** so "did you get 3(b)?" finds the people stuck on 3(b).
- **AI lecture recap** (one checked AI summary per lecture):
  - The organizer pastes notes and Claude drafts a recap from those notes only.
  - Classmates mark lines "Looks right" or suggest a fix.
  - A fix replaces the AI's line when 3 classmates agree.
- **Hub** (one pinned hub): course info, due dates with Google/Outlook calendar links, pinned rules, links, and the people in the class with their house and year.
- **Organizer results:** the research question computed from the log against the 2a success and kill lines. Organizer activity is excluded.
  - Results show contribution rate, cycle-2 retention with pace, fixes per recap, and shares per week.
  - Unlike GroupMe, results also show who opened the chat but never posted.
  - The 3-question exit survey appears after cycle 1.
  - The pseudonymous CSV log exports for the write-up.

Every visual and copy decision is traced to a real app in [DESIGN.md](DESIGN.md).

## Sharing the live class

The live class keeps its data in the artifact's own database. Access rules:
- Only people the artifact is shared with at **Contributor** level or above can read or post.
- Each student can edit only their own profile.
- The hub, recaps and settings are owner-only.
- Survey answers are visible only to the owner.

**How to let students in:**
- **On a plan with other members (Team / Enterprise / Education):** share with the workspace as Contributor.
- **Otherwise:** invite each student by email as an editor, and don't turn on the public link. While the artifact also has a public link, editors from outside your organization can't write.

**Limits:**
- Every participant needs to be signed in to Claude to post. That limits who can be placed, and it is a real gap versus GroupMe.
- Visitors who can view but not post land in the demo class.

## Build and test

```sh
node roster/build.mjs                       # writes dist/roster.html and dist/roster-demo.html
# Playwright tests (Chromium); HTM_UMD points at htm@3.1.1/preact/standalone.umd.js from npm
node roster/test/demo-flow.mjs <outDir>     # full demo flow, desktop/tablet/phone, light/dark, screenshots
node roster/test/live-mock.mjs <outDir>     # organizer + student on a mocked runtime, 21 checks
```

Source lives in `src/`:
- `store.js`: LocalDB, the same API as the artifact db, used by the demo.
- `metrics.js`: the research metrics.
- `app-*.js`: the UI, built with Preact and htm from jsDelivr.
