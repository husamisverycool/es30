// ---------------------------------------------------------------------------
// Demo class — STAT 110 on Saturday, Oct 3, 2026, one pset cycle after
// placement. Every person here is an EXAMPLE classmate, generated or written
// for the demo, and the UI labels them that way. Lives only in LocalDB.
// ---------------------------------------------------------------------------
const Demo = (() => {
  const ET = (s) => Date.parse(s + (s.length <= 16 ? ":00" : "") + "-04:00");
  const NOW = ET("2026-10-03T21:40");
  const PLACED_AT = ET("2026-09-25T18:00");
  const CYCLES = [
    { id: "c1", label: "PSet 4", start: ET("2026-09-25T17:00"), end: ET("2026-10-02T17:00") },
    { id: "c2", label: "PSet 5", start: ET("2026-10-02T17:00"), end: ET("2026-10-09T17:00") },
  ];
  const ME = "u_demo_you";
  const ORGANIZER = "u_demo_organizer";

  // Seeded PRNG so the demo is the same for everyone.
  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const R = rng(110);
  const pick = (a) => a[Math.floor(R() * a.length)];

  const FIRST = ["Maya", "Dev", "Nora", "Sam", "Mei", "Theo", "Leila", "Jonah", "Ana", "Aiden", "Zara", "Kofi", "Ines", "Ravi", "Hana", "Luca", "Amara", "Owen", "Sofia", "Ethan", "Yuki", "Mateo", "Chloe", "Isaac", "Priyanka", "Noah", "Adaeze", "Ben", "Lina", "Marcus", "Grace", "Omar", "Talia", "Wes", "Jia", "Diego", "Elena", "Kai", "Ruth", "Arjun", "Nadia", "Felix", "Imani", "Henry", "Selin", "Jamal", "Clara", "Tomás", "Esther", "Rohan", "Aisha", "Will", "Mira", "Caleb", "Lucy", "Dami", "Iris", "Jude", "Farah", "Max"];
  const LAST = ["Okafor", "Patel", "Lindqvist", "Brennan", "Chen", "Alvarez", "Haddad", "Feld", "Souza", "Kim", "Rahman", "Mensah", "Duarte", "Iyer", "Sato", "Romano", "Nwosu", "Gallagher", "Marín", "Novak", "Tanaka", "Reyes", "Dubois", "Levi", "Krishnan", "Walsh", "Eze", "Whitfield", "Haider", "Bell", "Park", "Aziz", "Cohen", "Morgan", "Liu", "Herrera", "Petrova", "Nakamura", "Adler", "Banerjee", "Farouk", "Weiss", "Boateng", "Ward", "Yilmaz", "Jackson", "Fischer", "Ortiz", "Asante", "Mehta"];
  const HOUSES = ["Adams", "Cabot", "Currier", "Dunster", "Eliot", "Kirkland", "Leverett", "Lowell", "Mather", "Pforzheimer", "Quincy", "Winthrop"];
  const CONC = ["Statistics", "Applied Math", "Economics", "Computer Science", "MCB", "Neuroscience", "Math", "Government", "Physics", "HEB", "Chem", "Undeclared"];

  // The hand-written regulars come first so their ids are stable.
  const REGULARS = [
    ["maya", "Maya Okafor", "Eliot", "'28", "Applied Math"],
    ["dev", "Dev Patel", "Lowell", "'29", "Computer Science"],
    ["nora", "Nora Lindqvist", "Currier", "'29", "Statistics"],
    ["sam", "Sam Brennan", "Kirkland", "'28", "Economics"],
    ["mei", "Mei Chen", "Pforzheimer", "'29", "Neuroscience"],
    ["theo", "Theo Alvarez", "Adams", "'28", "Economics"],
    ["leila", "Leila Haddad", "Quincy", "'27", "Statistics"],
    ["jonah", "Jonah Feld", "Mather", "'29", "Physics"],
    ["ana", "Ana Souza", "Pforzheimer", "'29", "MCB"],
    ["aiden", "Aiden Kim", "Cabot", "'29", "Undeclared"],
    ["zara", "Zara Rahman", "Winthrop", "'28", "Government"],
    ["kofi", "Kofi Mensah", "Dunster", "'29", "Applied Math"],
  ];

  const people = {}; // id -> {name, house, year, conc, color}
  const PALETTE = ["#E8590C", "#2B8A3E", "#1971C2", "#9C36B5", "#C2255C", "#0C8599", "#5F3DC4", "#E67700", "#2F9E44", "#D6336C", "#1098AD", "#7048E8"];
  REGULARS.forEach(([k, name, house, year, conc], i) => {
    people["u_demo_" + k] = { name, house, year, conc, color: PALETTE[i % PALETTE.length] };
  });
  const used = new Set(REGULARS.map((r) => r[1]));
  for (let i = 0; people && Object.keys(people).length < 142; i++) {
    const name = pick(FIRST) + " " + pick(LAST);
    if (used.has(name)) continue;
    used.add(name);
    const id = "u_demo_s" + String(i).padStart(3, "0");
    people[id] = { name, house: pick(HOUSES), year: pick(["'27", "'28", "'28", "'29", "'29", "'29"]), conc: pick(CONC), color: PALETTE[i % PALETTE.length] };
  }
  people[ORGANIZER] = { name: "Roster organizer", house: "", year: "", conc: "", color: "#A51C30" };
  const ids = Object.keys(people).filter((id) => id !== ORGANIZER);
  const R_ = (k) => "u_demo_" + k;

  // ---- Lecture recaps ------------------------------------------------------
  const RECAPS = [
    {
      id: "rc-l7", lecture: 7, title: "Gambler's Ruin & Random Variables", date: ET("2026-09-24T14:45"), ts: ET("2026-09-24T16:20"), sections: "§2.7, §3.1–3.3",
      bullets: [
        { id: "b1", text: "First-step analysis turns gambler's ruin into a difference equation: condition on the outcome of the first round.", ref: "Slide 4" },
        { id: "b2", text: "With p = 1/2, the chance of winning is 1/2 no matter where you start.", ref: "Slide 9", fixedBy: "fx-l7-1", fixedText: "With p = 1/2, the chance of reaching N before 0, starting from i, is i/N. Where you start matters." },
        { id: "b3", text: "A random variable is a function from the sample space to the real numbers, not a \"random number\".", ref: "Slide 13" },
        { id: "b4", text: "Bin(n, p) counts successes in n independent Bern(p) trials; its PMF is C(n, k) p^k q^(n−k).", ref: "Slide 17" },
        { id: "b5", text: "Story proof: if X ~ Bin(n, p) and Y ~ Bin(m, p) are independent, then X + Y ~ Bin(n + m, p).", ref: "Slide 20" },
      ],
    },
    {
      id: "rc-l8", lecture: 8, title: "Hypergeometric, CDFs & Sympathetic Magic", date: ET("2026-09-29T14:45"), ts: ET("2026-09-29T16:05"), sections: "§3.4–3.9",
      bullets: [
        { id: "b1", text: "Elk capture–recapture: sampling without replacement gives a Hypergeometric, HGeom(w, b, n).", ref: "Slide 3" },
        { id: "b2", text: "Binomial vs. Hypergeometric is with vs. without replacement; conditioning a Binomial on a total gives a Hypergeometric.", ref: "Slide 7" },
        { id: "b3", text: "Every CDF is increasing, right-continuous, and goes from 0 to 1.", ref: "Slide 11" },
        { id: "b4", text: "Sympathetic magic: X + Y is not \"adding the PMFs\" — don't confuse a random variable with its distribution.", ref: "Slide 15" },
        { id: "b5", text: "Independence of r.v.s means P(X ≤ x, Y ≤ y) factors for all x, y.", ref: "Slide 18" },
      ],
    },
    {
      id: "rc-l9", lecture: 9, title: "Expectation & Linearity", date: ET("2026-10-01T14:45"), ts: ET("2026-10-01T16:12"), sections: "§4.1–4.3",
      bullets: [
        { id: "b1", text: "E[X] is a weighted average of the values X can take, weighted by their probabilities.", ref: "Slide 3" },
        { id: "b2", text: "Linearity: E[X + Y] = E[X] + E[Y] holds even when X and Y are dependent.", ref: "Slide 8" },
        { id: "b3", text: "Geometric: E[X] = 1/p, the expected number of trials until the first success.", ref: "Slide 14" },
        { id: "b4", text: "Toy collector: collecting all n toys takes n·H_n draws on average, where H_n = 1 + 1/2 + … + 1/n.", ref: "Slide 19" },
        { id: "b5", text: "St. Petersburg paradox: the expected payoff is infinite, yet nobody would pay much to play.", ref: "Slide 23" },
      ],
    },
  ];
  const FIXES = [
    { id: "fx-l7-1", recapId: "rc-l7", bulletId: "b2", by: R_("leila"), ts: ET("2026-09-24T17:02"), status: "applied",
      text: "With p = 1/2, the chance of reaching N before 0, starting from i, is i/N. Where you start matters.", reason: "Matches the slides" },
    { id: "fx-l8-1", recapId: "rc-l8", bulletId: "b5", by: R_("kofi"), ts: ET("2026-09-29T19:40"), status: "open",
      text: "Add: for discrete r.v.s it's enough that P(X = x, Y = y) = P(X = x)P(Y = y) for all x, y — that's the version he used on the board.", reason: "Matches what was said" },
    { id: "fx-l9-1", recapId: "rc-l9", bulletId: "b3", by: R_("nora"), ts: ET("2026-10-01T18:31"), status: "open",
      text: "In Stat 110, Geom(p) counts the failures before the first success, so E[X] = q/p. 1/p is the First Success distribution, FS(p). Slide 14 has both.", reason: "Matches the slides" },
  ];

  // ---- Hand-written recent conversation (cycle 2 so far) --------------------
  const M = (k, at, text, extra) => ({ by: k === "org" ? ORGANIZER : R_(k), ts: ET(at), text, thread: "main", kind: "text", ...extra });
  const recent = [
    ["m-gs1", M("dev", "2026-10-02T16:41", "gradescope is being so slow rn 😭 anyone else")],
    ["m-gs2", M("nora", "2026-10-02T16:43", "same, mine went through on the third try. don't forget to tag your pages")],
    ["m-gs3", M("sam", "2026-10-02T16:52", "tagging pages at 4:52 pm is a spiritual experience")],
    ["m-sec1", M("aiden", "2026-10-02T20:20", "are wednesday's section notes posted anywhere? missed it for lab")],
    ["m-sec2", M("mei", "2026-10-02T20:26", "canvas → Files → Sections → week 5. the handout on indicator r.v.s is really good", { replyTo: "m-sec1" })],
    ["m-sec3", M("aiden", "2026-10-02T20:27", "lifesaver, thank you", { replyTo: "m-sec2" })],
    ["m-oh1", M("leila", "2026-10-03T11:02", "is sunday OH still 3–5? the calendar on canvas looks different this week")],
    ["m-oh2", M("jonah", "2026-10-03T11:15", "still 3–5, they just moved the zoom link into the announcement", { replyTo: "m-oh1" })],
    ["m-ln1", M("ana", "2026-10-03T13:40", "put my lecture 9 notes in the notes folder, they have the chicks-in-a-circle picture 🐣", { attachments: [{ name: "Lecture 9 notes — Ana.pdf", size: "1.8 MB", kind: "pdf" }] })],
    ["m-ln2", M("zara", "2026-10-03T13:52", "the 25 unpecked chicks thing broke my brain in a good way")],
    ["m-st1", M("theo", "2026-10-03T21:12", "ok who else is starting pset 5 tonight because i refuse to do it thursday night again")],
    ["m-st2", M("mei", "2026-10-03T21:14", "me. cabot 3rd floor?", { replyTo: "m-st1" })],
    ["m-st3", M("theo", "2026-10-03T21:15", "bet")],
    ["m-st4", M("kofi", "2026-10-03T21:31", "omw, saving the big table by the windows")],
    // PSet 5 topic
    ["p-1a", M("maya", "2026-10-03T15:05", "#1 is just linearity right? you don't need independence anywhere", { thread: "pset5", tags: ["1"] })],
    ["p-1b", M("dev", "2026-10-03T15:11", "yep. that's the whole point of writing it as a sum of indicators", { thread: "pset5", tags: ["1"], replyTo: "p-1a" })],
    ["p-3a", M("jonah", "2026-10-03T20:40", "for 3(b) are we supposed to get a closed form or is leaving the sum fine", { thread: "pset5", tags: ["3b"] })],
    ["p-3b", M("nora", "2026-10-03T20:44", "the hint says simplify so i think closed form. i got something with 1/e in the limit but i don't trust it yet", { thread: "pset5", tags: ["3b"], replyTo: "p-3a" })],
    ["p-3c", M("leila", "2026-10-03T20:51", "not giving anything away but check n = 1 and n = 2. that's how i caught my mistake", { thread: "pset5", tags: ["3b"], replyTo: "p-3b" })],
    ["p-4a", M("sam", "2026-10-03T21:20", "does 4 want E[X] or E[X | at least one success]? the wording is throwing me", { thread: "pset5", tags: ["4"] })],
    ["p-4b", M("ana", "2026-10-03T21:24", "unconditional — re-read the second sentence, the conditioning is only in part (c)", { thread: "pset5", tags: ["4"], replyTo: "p-4a" })],
  ];

  // ---- Generated cycle-1 activity (PSet 4) ---------------------------------
  const POOL_MAIN = [
    "is the pset due at 5 or 11:59??", "5pm on gradescope, it's in the syllabus", "does anyone have the strategic practice link",
    "it's on the course site under Strategic Practice", "lecture was so good today ngl", "who's going to sunday OH",
    "is section mandatory? i've been going to thursday's", "optional but they say highly recommended", "sympathetic magic is my new favorite phrase",
    "wait is there a quiz this week", "no just the pset", "anyone want to work in lamont tmrw night", "the elk example finally made it click for me",
    "ok gambler's ruin is actually beautiful", "is anyone's gradescope not showing pset 4 yet", "thank you!!", "same", "+1",
    "he said check simple and extreme cases like 4 times today", "what time does the review session start", "7, science center hall c i think",
    "the stat110 youtube lectures at 1.5x are elite", "is the textbook pdf free? i only have the hard copy", "yes, probabilitybook.net",
  ];
  const POOL_PSET = [
    "for #2 did you use the story proof or just grind the algebra", "the story proof is so much cleaner", "how do you know when it's hypergeometric vs binomial",
    "replacement. without replacement → hypergeometric", "can someone explain why the CDF is right-continuous and not left",
    "my answer for 4(c) is 0.37 does that sound insane", "check n = 2, it should be obvious there", "is 5(a) asking for the PMF or just the support",
    "PMF, the support is part (b)", "for 3 i drew the pebble world picture and it helped a lot", "does 6 need first-step analysis?", "yeah condition on the first flip",
  ];
  const SHARES = [
    { text: "my notes from tuesday's lecture if they help anyone", attachments: [{ name: "L8 — HGeom + CDFs.pdf", size: "2.4 MB", kind: "pdf" }] },
    { text: "made a little desmos for the binomial pmf, drag p around https://www.desmos.com/calculator", attachments: [] },
    { text: "the course site has the old midterms btw https://stat110.hsites.harvard.edu", attachments: [] },
    { text: "photo of the board from today since the slides skipped it", attachments: [{ name: "IMG_4471.jpg", size: "3.1 MB", kind: "image" }] },
  ];
  // Who posts: a few regulars carry a lot, a long tail posts once or twice.
  const posters = [...REGULARS.map((r) => R_(r[0])), ...ids.slice(12, 40)];
  const reactorsOnly = ids.slice(40, 64);
  const generated = [];
  const c1 = CYCLES[0];
  for (let i = 0; i < 168; i++) {
    const ts = c1.start + 3600e3 + Math.floor(R() * (c1.end - c1.start - 7200e3));
    const hour = new Date(ts).getUTCHours() - 4;
    const late = hour < 9 && R() < 0.6 ? 12 * 3600e3 : 0; // fewer messages at 4am
    const by = R() < 0.55 ? pick(posters.slice(0, 12)) : pick(posters);
    const inPset = R() < 0.4;
    const share = i % 37 === 5 ? SHARES[(i / 37) | 0] : null;
    generated.push(["g-" + i, {
      by, ts: Math.min(ts + late, c1.end - 60e3), thread: inPset ? "pset4" : "main", kind: "text",
      text: share ? share.text : inPset ? pick(POOL_PSET) : pick(POOL_MAIN),
      attachments: share ? share.attachments : undefined,
    }]);
  }
  // Reactions: regulars and a quiet group who only react.
  const EMO = ["👍", "😂", "🙏", "❤️", "😭", "💯"];
  function react(msg, nReact, pool) {
    const r = {};
    for (let j = 0; j < nReact; j++) {
      const e = j < 2 ? pick(EMO.slice(0, 3)) : pick(EMO);
      const who = pick(pool);
      if (who === msg.by) continue;
      (r[e] = r[e] || {})[who] = msg.ts + Math.floor(R() * 5 * 3600e3);
    }
    return r;
  }
  for (const [, m] of generated) {
    if (R() < 0.45) m.reactions = react(m, 1 + Math.floor(R() * 4), [...posters, ...reactorsOnly, ...reactorsOnly]);
  }
  const RX = (map) => Object.fromEntries(Object.entries(map).map(([e, list]) => [e, Object.fromEntries(list.map(([k, at]) => [R_(k), ET(at)]))]));
  const recentReactions = {
    "m-gs1": RX({ "😭": [["sam", "2026-10-02T16:42"], ["maya", "2026-10-02T16:42"], ["zara", "2026-10-02T16:44"], ["kofi", "2026-10-02T16:45"], ["jonah", "2026-10-02T16:46"]] }),
    "m-gs3": RX({ "😂": [["dev", "2026-10-02T16:53"], ["mei", "2026-10-02T16:55"], ["theo", "2026-10-02T17:01"]] }),
    "m-sec2": RX({ "🙏": [["aiden", "2026-10-02T20:27"], ["zara", "2026-10-02T21:05"]] }),
    "m-ln1": RX({ "🙏": [["theo", "2026-10-03T13:44"], ["maya", "2026-10-03T13:47"], ["nora", "2026-10-03T14:02"], ["kofi", "2026-10-03T14:30"]], "❤️": [["mei", "2026-10-03T13:45"]] }),
    "m-st1": RX({ "✋": [["mei", "2026-10-03T21:13"], ["kofi", "2026-10-03T21:16"], ["zara", "2026-10-03T21:18"], ["dev", "2026-10-03T21:22"]], "😂": [["sam", "2026-10-03T21:13"]] }),
    "p-3c": RX({ "💯": [["jonah", "2026-10-03T20:53"], ["nora", "2026-10-03T20:55"]] }),
    "p-1b": RX({ "👍": [["maya", "2026-10-03T15:12"]] }),
  };
  for (const [id, m] of recent) if (recentReactions[id]) m.reactions = recentReactions[id];

  // Recap cards and system lines in the class chat.
  const recapMsgs = RECAPS.map((r) => ["rm-" + r.id, { by: ORGANIZER, ts: r.ts, thread: "main", kind: "recap", recapId: r.id, text: "Lecture " + r.lecture + " recap: " + r.title }]);
  const system = [
    ["s-place", { by: ORGANIZER, ts: PLACED_AT, thread: "main", kind: "system", text: "142 classmates were added to STAT 110. Say hi 👋" }],
    ["s-p5", { by: ORGANIZER, ts: ET("2026-10-02T17:00"), thread: "main", kind: "system", text: "PSet 4 closed. PSet 5 is due Fri, Oct 9 at 5:00 PM." }],
  ];

  // Agreement on corrections (who found the fix right).
  const agree = (list) => Object.fromEntries(list.map(([k, at]) => [R_(k), ET(at)]));
  FIXES[0].votes = agree([["nora", "2026-09-24T17:10"], ["dev", "2026-09-24T18:02"], ["maya", "2026-09-24T19:30"], ["kofi", "2026-09-24T20:11"]]);
  FIXES[1].votes = agree([["leila", "2026-09-29T20:02"]]);
  // Two agree so far: the viewer's "Yes" is the third and applies the fix live.
  FIXES[2].votes = agree([["leila", "2026-10-01T18:40"], ["dev", "2026-10-01T19:05"]]);

  // "Looks right" checks on recap lines (one document per person per line).
  const CHECKS = [
    ["rc-l7", "b1", ["maya", "dev", "nora"]], ["rc-l7", "b3", ["sam", "mei"]], ["rc-l7", "b4", ["jonah", "ana", "kofi"]], ["rc-l7", "b5", ["leila", "zara"]],
    ["rc-l8", "b1", ["maya", "theo", "ana"]], ["rc-l8", "b2", ["dev", "nora"]], ["rc-l8", "b3", ["kofi", "jonah"]], ["rc-l8", "b4", ["zara", "sam", "mei", "aiden"]],
    ["rc-l9", "b1", ["nora", "maya"]], ["rc-l9", "b2", ["dev", "leila", "kofi"]], ["rc-l9", "b4", ["ana"]],
  ];

  const threads = [
    ["pset4", { title: "PSet 4", kind: "pset", due: ET("2026-10-02T17:00"), problems: ["1", "2", "3", "4", "5", "6"], ts: ET("2026-09-25T17:00"), by: ORGANIZER }],
    ["pset5", { title: "PSet 5", kind: "pset", due: ET("2026-10-09T17:00"), problems: ["1", "2", "3a", "3b", "4", "5", "6"], ts: ET("2026-10-02T17:00"), by: ORGANIZER }],
  ];

  const hub = {
    cycles: CYCLES,
    experiment: true,
    notesFolder: "Shared notes folder",
    rules: [
      "Collaboration follows the Stat 110 syllabus: talk through ideas, write up your own solutions.",
      "No posting solutions or answers to graded problems.",
      "This chat is run by a student. Course staff are not in it.",
    ],
    due: [
      { id: "d1", title: "PSet 5", at: ET("2026-10-09T17:00"), where: "Gradescope" },
      { id: "d2", title: "Course registration deadline", at: ET("2026-10-05T23:59"), where: "my.harvard" },
      { id: "d3", title: "Midterm (in class)", at: ET("2026-10-13T13:30"), where: "Sanders Theatre" },
    ],
    links: [
      { id: "l1", title: "Course site", url: "https://stat110.hsites.harvard.edu" },
      { id: "l2", title: "Textbook (free PDF)", url: "https://probabilitybook.net" },
    ],
  };

  function members() {
    const R = rng(29); // own stream, so a reset reseeds identically
    const out = [];
    let k = 0;
    for (const id of ids) {
      const p = people[id];
      const visits = {};
      // Most placed students open the chat at least once; a third keep reading.
      const reads = R() < 0.82;
      if (reads) {
        visits.stat110 = { "2026-09-25": PLACED_AT + 3600e3 };
        if (R() < 0.6) visits.stat110["2026-09-30"] = ET("2026-09-30T22:00");
        if (R() < 0.45) visits.stat110["2026-10-03"] = ET("2026-10-03T12:00");
      }
      out.push(["members/" + id, {
        displayName: p.name, house: p.house, year: p.year, concentration: p.conc,
        courses: { stat110: PLACED_AT + (k++ % 5) * 1000, ...(R() < 0.3 ? { lifesci1a: PLACED_AT } : {}), ...(R() < 0.25 ? { compsci50: PLACED_AT } : {}) },
        visits, joinedAt: PLACED_AT,
      }]);
    }
    return out;
  }

  function seed() {
    const entries = [...members()];
    const all = [...system, ...recapMsgs, ...generated, ...recent];
    for (const [id, m] of all) entries.push(["courses/stat110/messages/" + id, { reactions: {}, ...m }]);
    for (const [id, t] of threads) entries.push(["courses/stat110/threads/" + id, t]);
    for (const r of RECAPS) entries.push(["recaps/stat110/items/" + r.id, { ...r, by: ORGANIZER }]);
    for (const f of FIXES) entries.push(["courses/stat110/fixes/" + f.id, f]);
    for (const [rid, bid, who] of CHECKS) {
      const r = RECAPS.find((x) => x.id === rid);
      who.forEach((k, j) => entries.push(["courses/stat110/checks/" + rid + "~" + bid + "~" + R_(k), { recapId: rid, bulletId: bid, by: R_(k), ts: r.ts + (j + 1) * 47 * 60e3 }]));
    }
    entries.push(["hub/stat110", hub]);
    // A little life in the other courses so placement shows real counts.
    entries.push(["courses/lifesci1a/messages/x1", { by: R_("ana"), ts: ET("2026-10-03T10:12"), thread: "main", kind: "text", text: "is the ch 6 reading the whole chapter or just 6.1–6.3?", reactions: {} }]);
    entries.push(["courses/lifesci1a/messages/x2", { by: R_("mei"), ts: ET("2026-10-03T10:20"), thread: "main", kind: "text", text: "6.1–6.3 + the folding box. pset is on protein structure", replyTo: "x1", reactions: {} }]);
    entries.push(["courses/compsci50/messages/y1", { by: R_("dev"), ts: ET("2026-10-03T18:05"), thread: "main", kind: "text", text: "anyone else's codespace stuck on 'setting up'", reactions: {} }]);
    return entries;
  }

  return { NOW, ME, ORGANIZER, PLACED_AT, CYCLES, people, seed, ET };
})();
