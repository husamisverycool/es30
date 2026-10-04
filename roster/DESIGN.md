# Roster v2: design spec, with a source for every decision

The rule for this build: no visual, interaction or copy decision comes from taste. Each one below names the shipping product or primary document it is taken from. The research behind v2 is seven dossiers gathered on 2026-10-03:
- visual systems,
- messaging motion,
- time and schedules,
- community (events, polls, profiles, safety),
- onboarding,
- education and power-user tools,
- AI and data UX.

The dossiers read:
- real client code (Telegram Web A, Bluesky, Signal Desktop, Discord tokens, Vaul, Primer),
- Apple HIG JSON,
- npm packages (`@phosphor-icons/core`, `@radix-ui/colors`, KaTeX),
- live marketing-site captures,
- product docs (X Community Notes, Ed, Gradescope, Partiful, Luma).

Values marked *[derived]* were computed by Roster from a cited rule rather than read from an app.

## 1. Product frame

v1 was one class chat. v2 follows Saturn's shape, many features organised around one student's week, and keeps the 2a research question at the centre: **placed students land in a class chat with no link to find**.

| v2 area | Primary reference | What it adds |
|---|---|---|
| Now | Saturn home, Flighty smart states, Things Today | One summary sentence and a now/next hero, then friends, due soon, tasks, today's classes, This Evening, and what's new |
| Classes | iMessage list, Telegram pinned bar, Ed categories | Every class, plus your House and class-year spaces (auto-placed, the way Saturn places you in your school) |
| Calendar | Notion Calendar, Google Calendar, Apple Calendar (phone) | Week grid with overlaps split, red now-line, all-day lane for deadlines; phone week strip + day; list |
| Board | Saturn Bulletin, Fizz school feed, Partiful, Facebook Marketplace | Campus-wide posts: events, study groups, marketplace, lost & found, with RSVPs and comments |
| People | Saturn friends, Instagram "Follow back", Hinge profiles | Friends with free/in-class status, people who added you, suggestions, directory, schedule compare |
| Activity, Saved, Tasks | Instagram/Threads activity, Slack Later, Things 3 | Responses to you, saved messages, private tasks |
| Organizer | Plausible, Stripe Radar, Apple chart doctrine | The research question measured from the log |

## 2. Information architecture

- **One tree on phone and desktop.** The HIG's `sidebarAdaptable` model; Discord's 2023–26 divergence and reversal is the warning against splitting them (edu-power dossier).
- **Phone:** a floating capsule tab bar with Now · Classes · Calendar · Board · People. The selected tab gets a fill pill, a filled icon and the accent tint (HIG iOS 26 tab bar). Search, Activity (bell with a count) and You (avatar) sit in the nav bar above the large title, as Saturn puts its inbox icon there.
  - *Deviation:* the edu dossier's tabs were Classes · Due · Activity · Saved · Search. The Saturn-scale feature set needed Calendar, Board and People as top-level destinations, so Activity and Saved moved to the header and sidebar.
- **Desktop ≥1024px:** a sidebar with the same destinations, then Classes and Spaces with unread counts (Linear sidebar, Ed course list), and a "me" island at the bottom (Slack, Discord).
- **Keyboard:**
  - ⌘K palette with grouped results (Linear, Raycast).
  - "/" also opens search.
  - "?" opens the legend (GitHub).
  - "G then key" navigation (Linear), with G 1–9 for the nth class.

## 3. Visual system

Tokens are in `src/styles.css`, copied from the research token sheet; each group cites its source there.

### Type
- **Mona Sans**, a variable font (width 75–125, weight 400–800). It is GitHub Primer v11's UI face.
  - Compressed width for course codes and eyebrows; expanded width for countdowns. This is Apple's SF Compressed / Expanded system, as in Apple Sports and Flighty.
  - Inter, Geist and Plus Jakarta were rejected as scaffold defaults that read as AI-made.
