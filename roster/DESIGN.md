# Roster: design spec (every decision traced to a real app)

The rule for this build: no visual or copy decision comes from taste. Each token or pattern below names the shipping product it is taken from. The research behind it was gathered on 2026-10-03 from:
- live-site captures,
- open-source client code (Telegram Web A, Discord token CSS, WhatsApp WDS tokens, Bluesky ALF),
- Apple HIG,
- the 2023 Saturn screens published in Lenny's Newsletter,
- the X Community Notes docs.

Sources that could not be fetched (App Store screenshots, most press sites) are noted as such.

## 1. Product frame

Roster is "Saturn, for college lectures". The persona (Priya) says it herself: *"In high school Saturn just put me in a chat with my whole AP Bio class on day one."* So **Saturn is the primary reference** for structure, voice and the arrival moment. The chat surface follows the conventions every messaging app shares. Saturn launched for college in 2026 ("The calendar for high school and college", joinsaturn.com, 2026-09-02).

| Decision | Taken from |
|---|---|
| The school's colour themes the app (Harvard Crimson `#A51C30`) | Saturn colours each school page with the school's colour (East High `#CF204A`); Fizz themes the in-app UI in the school colour (Stanford red) |
| One emoji per course, used everywhere it appears | Saturn: 🐸 Biology II, 🎲 AP Statistics, 🍔 Lunch |
| A gradient tile behind each course emoji | Sidechat groups each carry a `color`; the 15 verified gradient pairs come from sidechat.js |
| "People are circles, things are squircles" | Discord mobile refresh, Sept 2026 |
| A countdown pill pinned at the top | Saturn: "24:47 left in 🐸 Biology II" and amber "ENDS IN 24:59" |
| Avatar stack plus a count on course cards | Saturn calendar card: 4 faces + "32" |
| Arrival reveal: "Welcome, Priya 🎉" | Saturn school welcome: "Ridgefield High School · Welcome, James! 🎉" |
| Onboarding order: school → year → classes → arrive | Saturn onboarding (press summaries) |
| Due-date cards with two actions | Saturn's school-feed event card: "Add" (tinted) and "Send to" (grey) |
| Course tabs: Chat · PSet · Recaps · Hub | Slack channel tabs (Messages · Canvas · Files · Pins) and Telegram Topics' top bar |

## 2. Tokens

**Type: Plus Jakarta Sans**, 400–800.
- It is the nearest Google Font to Saturn's heavy geometric grotesk, and Saturn uses one face for the wordmark, headings and UI.
- Headlines use weight 800 at −0.02em. Tight tracking on headlines is the convergent pattern across Partiful, Granola and Luma.
- Uppercase micro-labels: 11px, weight 700, +0.06em. From Saturn's "ENDS IN" and "FAVORITES".
- Countdowns use tabular numerals.
- Message body: 15px on desktop, 16px on phone, line-height about 1.35. The canonical range is WhatsApp web 15/19 and Telegram 16/21.

