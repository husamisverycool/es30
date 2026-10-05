# Roster MVP

A class group chat for Harvard courses. You add your classes and you're placed in a chat with everyone taking them; there's no link to find. It tests the riskiest assumption from Assignment 2a:

> When Stat 110 students who are not in any class-wide chat get placed, with no link to find, into one course group chat with their classmates, do at least 35% of them post, reply or react at least once during the first pset cycle, and does the chat hold on to at least half of that activity during the second pset cycle without any prompting from me?

## Links

| Build | Link | Who it's for |
|---|---|---|
| Demo class (`dist/roster-demo.html`) | https://claude.ai/artifact/8cBtNpHAs5YLLKPH2zdUMQ | The TF and anyone else. Example classmates, Stat 110 on Sat Oct 3, 2026. Nothing is shared. |
| Live class (`dist/roster.html`) | https://claude.ai/artifact/6RsBLnVaAejQqeh3haNjFV | The real experiment: placed Stat 110 students and the organizer. |

Both links are private until you share them from the page's **Share** menu.

### On Netlify (anyone with the link, no accounts)
`netlify/` is a full site with its own class server: a Netlify Function plus Netlify Blobs.
- **Live class:** each placed student gets a personal link that drops them into STAT 110 with no account. Everyone shares one real chat.
- **Demo class:** for the TF, the same site at `?demo`.

Deploy steps are in [netlify/DEPLOY.md](netlify/DEPLOY.md): import from GitHub with base directory `roster/netlify`, or use the Netlify CLI with `dist/roster-netlify.zip`. A drag-and-drop deploy is static-only, so it can only show the demo class.

## What the MVP does

The core test is still placement: add your classes and you're in their chats. v2 builds the rest of a student's week around it, the way Saturn does. Each item lists the 2a element it implements.

- **Onboarding, 12 steps** (automatic placement):
  1. Classes: search, paste from my.harvard, or scan a screenshot with Claude.
  2. Verified (a member of the class's organization).
  3. Name and photo.
  4. Year and House.
  5. Concentration.
  6. Sections.
  7. Profile prompts.
  8. The community pledge.
  9. People you may know.
  10. A build checklist.
  11. Arrival in every chat at once, with House and class-year spaces added automatically.
  12. If the organizer placed you, your classes are preselected.
- **Class chat:**
  - Replies, reactions, @mentions, photos, polls (vote to see results), and study sessions with Going / Maybe / Can't.
  - Swipe to reply and long-press menus, plus a typing line, an unread divider and a "while you were away" digest that has no AI in it.
  - Due dates are pinned with a live countdown.
- **Class tabs:**
  - PSet board: per-problem threads, "stuck too" counts and answered/open status.
  - AI lecture recaps (one checked AI summary per lecture): classmates check lines or suggest fixes; a fix replaces the AI's line when 3 agree.
  - Shared notes with upvotes and math.
  - Section rooms.
  - The people in the class.
- **Now:** a now/next hero (in lecture "ENDS IN", starting, done), friends' status, due soon, tasks, today's classes, events tonight and what's new.
- **Calendar:**
  - Week grid (desktop) or day view (phone), and a 3-week list.
  - Classes, sections, deadlines, term dates, and sessions you're going to.
  - Editable class times, with "add to Google Calendar" repeating weekly.
- **Board:** the campus feed for events, study groups, marketplace, lost & found and general posts, with RSVPs, reactions and comments.
- **People:**
  - Friends (mutual adds) with free / in-class status.
  - People who added you, suggestions from your classes and House, and search.
  - Profiles with prompts, classes in common, and a free-together schedule compare.
- **Activity** (replies, mentions, reactions, recap news), **Saved** messages, **Tasks** (private), and **You** (profile, status, classes, theme, guidelines, About this study).
- **⌘K palette** across classes, people, messages and actions, with G-then-key shortcuts.
- **Organizer:**
  - Results for the research question against the 2a success and kill lines: contribution, cycle-2 retention with pace, readers who never posted, writing vs one-tap responses, fixes per recap, shares, and the exit survey.
  - Recap drafting with Claude: every line is reviewed Keep / Edit / Remove before it posts.
  - Dates and cycles, placement (pick people from the directory), a reports queue, announcements, and a pseudonymous CSV export.

Every visual, interaction and copy decision is traced to a real app in [DESIGN.md](DESIGN.md).

## Sharing the live class

The live class keeps its data in the artifact's own database. Access rules:
- Only people the artifact is shared with at **Contributor** level or above can read or post.
- Each student can edit only their own profile.
- The hub, recaps, settings and placements are owner-only. Each student can read only their own placement.
- Survey answers and reports are visible only to the owner.
- Tasks and saved messages are private to each person.

**How to let students in:**
- **On a plan with other members (Team / Enterprise / Education):** share with the workspace as Contributor.
- **Otherwise:** invite each student by email as an editor, and don't turn on the public link. While the artifact also has a public link, editors from outside your organization can't write.

**Limits:**
- Every participant needs to be signed in to Claude to post. That limits who can be placed, and it is a real gap versus GroupMe.
- Visitors who can view but not post land in the demo class.
- Board posts can be changed by any contributor (reactions and RSVPs are writes to the post), so a bad actor could edit someone else's post. The organizer can remove posts and see reports.
- The platform doesn't give this page anyone's email, so "verified" means "a member of the organization that owns the artifact".

## Build and test

```sh
node roster/build.mjs                       # writes dist/roster.html and dist/roster-demo.html
# Playwright (Chromium). HTM_UMD = htm@3.1.1/preact/standalone.umd.js, KATEX_JS = katex@0.16.11/dist/katex.min.js
node roster/test/demo-flow.mjs <outDir>     # onboarding + every screen, desktop and phone, light and dark, 86 screenshots
node roster/test/live-mock.mjs <outDir>     # organizer + placed student + visitors on a mocked runtime, 30 checks
node roster/test/netlify-flow.mjs <outDir>  # Netlify build against local Netlify Blobs: organizer, 2 placed students, 33 checks
node roster/test/netlify-local.mjs 8888     # run the Netlify build locally (site + API)
```

Source lives in `src/`:
- `store.js`: LocalDB, the same API as the artifact db, used by the demo.
- `metrics.js`: the research metrics and the CSV export.
- `lib-*.js`: schedules, photos and math, and derived views (inbox, digest, weekly story, search, free time).
- `demo.js`: the example class (142 example classmates, Stat 110 on Sat Oct 3, 2026).
- `ui-*.js` and `app-session.js`: the UI, built with Preact and htm. KaTeX renders math as MathML.
- `remote.js`: the Netlify build's sync client. It keeps a replica of the class database and applies the server's ordered change log.
- `../netlify/lib/api-core.mjs`: the Netlify Function. It holds the ordered op log on Netlify Blobs, placement links, organizer-only paths and private data.