- **Newsreader serif only for AI recap text.** It stands in for Apple's New York; serif-for-AI follows Claude, Granola and Notion.
- **Scale:** phone uses iOS Dynamic Type "Large" verbatim (body 17/22, large title 34/41). Desktop uses macOS text styles with Primer's 14px body and Slack's 15/22 for chat.
- Display sizes get negative tracking (Linear −0.022em).
- `text-rendering: geometricPrecision` fixes Mona Sans spacing in Chromium.

### Colour
- **Chrome is monochrome and primary buttons are ink.** Airbnb #222, Partiful #000, Family, Vercel; the HIG says to colour only the one primary action.
- **Harvard crimson #A51C30 is identity and selection only:** selected tab, links, focus ring, unread badges, the school chip. It is never used for status; iOS red sits 6° of hue away. In dark mode it lifts to #EF656B *[derived, OKLCH]*.
- **Courses carry colour,** as teams do in Apple Sports and labels in Linear.
  - 12 hues at constant OKLCH lightness *[derived]*, with Radix's tint / solid / text roles.
  - Every solid passes ≥4.9:1 with white.
  - Your own bubble takes the class's solid colour (Messenger / Telegram chat themes).
- **Semantic text colours** are Primer's (#D1242F, #9A6700, #1A7F37); fills are iOS 26 system colours. Status always ships as a labelled pill or icon, never hue alone.

### Surfaces
- iOS grouped fills, not bordered cards: #F2F2F7 behind #FFF, and #000 behind #1C1C1E in dark.
- Hairlines are 0.5px (iOS separator, Linear).
- Shadows only on floating layers (Primer floating tokens).
- Glass only on the floating tab bar and the chat composer (HIG: no glass in the content layer).

### Shape
- Capsule buttons, chips, tab bar and composer (HIG "prefer capsule").
- Radii ladder 6 / 10 / 14 / 20 / 28; bubbles 20 with joined corners at 6 (Telegram 15/6, GroupMe ~20).

### Icons and emoji
- **Phosphor** (`@phosphor-icons/core` 2.1.1): regular weight in lists and toolbars, fill when selected. That is SF Symbols' rule, and only Phosphor ships a fill twin for every icon. Lucide was rejected as the shadcn default with no fill states.
- **No emoji in chrome.** Board categories use Phosphor glyphs. Emoji stays user content: reactions, statuses, and Partiful-style RSVP choices.
- **Course tiles are typographic** ("STAT / 110" in compressed type on the course tint). They replace v1's emoji squircles (Linear team keys, Apple Sports abbreviations).

### Motion
- Primer durations (100 / 200 / 300 / 500ms).
- Spring curves as CSS `linear()`: 414ms smooth and 592ms pop.
- Sheets: Vaul's `.5s cubic-bezier(.32,.72,0,1)`; they close past 25% drag or a fast flick.
- Jump button: Telegram's `cubic-bezier(.34,1.56,.64,1)`.
- `prefers-reduced-motion` is respected.

## 4. Chat (messaging dossier)