**Light theme** (Saturn's 2023 light mode):

| Token | Value | Source |
|---|---|---|
| Canvas | `#F1F3F5` | Saturn light-mode card ground |
| Sheets | `#FFFFFF`, radius 20 | Saturn white sheet |
| Ink | `#111318` | — |
| Meta grey | `#5E636E` | Saturn "8:20–10:15am · Room 501" |
| Others' bubble | `#EDEFF2` | iMessage light `#E9E9EB` / systemGray5 `#E5E5EA` |
| Own bubble | Crimson `#A51C30` with white text | School colour. iMessage and WhatsApp tint the sender's own bubbles in the brand colour |

**Dark theme** (Saturn's 2026 app):

| Token | Value | Source |
|---|---|---|
| Navy ground | `#0E1124` | Saturn `#101326` / `#121331` |
| Glow behind the current item | Crimson radial | Saturn's purple radial `#1C1848 → #231D60`, re-hued to crimson |
| Countdown amber | `#F5C063` | Saturn |
| Countdown amber, light theme | `#A86A0B` | Saturn's amber, darkened to pass contrast |

**Semantic colours:**
- "Free / done" green `#179978` (Saturn).
- Badge red `#E22647` (Saturn).
- Online dot `#3D9E60` (Discord status).

**Sender names:** coloured by hashing the user id into Telegram's seven hues: `#CC5049` `#D67722` `#955CDB` `#40A920` `#309EBA` `#368AD1` `#C7508B` (Telegram Web A). This lets readers scan 300 senders.

**Shape:**
- Sheet 20, Saturn.
- Elevated card 16, with Saturn's soft shadow.
- Buttons 12, Saturn's white "Class chat" button.
- Pills fully rounded.
- Bubbles 18 with sender-side joins at 6, after Telegram (15 / 6) and GroupMe 2026 (about 20).
- Course tile is a 12px squircle at 40px, Discord.

## 3. The message row

The base is GroupMe 2026, the app Harvard class chats actually run on today, adjusted to the conventions shared across chat apps:
- Others: avatar outside the bubble at the top-left. The first bubble of a run carries a header row: **bold name in the sender's colour, plus "4m"** (GroupMe "Alex Carter 4m").
- Runs merge. Gaps are 2px inside a run and 10px between runs (Telegram 6 / 10, iMessage 3–5 / 12–16).
- Own messages sit on the right, tinted. The time sits under the last bubble of the run.
- Replies show as a quote inside the bubble: a 3px bar plus the name and a one-line snippet (WhatsApp, Telegram, GroupMe ↩). Tapping it scrolls to the original and flashes it (Discord highlight).
- Reaction pills overlap the bubble edge by −8px (WhatsApp) and show counts (GroupMe "🫶 86"). Your own reaction gets a 1px accent border and a tint (Discord).
- Quick reactions: 6 emoji plus "+" (WhatsApp and iMessage trays). Desktop shows Discord's hover toolbar; phone uses press-and-hold.
- Day separator: a centered pill reading "Today" / "Yesterday" / "Friday, Oct 2" (WhatsApp, Telegram). The divider copy is "Unread messages" (Telegram).
- Header subtitle: "142 members, 12 online" (Telegram's `%@ members`, `%@ online`).
- Typing line: "Maya is typing…" / "Several people are typing…" (Discord strings).
- Composer: a pill with "+" on the left and the placeholder "Message STAT 110" (Discord "Message #lounge"). A round send button appears once there is text (WhatsApp, iMessage). Replies show "Replying to Maya" above the composer (Telegram "Reply to %@").
- Pinned bar under the header shows "pin k of N" with a segmented indicator (Telegram). The due date carries Saturn's amber countdown.
- System lines are muted chips centered in the chat (Telegram service messages).

## 4. AI lecture recap with classmate corrections

Taken from X **Collaborative Notes**, Granola, Apple Intelligence and Google Docs suggesting mode:

| Element | What it shows | Source |
|---|---|---|
| Status row | A dot plus "Needs more checks · 1 open fix · 2d", or "Checked by classmates" | Community Notes statuses: "Note needs more ratings", "currently rated helpful" |
| AI label | ◉ "Lecture recap · AI-drafted, updates with class corrections · Revision history" | Collaborative Note: "AI-drafted, updates with community input · Revision history" |
| AI text colour | Grey until classmates check it | Granola: "Your notes stay in black, AI additions appear in gray" |
| An open fix | Strike-through on the original text, the proposed text underlined, and "Suggested by Nora · 5 agree" | Google Docs suggesting mode, Community Notes rating |
| Suggest-a-fix panel | A grey band, the label "Suggest a fix", and reason chips "Matches the slides", "Matches what was said", "Clearer wording" | Collaborative Note's "Suggest an improvement" panel, Community Notes helpful-reason tags |
| Applying fixes | A fix applies on its own once 3 classmates agree and agreement outnumbers disagreement 2 to 1 | Community Notes shows a note only when raters agree |
| Footer | "Drafted by AI from the organizer's lecture notes. May contain errors." | Apple: "may contain errors"; Wikipedia: "Suggested links are machine-generated, and can be incorrect." |

## 5. Things we deliberately did not take

- **Pset status emoji buttons** (Partiful's RSVP mechanic). They would inflate the "reacted at least once" metric beyond what the GroupMe plan in 2a measures. The coach role rejected them as a confound.
- **AI answers inside the chat.** Assignment 2a scoped these out because they would hide whether students talk to each other.
- **Anonymous posting** (Fizz, Sidechat). The persona wants to be recognised by a few classmates.
- **Streak flames, like counts, and sparkle AI icons everywhere.** The trend research lists these as dated or as Duolingo's own.
- **Harvard marks.** Roster uses the school colour as Saturn and Fizz do, but no shield, logo or official wording. It says "Run by a student. Not affiliated with Harvard or course staff."
