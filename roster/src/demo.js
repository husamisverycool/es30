// ---------------------------------------------------------------------------
// Demo class — STAT 110 on Saturday, Oct 3, 2026, one pset cycle after
// placement, plus lighter LS 1a / Expos 20 / Gen Ed chats. Every person here
// is an EXAMPLE classmate, generated or written for the demo, and the UI
// labels them that way. Lives only in LocalDB, in the viewer's browser.
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
  const CONC = ["Statistics", "Applied Mathematics", "Economics", "Computer Science", "Molecular and Cellular Biology", "Neuroscience", "Mathematics", "Government", "Physics", "Human Evolutionary Biology", "Chemistry", "Undeclared"];
  const R_ = (k) => "u_demo_" + k;

  // Regulars: [key, name, house, year, concentration, stat110 section, prompts]
  const REGULARS = [
    ["maya", "Maya Okafor", "Eliot", "'28", "Applied Mathematics", "w1630", [["I usually start the pset…", "Wednesday after section, so I can ask about it Thursday"], ["Ask me about…", "story proofs. I will draw you a committee"]]],
    ["dev", "Dev Patel", "Lowell", "'29", "Computer Science", "r1930", [["I can help with…", "indicator random variables, weirdly"], ["Find me studying at…", "Lowell library, the room with the fireplace"]]],
    ["nora", "Nora Lindqvist", "Currier", "'29", "Statistics", "r1930", [["The concept that finally clicked…", "Geom counts failures, First Success counts trials"], ["Hot take about this class…", "the strategic practice is better than the textbook"]]],
    ["sam", "Sam Brennan", "Kirkland", "'28", "Economics", "m1800", [["I usually start the pset…", "Thursday 11pm. I'm working on it"], ["I need help with…", "knowing when to condition"]]],
    ["mei", "Mei Chen", "Pforzheimer", "'29", "Neuroscience", "w1630", [["Find me studying at…", "Cabot, 3rd floor, by the windows"], ["Study playlist on repeat…", "the Ghibli piano album"]]],
    ["theo", "Theo Alvarez", "Adams", "'28", "Economics", "m1800", [["I usually start the pset…", "Saturday night, as a lifestyle"]]],
    ["leila", "Leila Haddad", "Quincy", "'27", "Statistics", "t1930", [["I can help with…", "checking simple and extreme cases"], ["Ask me about…", "the old midterms, I did all of them"]]],
    ["jonah", "Jonah Feld", "Mather", "'29", "Physics", "t1930", [["The concept that finally clicked…", "a random variable is a function, not a number"]]],
    ["ana", "Ana Souza", "Pforzheimer", "'29", "Molecular and Cellular Biology", "w1630", [["Find me studying at…", "Pfoho dining hall after 8"], ["I can help with…", "turning lecture into clean notes"]]],
    ["aiden", "Aiden Kim", "Cabot", "'29", "Undeclared", "f1030", [["I need help with…", "catching up when lab runs over"]]],
    ["zara", "Zara Rahman", "Winthrop", "'28", "Government", "r1630", [["Hot take about this class…", "the chicks problem is the best problem"]]],
    ["kofi", "Kofi Mensah", "Dunster", "'29", "Applied Mathematics", "w1630", [["Ask me about…", "the matching problem, it's beautiful"]]],
  ];
  const PALETTE = ["#E8590C", "#2B8A3E", "#1971C2", "#9C36B5", "#C2255C", "#0C8599", "#5F3DC4", "#E67700", "#2F9E44", "#D6336C", "#1098AD", "#7048E8"];
  const people = {};
  REGULARS.forEach(([k, name, house, year, conc, sec, prompts], i) => {
    people[R_(k)] = { name, house, year, conc, color: PALETTE[i % PALETTE.length], sec, prompts };
  });
  const used = new Set(REGULARS.map((r) => r[1]));
  const SECS = ["m1800", "t1930", "w1630", "w1930", "r1630", "r1930", "f1030"];
  const PROMPT_POOL = [
    ["I usually start the pset…", ["Wednesday night", "the second it's posted", "Thursday, after section", "Friday morning, no regrets"]],
    ["Find me studying at…", ["Lamont, 3rd floor", "Cabot Science Library", "the Smith Center", "my house library"]],
    ["I need help with…", ["conditioning", "counting problems", "story proofs", "knowing where to start"]],
    ["I can help with…", ["Bayes' rule", "counting", "LaTeX for the write-up", "checking answers with simulation"]],
  ];
  for (let i = 0; Object.keys(people).length < 142; i++) {
    const name = pick(FIRST) + " " + pick(LAST);
    if (used.has(name)) continue;
    used.add(name);
    const pp = R() < 0.55 ? [pick(PROMPT_POOL)].map(([q, as]) => [q, pick(as)]) : [];
    people["u_demo_s" + String(i).padStart(3, "0")] = { name, house: pick(HOUSES), year: pick(["'27", "'28", "'28", "'29", "'29", "'29"]), conc: pick(CONC), color: PALETTE[i % PALETTE.length], sec: R() < 0.7 ? pick(SECS) : "", prompts: pp };
  }
  people[ORGANIZER] = { name: "Roster organizer", house: "", year: "", conc: "", color: "#A51C30" };
  const ids = Object.keys(people).filter((id) => id !== ORGANIZER);

  // ---- Lecture recaps ------------------------------------------------------
  const RECAPS = [
    {
      id: "rc-l7", lecture: 7, title: "Gambler's Ruin & Random Variables", date: ET("2026-09-24T13:30"), ts: ET("2026-09-24T16:20"), sections: "§2.7, §3.1–3.3",
      bullets: [
        { id: "b1", text: "First-step analysis turns gambler's ruin into a difference equation: condition on the outcome of the first round.", ref: "Slide 4" },
        { id: "b2", text: "With $p = 1/2$, the chance of winning is $1/2$ no matter where you start.", ref: "Slide 9", fixedBy: "fx-l7-1", fixedText: "With $p = 1/2$, the chance of reaching $N$ before $0$, starting from $i$, is $i/N$. Where you start matters." },
        { id: "b3", text: "A random variable is a function from the sample space to the real numbers, not a \"random number\".", ref: "Slide 13" },
        { id: "b4", text: "$\\text{Bin}(n,p)$ counts successes in $n$ independent $\\text{Bern}(p)$ trials, with PMF $\\binom{n}{k}p^k q^{n-k}$.", ref: "Slide 17" },
        { id: "b5", text: "Story proof: if $X \\sim \\text{Bin}(n,p)$ and $Y \\sim \\text{Bin}(m,p)$ are independent, then $X+Y \\sim \\text{Bin}(n+m,p)$.", ref: "Slide 20" },
      ],
    },
    {
      id: "rc-l8", lecture: 8, title: "Hypergeometric, CDFs & Sympathetic Magic", date: ET("2026-09-29T13:30"), ts: ET("2026-09-29T16:05"), sections: "§3.4–3.9",
      bullets: [
        { id: "b1", text: "Elk capture–recapture: sampling without replacement gives a Hypergeometric, $\\text{HGeom}(w,b,n)$.", ref: "Slide 3" },
        { id: "b2", text: "Binomial vs. Hypergeometric is with vs. without replacement; conditioning a Binomial on a total gives a Hypergeometric.", ref: "Slide 7" },
        { id: "b3", text: "Every CDF is increasing, right-continuous, and goes from 0 to 1.", ref: "Slide 11" },
        { id: "b4", text: "Sympathetic magic: $X+Y$ is not \"adding the PMFs\". Don't confuse a random variable with its distribution.", ref: "Slide 15" },
        { id: "b5", text: "Independence of r.v.s means $P(X \\le x, Y \\le y)$ factors for all $x, y$.", ref: "Slide 18" },
      ],
    },
    {
      id: "rc-l9", lecture: 9, title: "Expectation & Linearity", date: ET("2026-10-01T13:30"), ts: ET("2026-10-01T16:12"), sections: "§4.1–4.3",
      bullets: [
        { id: "b1", text: "$E[X]$ is a weighted average of the values $X$ can take, weighted by their probabilities.", ref: "Slide 3" },
        { id: "b2", text: "Linearity: $E[X+Y] = E[X] + E[Y]$ holds even when $X$ and $Y$ are dependent.", ref: "Slide 8" },
        { id: "b3", text: "Geometric: $E[X] = 1/p$, the expected number of trials until the first success.", ref: "Slide 14" },
        { id: "b4", text: "Toy collector: collecting all $n$ toys takes $nH_n$ draws on average, where $H_n = 1 + \\tfrac12 + \\dots + \\tfrac1n$.", ref: "Slide 19" },
        { id: "b5", text: "St. Petersburg paradox: the expected payoff is infinite, yet nobody would pay much to play.", ref: "Slide 23" },
      ],
    },
  ];
  const FIXES = [
    { id: "fx-l7-1", recapId: "rc-l7", bulletId: "b2", by: R_("leila"), ts: ET("2026-09-24T17:02"), status: "applied", appliedAt: ET("2026-09-24T20:11"),
      text: "With $p = 1/2$, the chance of reaching $N$ before $0$, starting from $i$, is $i/N$. Where you start matters.", reason: "Matches the slides" },
    { id: "fx-l8-1", recapId: "rc-l8", bulletId: "b5", by: R_("kofi"), ts: ET("2026-09-29T19:40"), status: "open",
      text: "For discrete r.v.s it's enough that $P(X=x, Y=y) = P(X=x)P(Y=y)$ for all $x, y$. That's the version he used on the board.", reason: "Matches what was said" },
    { id: "fx-l9-1", recapId: "rc-l9", bulletId: "b3", by: R_("nora"), ts: ET("2026-10-01T18:31"), status: "open",
      text: "In Stat 110, $\\text{Geom}(p)$ counts the failures before the first success, so $E[X] = q/p$. $1/p$ is the First Success distribution, $\\text{FS}(p)$. Slide 14 has both.", reason: "Matches the slides" },
  ];
  const agree = (list) => Object.fromEntries(list.map(([k, at]) => [R_(k), ET(at)]));
  FIXES[0].votes = agree([["nora", "2026-09-24T17:10"], ["dev", "2026-09-24T18:02"], ["maya", "2026-09-24T19:30"], ["kofi", "2026-09-24T20:11"]]);
  FIXES[1].votes = agree([["leila", "2026-09-29T20:02"]]);
  // Two agree so far: the viewer's "Yes" is the third and applies the fix live.
  FIXES[2].votes = agree([["leila", "2026-10-01T18:40"], ["dev", "2026-10-01T19:05"]]);
  const CHECKS = [
    ["rc-l7", "b1", ["maya", "dev", "nora"]], ["rc-l7", "b3", ["sam", "mei"]], ["rc-l7", "b4", ["jonah", "ana", "kofi"]], ["rc-l7", "b5", ["leila", "zara"]],
    ["rc-l8", "b1", ["maya", "theo", "ana"]], ["rc-l8", "b2", ["dev", "nora"]], ["rc-l8", "b3", ["kofi", "jonah"]], ["rc-l8", "b4", ["zara", "sam", "mei", "aiden"]],
    ["rc-l9", "b1", ["nora", "maya"]], ["rc-l9", "b2", ["dev", "leila", "kofi"]], ["rc-l9", "b4", ["ana"]],
  ];

  // ---- Hand-written recent conversation -------------------------------------
  const M = (k, at, text, extra) => ({ by: k === "org" ? ORGANIZER : R_(k), ts: ET(at), text, thread: "main", kind: "text", ...extra });
  const RX = (map) => Object.fromEntries(Object.entries(map).map(([e, list]) => [e, Object.fromEntries(list.map(([k, at]) => [R_(k), ET(at)]))]));
  const votesOf = (pairs, base) => Object.fromEntries(pairs.map(([who, o], i) => [who, { o, t: base + i * 7 * 60e3 }]));
  const recent = [
    ["m-board", M("mei", "2026-10-01T15:02", "board from today since the slides skipped it 🐣", { kind: "photo", image: { src: "gen:chicks", w: 960, h: 720 } })],
    ["m-gs1", M("dev", "2026-10-02T16:41", "gradescope is being so slow rn 😭 anyone else")],
    ["m-gs2", M("nora", "2026-10-02T16:43", "same, mine went through on the third try. don't forget to tag your pages")],
    ["m-gs3", M("sam", "2026-10-02T16:52", "tagging pages at 4:52 pm is a spiritual experience")],
    ["m-poll", M("sam", "2026-10-02T19:05", "", { kind: "poll", poll: { question: "When are you starting PSet 5?", options: [{ id: "a", text: "Already started" }, { id: "b", text: "This weekend" }, { id: "c", text: "Wednesday night (tradition)" }, { id: "d", text: "Thursday 11 pm, pray for me" }], votes: {} } })],
    ["m-sec1", M("aiden", "2026-10-02T20:20", "are wednesday's section notes posted anywhere? missed it for lab")],
    ["m-sec2", M("mei", "2026-10-02T20:26", "canvas → Files → Sections → week 5. the handout on indicator r.v.s is really good", { replyTo: "m-sec1" })],
    ["m-sec3", M("aiden", "2026-10-02T20:27", "lifesaver, thank you", { replyTo: "m-sec2" })],
    ["m-oh1", M("leila", "2026-10-03T11:02", "is sunday OH still 3–5? the calendar on canvas looks different this week")],
    ["m-oh2", M("jonah", "2026-10-03T11:15", "still 3–5, they just moved the zoom link into the announcement", { replyTo: "m-oh1" })],
    ["m-ln1", M("ana", "2026-10-03T13:40", "put my lecture 9 notes in Notes, with the chicks-in-a-circle picture")],
    ["m-ln2", M("zara", "2026-10-03T13:52", "the 25 unpecked chicks thing broke my brain in a good way")],
    ["m-mid", M("leila", "2026-10-03T17:20", "", { kind: "event", event: { title: "Midterm review: old exams", at: ET("2026-10-11T15:00"), end: ET("2026-10-11T17:00"), where: "Lamont Library, Level B", note: "Bringing the 2023 and 2024 midterms. We'll time ourselves on one, then go over it.", rsvps: {} } })],
    ["m-st1", M("theo", "2026-10-03T21:12", "ok who else is starting pset 5 tonight because i refuse to do it thursday night again")],
    ["m-st2", M("mei", "2026-10-03T21:14", "me. cabot 3rd floor?", { replyTo: "m-st1" })],
    ["m-grind", M("theo", "2026-10-03T21:16", "", { kind: "event", event: { title: "PSet 5 grind", at: ET("2026-10-03T21:30"), end: ET("2026-10-04T00:30"), where: "Cabot Science Library, 3rd floor", note: "Big table by the windows. Talking through ideas, writing up our own.", rsvps: {} } })],
    ["m-st4", M("kofi", "2026-10-03T21:31", "omw, saving the big table by the windows")],
    // PSet 5 topic
    ["p-1a", M("maya", "2026-10-03T15:05", "#1 is just linearity right? you don't need independence anywhere", { thread: "pset5", tags: ["1"], resolved: ET("2026-10-03T15:14") })],
    ["p-1b", M("dev", "2026-10-03T15:11", "yep. write $X = \\sum_j I_j$ and linearity does the rest", { thread: "pset5", tags: ["1"], replyTo: "p-1a" })],
    ["p-geo", M("kofi", "2026-10-03T16:10", "the geom vs first success thing from lecture tripped me up on 2, here's what was on the board", { thread: "pset5", tags: ["2"], kind: "photo", image: { src: "gen:geom", w: 960, h: 720 } })],
    ["p-3a", M("jonah", "2026-10-03T20:40", "for 3(b) are we supposed to get a closed form or is leaving the sum fine?", { thread: "pset5", tags: ["3b"] })],
    ["p-3b", M("nora", "2026-10-03T20:44", "the hint says simplify so i think closed form. i got something with $1/e$ in the limit but i don't trust it yet", { thread: "pset5", tags: ["3b"], replyTo: "p-3a" })],
    ["p-3c", M("leila", "2026-10-03T20:51", "not giving anything away but check $n = 1$ and $n = 2$. that's how i caught my mistake", { thread: "pset5", tags: ["3b"], replyTo: "p-3b" })],
    ["p-3poll", M("zara", "2026-10-03T20:58", "", { thread: "pset5", tags: ["3b"], kind: "poll", poll: { question: "3(b): where did you land?", options: [{ id: "a", text: "Closed form" }, { id: "b", text: "Left it as a sum" }, { id: "c", text: "Haven't gotten there" }], votes: {} } })],
    ["p-4a", M("sam", "2026-10-03T21:20", "does 4 want $E[X]$ or $E[X \\mid \\text{at least one success}]$? the wording is throwing me", { thread: "pset5", tags: ["4"] })],
    ["p-4b", M("ana", "2026-10-03T21:24", "unconditional. re-read the second sentence, the conditioning is only in part (c)", { thread: "pset5", tags: ["4"], replyTo: "p-4a" })],
    // Section chat (Wed 4:30 PM)
    ["s-1", M("maya", "2026-09-30T17:40", "thanks for the indicator handout today, whoever asked the chicks question 🙏", { thread: "sec-w1630" })],
    ["s-2", M("kofi", "2026-09-30T17:44", "that was me lol. the TF's drawing was elite", { thread: "sec-w1630", replyTo: "s-1" })],
    ["s-3", M("ana", "2026-10-03T12:10", "anyone want to do practice problems before section wed? i'll book a room in pfoho", { thread: "sec-w1630" })],
  ];
  const recentReactions = {
    "m-board": RX({ "🙏": [["theo", "2026-10-01T15:10"], ["maya", "2026-10-01T15:12"], ["nora", "2026-10-01T15:30"], ["kofi", "2026-10-01T16:02"], ["sam", "2026-10-01T16:20"], ["zara", "2026-10-01T17:41"]], "🐣": [["ana", "2026-10-01T15:05"], ["jonah", "2026-10-01T15:40"]] }),
    "m-gs1": RX({ "😭": [["sam", "2026-10-02T16:42"], ["maya", "2026-10-02T16:42"], ["zara", "2026-10-02T16:44"], ["kofi", "2026-10-02T16:45"], ["jonah", "2026-10-02T16:46"]] }),
    "m-gs3": RX({ "😂": [["dev", "2026-10-02T16:53"], ["mei", "2026-10-02T16:55"], ["theo", "2026-10-02T17:01"]] }),
    "m-sec2": RX({ "🙏": [["aiden", "2026-10-02T20:27"], ["zara", "2026-10-02T21:05"]] }),
    "m-ln1": RX({ "🙏": [["theo", "2026-10-03T13:44"], ["maya", "2026-10-03T13:47"], ["nora", "2026-10-03T14:02"], ["kofi", "2026-10-03T14:30"]], "❤️": [["mei", "2026-10-03T13:45"]] }),
    "m-st1": RX({ "✋": [["mei", "2026-10-03T21:13"], ["kofi", "2026-10-03T21:16"], ["zara", "2026-10-03T21:18"], ["dev", "2026-10-03T21:22"]], "😂": [["sam", "2026-10-03T21:13"]] }),
    "p-3c": RX({ "💯": [["jonah", "2026-10-03T20:53"], ["nora", "2026-10-03T20:55"]] }),
    "p-1b": RX({ "👍": [["maya", "2026-10-03T15:12"]] }),
    "p-geo": RX({ "🙏": [["nora", "2026-10-03T16:20"], ["sam", "2026-10-03T16:40"], ["jonah", "2026-10-03T17:02"]] }),
    "s-2": RX({ "😂": [["maya", "2026-09-30T17:45"]] }),
  };
  for (const [id, m] of recent) if (recentReactions[id]) m.reactions = recentReactions[id];

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
    { text: "photo of the board from today since the slides skipped it", kind: "photo", image: { src: "gen:lotus", w: 960, h: 720 } },
  ];
  const regularIds = REGULARS.map((r) => R_(r[0]));
  const posters = [...regularIds, ...ids.slice(12, 40)];
  const reactorsOnly = ids.slice(40, 64);
  const generated = [];
  const c1 = CYCLES[0];
  for (let i = 0; i < 168; i++) {
    const ts = c1.start + 3600e3 + Math.floor(R() * (c1.end - c1.start - 7200e3));
    const hour = new Date(ts).getUTCHours() - 4;
    const late = hour < 9 && R() < 0.6 ? 12 * 3600e3 : 0;
    const by = R() < 0.55 ? pick(posters.slice(0, 12)) : pick(posters);
    const inPset = R() < 0.4;
    const share = i % 37 === 5 ? SHARES[(i / 37) | 0] : null;
    const m = { by, ts: Math.min(ts + late, c1.end - 60e3), thread: inPset ? "pset4" : "main", kind: "text", text: inPset ? pick(POOL_PSET) : pick(POOL_MAIN) };
    if (share) Object.assign(m, share);
    if (inPset) m.tags = [pick(["1", "2", "3", "4", "5", "6"])];
    generated.push(["g-" + i, m]);
  }
  const EMO = ["👍", "😂", "🙏", "❤️", "😭", "💯"];
  function react(msg, n, pool) {
    const r = {};
    for (let j = 0; j < n; j++) {
      const e = j < 2 ? pick(EMO.slice(0, 3)) : pick(EMO);
      const who = pick(pool);
      if (who === msg.by) continue;
      (r[e] = r[e] || {})[who] = msg.ts + Math.floor(R() * 5 * 3600e3);
    }
    return r;
  }
  for (const [, m] of generated) if (R() < 0.45) m.reactions = react(m, 1 + Math.floor(R() * 4), [...posters, ...reactorsOnly, ...reactorsOnly]);

  // Poll votes and RSVPs from many classmates (deterministic).
  const pollMain = recent.find(([id]) => id === "m-poll")[1];
  pollMain.poll.votes = votesOf(ids.slice(0, 34).map((id, i) => [id, ["a", "b", "b", "c", "c", "c", "d", "c", "b"][i % 9]]), ET("2026-10-02T19:06"));
  const poll3 = recent.find(([id]) => id === "p-3poll")[1];
  poll3.poll.votes = votesOf([[R_("nora"), "a"], [R_("leila"), "a"], [R_("jonah"), "c"], [R_("maya"), "a"], [R_("dev"), "b"], [R_("sam"), "c"], [R_("kofi"), "a"], [ids[30], "c"], [ids[31], "b"]], ET("2026-10-03T21:00"));
  const rsvp = (list, base) => Object.fromEntries(list.map(([id, s], i) => [id, { s, t: base + i * 4 * 60e3 }]));
  recent.find(([id]) => id === "m-grind")[1].event.rsvps = rsvp([[R_("mei"), "going"], [R_("kofi"), "going"], [R_("dev"), "going"], [R_("zara"), "maybe"], [R_("ana"), "maybe"]], ET("2026-10-03T21:17"));
  recent.find(([id]) => id === "m-mid")[1].event.rsvps = rsvp([[R_("nora"), "going"], [R_("maya"), "going"], [R_("jonah"), "going"], [R_("sam"), "going"], [R_("kofi"), "going"], [ids[20], "going"], [ids[21], "going"], [ids[22], "going"], [ids[23], "going"], [R_("theo"), "maybe"], [R_("aiden"), "maybe"], [ids[24], "maybe"], [ids[25], "maybe"]], ET("2026-10-03T17:25"));

  // Recap cards and system lines in the class chat.
  const recapMsgs = RECAPS.map((r) => ["rm-" + r.id, { by: ORGANIZER, ts: r.ts, thread: "main", kind: "recap", recapId: r.id, text: "Lecture " + r.lecture + " recap: " + r.title }]);
  const system = [
    ["s-place", { by: ORGANIZER, ts: PLACED_AT, thread: "main", kind: "system", text: "142 classmates were added to STAT 110. Say hi 👋" }],
    ["s-p5", { by: ORGANIZER, ts: ET("2026-10-02T17:00"), thread: "main", kind: "system", text: "PSet 4 closed. PSet 5 is due Fri, Oct 9 at 5:00 PM." }],
  ];
  const threads = [
    ["pset4", { title: "PSet 4", kind: "pset", due: ET("2026-10-02T17:00"), problems: ["1", "2", "3", "4", "5", "6"], ts: ET("2026-09-25T17:00"), by: ORGANIZER }],
    ["pset5", { title: "PSet 5", kind: "pset", due: ET("2026-10-09T17:00"), problems: ["1", "2", "3a", "3b", "4", "5", "6"], ts: ET("2026-10-02T17:00"), by: ORGANIZER }],
  ];
  // "Stuck too" taps on PSet 5 problems.
  const STUCK = [["3b", ids.slice(0, 9)], ["4", [R_("sam"), ids[40], ids[41], ids[42]]], ["2", [R_("kofi"), ids[50]]], ["1", [R_("maya")]]];

  // Shared lecture notes.
  const NOTES = [
    { id: "n-l9-ana", by: R_("ana"), lecture: 9, ts: ET("2026-10-03T13:38"), title: "Lecture 9 · clean notes",
      body: "**Expectation**\n- $E[X] = \\sum_x x\\,P(X=x)$, a weighted average\n- Linearity: $E[X+Y] = E[X]+E[Y]$, always, even if dependent\n\n**Indicators**\n- $I_A = 1$ if $A$ happens, else $0$; $E[I_A] = P(A)$ (fundamental bridge)\n- Chicks in a circle: $100 \\cdot \\tfrac14 = 25$ unpecked\n\n**Geom vs FS**\n- $\\text{Geom}(p)$: failures before first success, $E = q/p$\n- $\\text{FS}(p)$: trials including the success, $E = 1/p$",
      image: { src: "gen:chicks", w: 960, h: 720 } },
    { id: "n-l9-nora", by: R_("nora"), lecture: 9, ts: ET("2026-10-01T18:50"), title: "Geom vs First Success, one card",
      body: "If you remember one thing: Stat 110's Geom counts **failures**.\n- $X \\sim \\text{Geom}(p)$: $P(X=k) = q^k p$, $k = 0,1,\\dots$, $E[X] = q/p$\n- $Y = X + 1 \\sim \\text{FS}(p)$, $E[Y] = 1/p$" },
    { id: "n-l8-jonah", by: R_("jonah"), lecture: 8, ts: ET("2026-09-29T20:30"), title: "Lecture 8 · HGeom + CDFs",
      body: "- Elk: tag $w$, untagged $b$, recapture $n$: number tagged $\\sim \\text{HGeom}(w,b,n)$\n- CDF: increasing, right-continuous, $\\to 0$ and $\\to 1$\n- **Sympathetic magic:** a r.v. is not its distribution" },
    { id: "n-l7-leila", by: R_("leila"), lecture: 7, ts: ET("2026-09-24T19:12"), title: "Gambler's ruin in 5 lines",
      body: "1. Let $p_i$ = P(win starting at $i$)\n2. Condition on the first round: $p_i = p\\,p_{i+1} + q\\,p_{i-1}$\n3. Boundaries: $p_0 = 0$, $p_N = 1$\n4. Fair game ($p = 1/2$): $p_i = i/N$\n5. Where you start matters." },
  ];
  const helpful = { "n-l9-ana": ["maya", "nora", "theo", "kofi", "zara", "sam", "dev", "aiden"], "n-l9-nora": ["leila", "dev", "maya", "jonah", "kofi"], "n-l8-jonah": ["ana", "mei"], "n-l7-leila": ["nora", "maya", "kofi"] };
  for (const n of NOTES) n.helpful = Object.fromEntries((helpful[n.id] || []).map((k, i) => [R_(k), n.ts + (i + 1) * 31 * 60e3]));

  const SECTION_LABEL = { m1800: "Mon 6:00 PM", t1930: "Tue 7:30 PM", w1630: "Wed 4:30 PM", w1930: "Wed 7:30 PM", r1630: "Thu 4:30 PM", r1930: "Thu 7:30 PM", f1030: "Fri 10:30 AM" };

  const hub = {
    cycles: CYCLES,
    experiment: true,
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

  // Who has added whom. Mei and Ana (Pfoho, Stat 110) already added the viewer,
  // so adding them back makes you friends right away.
  const FOLLOWS = {
    maya: ["dev", "nora", "kofi", "zara"], dev: ["maya", "nora", "sam"], nora: ["dev", "maya", "leila"], sam: ["theo", "dev"], mei: ["ana", "kofi", "maya", "you"],
    theo: ["sam", "mei", "zara"], leila: ["nora", "jonah"], jonah: ["leila", "aiden"], ana: ["mei", "aiden", "you"], aiden: ["jonah", "ana"], zara: ["maya", "theo"], kofi: ["mei", "maya"],
  };
  const STATUS = {
    mei: ["📚", "PSet 5 at Cabot", "2026-10-04T00:30"], theo: ["📚", "PSet 5 grind, come through", "2026-10-04T00:30"], kofi: ["📚", "Cabot 3rd floor", "2026-10-04T00:00"],
    dev: ["🎧", "Free, say hi", "2026-10-03T23:30"], sam: ["😴", "Do not disturb", "2026-10-04T09:00"], ana: ["🍽️", "Pfoho dhall", "2026-10-03T22:15"],
  };
  // Campus Board posts (Saturn's Bulletin, Fizz's feed).
  const BOARD = [
    { id: "b-crepes", by: "ana", ts: "2026-10-03T15:20", cat: "event", title: "Study break: crepes in the Pfoho JCR", body: "Sunday 9 pm. Nutella, strawberries, and a quiet room after if you want to keep working.", event: { at: "2026-10-04T21:00", end: "2026-10-04T22:30", where: "Pforzheimer House JCR" }, going: ["mei", "aiden", "kofi", "maya"], maybe: ["sam"] },
    { id: "b-book", by: "leila", ts: "2026-10-02T12:05", cat: "market", title: "Selling: Blitzstein & Hwang, 2nd edition", body: "Hardcover, a few highlights in ch. 1–3. The PDF is free too, but some people like paper.", price: "$25" },
    { id: "b-lost", by: "jonah", ts: "2026-10-01T15:10", cat: "lost", title: "Lost: navy Hydro Flask with a Mather sticker", body: "Left it in Sanders after Thursday's Stat 110 lecture, row M. Would love it back." },
    { id: "b-ls1a", by: "mei", ts: "2026-10-03T09:30", cat: "study", title: "LS 1a ch. 6 study group", body: "Protein folding problems before the pset is due. All levels.", event: { at: "2026-10-05T20:00", end: "2026-10-05T22:00", where: "Pfoho dining hall" }, going: ["ana"], maybe: ["aiden"] },
    { id: "b-calc", by: "kofi", ts: "2026-10-02T19:30", cat: "market", title: "TI-84 Plus CE, barely used", body: "Comes with the charging cable. Pick up in Dunster.", price: "$60" },
    { id: "b-lamp", by: "nora", ts: "2026-10-03T08:15", cat: "market", title: "Free: desk lamp and a small whiteboard", body: "Moving rooms this weekend. First come, first served, Currier.", price: "Free" },
    { id: "b-trucks", by: "zara", ts: "2026-10-03T11:45", cat: "general", title: "Food trucks on the Science Center Plaza today", body: "The dumpling one is back. Line's short before 12:15." },
    { id: "b-run", by: "dev", ts: "2026-10-02T07:40", cat: "event", title: "Charles River 5K, easy pace", body: "Meeting at Weld Boathouse, back by 9. No one gets left behind.", event: { at: "2026-10-04T08:00", end: "2026-10-04T09:00", where: "Weld Boathouse" }, going: ["maya", "theo"], maybe: ["nora"] },
  ];
  const BOARD_COMMENTS = { "b-book": [["sam", "2026-10-02T13:10", "is it still available?"], ["leila", "2026-10-02T13:30", "yes! dm me in Stat 110 or find me in Quincy"]], "b-lost": [["aiden", "2026-10-01T18:00", "I think someone turned one in at the Science Center front desk"]] };

  function members() {
    const R2 = rng(29);
    const out = [];
    let k = 0;
    for (const id of ids) {
      const p = people[id];
      const visits = {};
      if (R2() < 0.82) {
        visits.stat110 = { "2026-09-25": PLACED_AT + 3600e3 };
        if (R2() < 0.6) visits.stat110["2026-09-30"] = ET("2026-09-30T22:00");
        if (R2() < 0.45) visits.stat110["2026-10-03"] = ET("2026-10-03T12:00");
      }
      const courses = { stat110: PLACED_AT + (k++ % 5) * 1000 };
      if (R2() < 0.3 || ["u_demo_ana", "u_demo_mei"].includes(id)) courses.lifesci1a = PLACED_AT;
      if (R2() < 0.25 || id === "u_demo_dev") courses.compsci50 = PLACED_AT;
      if (R2() < 0.4 || ["u_demo_maya", "u_demo_zara", "u_demo_theo"].includes(id)) courses.gened1079 = PLACED_AT;
      if (["u_demo_mei", "u_demo_zara", "u_demo_aiden"].includes(id) || (k > 90 && k < 102)) courses.expos20 = PLACED_AT;
      // Auto-placed in their House and class-year chats.
      courses["house-" + p.house.toLowerCase()] = PLACED_AT + 1;
      courses["year-" + p.year.slice(1)] = PLACED_AT + 1;
      const following = {};
      for (const f of FOLLOWS[id.replace("u_demo_", "")] || []) following[f === "you" ? ME : R_(f)] = PLACED_AT + 3600e3;
      const st = STATUS[id.replace("u_demo_", "")];
      out.push(["members/" + id, {
        displayName: p.name, house: p.house, year: p.year, concentration: p.conc,
        courses, visits, joinedAt: PLACED_AT,
        sections: p.sec ? { stat110: p.sec } : {},
        prompts: (p.prompts || []).map(([q, a]) => ({ q, a })),
        pledgeAt: PLACED_AT, verified: "harvard.edu", following,
        ...(st ? { status: { e: st[0], text: st[1], until: ET(st[2]), t: NOW - 40 * 60e3 } } : {}),
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
    for (const n of NOTES) entries.push(["courses/stat110/notes/" + n.id, n]);
    for (const [rid, bid, who] of CHECKS) {
      const r = RECAPS.find((x) => x.id === rid);
      who.forEach((k, j) => entries.push(["courses/stat110/checks/" + rid + "~" + bid + "~" + R_(k), { recapId: rid, bulletId: bid, by: R_(k), ts: r.ts + (j + 1) * 47 * 60e3 }]));
    }
    for (const [p, who] of STUCK) who.forEach((id, j) => entries.push(["courses/stat110/stuck/pset5~" + p + "~" + id, { thread: "pset5", problem: p, by: id, ts: ET("2026-10-03T18:00") + j * 9 * 60e3 }]));
    entries.push(["hub/stat110", hub]);
    // Other classes, lighter.
    const L = (cid, id, k, at, text, extra) => entries.push(["courses/" + cid + "/messages/" + id, { by: R_(k), ts: ET(at), thread: "main", kind: "text", text, reactions: {}, ...extra }]);
    L("lifesci1a", "x1", "ana", "2026-10-03T10:12", "is the ch 6 reading the whole chapter or just 6.1–6.3?");
    L("lifesci1a", "x2", "mei", "2026-10-03T10:20", "6.1–6.3 + the folding box. pset is on protein structure", { replyTo: "x1" });
    L("lifesci1a", "x3", "mei", "2026-10-03T10:24", "this is the board from lecture if you missed it", { kind: "photo", image: { src: "gen:folding", w: 960, h: 720 } });
    L("lifesci1a", "x4", "ana", "2026-10-03T19:02", "", { kind: "event", event: { title: "Ch 6 problem set crew", at: ET("2026-10-05T20:00"), end: ET("2026-10-05T22:00"), where: "Pfoho dining hall", note: "Bring the folding diagrams.", rsvps: { [R_("mei")]: { s: "going", t: ET("2026-10-03T19:05") } } } });
    L("expos20", "e1", "zara", "2026-10-02T09:40", "did everyone get conference slots for draft 1? mine's tuesday");
    L("expos20", "e2", "aiden", "2026-10-02T10:03", "wednesday 2pm. bringing my intro, it's a mess", { replyTo: "e1" });
    L("gened1079", "g1", "theo", "2026-10-02T13:30", "the cutler lecture on health spending was so good");
    L("gened1079", "g2", "maya", "2026-10-02T13:41", "the graph comparing US vs OECD spending is wild", { replyTo: "g1" });
    L("compsci50", "y1", "dev", "2026-10-03T18:05", "anyone else's codespace stuck on 'setting up'");
    entries.push(["hub/lifesci1a", { due: [{ id: "ls1", title: "Problem set (example)", at: ET("2026-10-09T12:00"), where: "Canvas" }], rules: ["Talk through ideas, write up your own answers."], links: [] }]);
    entries.push(["hub/expos20", { due: [{ id: "ex1", title: "Essay 1 draft (example)", at: ET("2026-10-06T23:59"), where: "Canvas" }], rules: [], links: [] }]);
    // House and class-year chats.
    L("house-pforzheimer", "h1", "ana", "2026-10-03T15:22", "crepes in the JCR sunday 9pm, it's on the Board 🥞");
    L("house-pforzheimer", "h2", "mei", "2026-10-03T15:30", "the shuttle was 20 min late again this morning, almost missed stat 110", { replyTo: "h1" });
    L("house-pforzheimer", "h3", "aiden", "2026-10-03T15:41", "the quad express is so unpredictable on fridays");
    L("house-pforzheimer", "h4", "ana", "2026-10-03T19:55", "anyone have a stapler i can borrow, A-entryway");
    L("house-pforzheimer", "h5", "mei", "2026-10-03T21:12", "@Priya Raman you're in stat 110 too right? we're at cabot for the pset 5 grind, there's room at the big table", { mentions: [ME] });
    L("year-29", "y1", "jonah", "2026-10-02T18:20", "reminder: course registration deadline is monday 11:59pm on my.harvard");
    L("year-29", "y2", "kofi", "2026-10-02T18:31", "thank you, i almost forgot to add my gen ed", { replyTo: "y1" });
    L("year-29", "y3", "nora", "2026-10-03T12:04", "concentration declaration info session is after break, the advising office posted it");
    for (const b of BOARD) {
      const doc = { by: R_(b.by), ts: ET(b.ts), cat: b.cat, title: b.title, body: b.body, reactions: {}, comments: (BOARD_COMMENTS[b.id] || []).length };
      if (b.price) doc.price = b.price;
      if (b.event) doc.event = { at: ET(b.event.at), end: ET(b.event.end), where: b.event.where, rsvps: Object.fromEntries([...(b.going || []).map((k, i) => [R_(k), { s: "going", t: ET(b.ts) + (i + 1) * 15 * 60e3 }]), ...(b.maybe || []).map((k, i) => [R_(k), { s: "maybe", t: ET(b.ts) + (i + 2) * 21 * 60e3 }])]) };
      doc.reactions = { "🔥": Object.fromEntries((b.going || ["maya", "dev"]).slice(0, 3).map((k, i) => [R_(k), ET(b.ts) + (i + 1) * 9 * 60e3])) };
      entries.push(["board/" + b.id, doc]);
      (BOARD_COMMENTS[b.id] || []).forEach(([k, at, text], i) => entries.push(["board/" + b.id + "/comments/c" + i, { by: R_(k), ts: ET(at), text }]));
    }
    return entries;
  }

  return { NOW, ME, ORGANIZER, PLACED_AT, CYCLES, people, seed, ET, SECTION_LABEL };
})();