- **Runs:** messages group within 5 minutes (Bluesky). Others' avatars sit outside the bubble; the first bubble carries name, House·year and time (GroupMe).
- **Replies:** a quote with a 3px rail. Tapping it scrolls to the original and flashes it (WhatsApp, Telegram, Discord highlight).
- **Swipe to reply:** 56px threshold plus 32px exponential resistance, with a haptic when crossed (Bluesky).
- **Menus:** long-press opens the menu after 400ms; the desktop hover toolbar has react, reply and more (Slack, Discord).
- **Reactions:**
  - Five quick picks plus "+" (Bluesky's set, with ❤️ 😂 🙏 for class use).
  - The pill pulses 1 → 1.2 → 1 over 500ms.
  - Up to 3 reactors show as faces, then a count (iMessage tapbacks, Slack).
- **Typing:** 6px dots, 1600ms loop, 160ms stagger, scale 1.3 at 20% (Signal Desktop). Names list up to 3, then "Several people are typing" (Slack).
- **Unread:** a "N new messages" divider in the school colour (Slack's red "New" line); a jump pill with a new-count (Telegram).
- **Polls:**
  - Vote first, then see results (Telegram anonymous-until-vote).
  - Bars are normalised to the leader (Discord).
  - Votes are public, with faces (Slack polls).
- **Study sessions:**
  - Partiful card: a date tile, a relative-time chip, faces, and "Mei, Kofi and 1 other going".
  - Three-way RSVP 👍 Going / 🤔 Maybe / 😢 Can't, where Can't is visible only to the host (Partiful).
  - Google and Outlook links.
- **Composer:**
  - An iMessage pill on glass with "+" for an attach sheet: Photo, Poll, Study session, Lecture notes (Telegram attach menu).
  - @-mentions with arrow keys (Slack).
  - Drafts are kept per chat (Telegram).
- **While you were away:** an extractive digest (most reacted, open questions, shares, mentions). It appears only after 25+ unread or 24h away, and says "Nothing here is written by AI" (AI dossier c).

## 5. Class pages

- **Tabs:** Chat · PSet · Recaps · Notes · Section · People. They are pill tabs, because the visual dossier lists underline tabs as dated.
- **Pinned bar** with a segmented rail and a live countdown (Telegram pinned messages; Saturn's amber "ENDS IN").
- **PSet board (Ed, Gradescope, GitHub):**
  - Problem chips "3(b)" like Gradescope's question chips.
  - Answered / Open status pills like Ed's.
  - A "↑ stuck too" counter shaped like GitHub's upvote pill.
  - Sorting by order, most stuck, or unanswered.
  - The composer hint "Explain the idea, not the final answer." restates the collaboration policy, which is quoted above the list.
- **AI recap (Community Notes, Granola):**
  - Lines stay grey until two classmates check them, then turn ink.
  - "Fix" opens a reason picker and a Docs-style diff.
  - A fix replaces the AI's line when 3 classmates agree and agreement outnumbers disagreement 2 to 1.
  - Wording-only fixes can't replace a line already checked.
  - Every change is in History.
- **Notes:** upvote pills with Top / Newest sorting (GitHub Discussions, Ed). Markdown-lite plus math rendered as MathML through KaTeX, with Pandoc's currency-safe `$…$` rule.
- **Section rooms:** a thread per section slot (WhatsApp Communities, Telegram Topics).
- **People:** stat tiles that double as filters ("12 from Pfoho", "8 in your section"), then grouped lists: People you know, From your House, Everyone (Partiful guest list, Discord member groups).

## 6. Time (time dossier)

- **Now hero states:** later / soon / starting / in lecture with an "ENDS IN" countdown and progress / just ended / done / free (Flighty smart states, Saturn's in-class card).
- **Deadline ladder:**
  - ≥7 days: the date.
  - 2–6 days: "Fri 5 PM · in 3 days".
  - Tomorrow: orange.
  - Today: orange, then red under 1h.
  - Overdue: "Due 2h ago".
  - Sources: Things deadline flags, Todoist's tomorrow-orange, Flighty minutes.
- **Calendar:**
  - Overlaps split side by side (Google Calendar).
  - Red now-line with a time label in the gutter (Apple Calendar, Notion Calendar).
  - "Maybe" events striped (Google Calendar tentative).
  - Phone uses a week strip with the selected day in a black circle and today in red (iOS Calendar).
  - Class times come from the catalog and can be fixed per student (Saturn's schedule editor).
  - "Add to Google Calendar" repeats weekly until the last day of classes.
- Tabular numerals everywhere a number changes.

## 7. People and community (community dossier)

- **Profile sheet:**
  - Hinge's vitals row (year, House, concentration) and prompts, with large answers.
  - Discord's mutual-servers strip ("In common", with "Same section").
  - A class shelf.
- **Friends are mutual adds.**
  - Status and free time show only between mutual friends (Saturn).
  - Rings show the time left in a friend's class; chips show "Free" or their status (Saturn 2026).
  - "Added you · Add back" comes from Instagram's follow-back.
- **Compare schedules:** "Me | Them" columns with shared free blocks (Saturn).
- **Status picker:** emoji, text and "clear after" (Slack).
- **Report flow:**
  - Reasons first, with "Sharing graded answers" listed first.
  - An optional note, then a done screen that says what happens next (Instagram).
  - Only the organizer sees reports.
- **Pledge before posting** (Airbnb's Community Commitment, "Agree and continue"). Reading never needs it.

## 8. Onboarding (onboarding blueprint)

Twelve steps, one question per screen:
1. Welcome
2. Classes (search, paste from my.harvard, or scan a screenshot with Claude)
3. Verified
4. Name, photo and colour
5. Year and House
6. Concentration
7. Sections
8. Prompts
9. Pledge
10. People you may know
11. Build
12. Arrival

The shell for every step:
- Back chevron, a progress bar, and Skip on optional steps (Cal AI, Duolingo, BeReal).
- One full-width pill CTA in a fixed position (Finch, Cal AI).

What each step borrows:
- **Order:** classes come before identity (Saturn, Duolingo; HIG "delay sign-in").
- **Course rows** show live counts and faces ("142 on Roster"), Saturn's teaser.
- **Prompts** use Hinge's three-slot picker.
- **Sections** map answers to rooms, as Discord's onboarding maps answers to channels.
- **Build:** a checklist where each line ticks only when its write lands. This is Cal AI's "building your plan" moment without fake progress.
- **Arrival:** "You're in, Priya." with the chats you joined and who's there (Saturn's welcome). The CTA "Say hi in STAT 110" opens the chat with an intro drafted but not sent.

*Deviation:* the blueprint verifies with a Harvard email code. The artifact platform does not expose email to this account, so "verified" means the account belongs to the organization that runs the class rather than being an invited guest. Organizer placement works by picking people from the organization directory, keyed by account id.

## 9. AI and data (AI + data dossier)

- **Recap drafting:**
  - The organizer pastes notes. Claude is told to use only those notes and the course's own notation.
  - Lines stream in. Each must be marked Keep, Edit or Remove before posting (Notion AI and Gmail suggestion review).
  - Status text reads "Reading your notes (N words)…", then "Drafting line 3…".
- **Research validity rules:**
  - The catch-up and the weekly story are pull-only and extractive, with no calls to action, so the product doesn't prompt the behaviour being measured.
  - Poll votes, RSVPs, recap checks and "stuck too" count as light responses and are reported apart from writing.
  - Organizer activity is excluded everywhere.
- **Weekly story:** 6 cards with Instagram stories mechanics (progress segments, tap zones, pause) and Spotify Wrapped's one-number cards. It opens only when you tap it.
- **Organizer results:**
  - A verdict strip with icon plus words (✓ / ! / ✕ / pending).
  - Zoned meters with the kill and success lines (Stripe Radar's risk bar).
  - Pace with a dashed projection (Plausible's comparison line).
  - Messages per day by cycle, and who showed up: contributed / read only / didn't open. One open per person per day is logged, so readers who never post still count.
  - A writing-vs-light breakdown, recap fixes, and the exit survey.
  - Apple's chart doctrine: label directly, one idea per chart.
- **Export:** a pseudonymous CSV (S001…, no names, no message text) plus a results JSON.

## 10. What was removed from v1 (visual dossier §4.10)

- Plus Jakarta Sans.
- The crimson gradient band and the navy dark theme.
- Emoji gradient course tiles.
- Uppercase grey eyebrows on every section.
- Underline tabs.
- Crimson own-bubbles and Telegram-hued sender names: names are ink, and avatars carry identity.
