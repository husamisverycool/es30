// ---------------------------------------------------------------------------
// Harvard Fall 2026 catalog (a starter set — anyone can add a course by its
// my.harvard code). Sources: my.harvard / Coursicle listings, gened.college,
// writingprogram.fas.harvard.edu, registrar 2026-27 academic calendar.
// ---------------------------------------------------------------------------
const Catalog = (() => {
  const courses = [
    { id: "stat110", code: "STAT 110", title: "Introduction to Probability", who: "Joe Blitzstein", meets: "Tu Th 1:30–2:45 PM", where: "Sanders Theatre", size: 500, psets: "Weekly, due Fridays 5:00 PM on Gradescope" },
    { id: "lifesci1a", code: "LIFESCI 1A", title: "An Integrated Introduction to the Life Sciences: Chemistry, Molecular Biology, and Cell Biology", short: "Integrated Intro to the Life Sciences", who: "Daniel Kahne, Rachelle Gaudet", meets: "Lecture + weekly section and lab", where: "Science Center", size: 400, psets: "Weekly problem sets" },
    { id: "expos20", code: "EXPOS 20", title: "Medicine and the Moral Imagination", who: "Preceptor-led seminar of 15", meets: "Tu Th 9:00–10:15 AM", where: "Memorial Hall", size: 15, psets: "Three essays, each drafted and revised" },
    { id: "gened1079", code: "GENED 1079", title: "Why Is There No Cure for Health?", who: "David Cutler", meets: "Tu Th 12:00–1:15 PM", where: "", size: 250, psets: "" },
    { id: "compsci50", code: "COMPSCI 50", title: "Introduction to Computer Science", who: "David J. Malan", meets: "", where: "Sanders Theatre", size: 600, psets: "Weekly problem sets" },
    { id: "econ10a", code: "ECON 10A", title: "Principles of Economics: Microeconomics", who: "", meets: "", where: "", size: 500, psets: "" },
    { id: "math21a", code: "MATH 21A", title: "Multivariable Calculus", who: "", meets: "", where: "", size: 300, psets: "Weekly problem sets" },
    { id: "math21b", code: "MATH 21B", title: "Linear Algebra and Differential Equations", who: "", meets: "", where: "", size: 250, psets: "Weekly problem sets" },
    { id: "gened1093", code: "GENED 1093", title: "Who Lives, Who Dies: Reimagining Global Health", who: "Salmaan Keshavjee", meets: "Tu Th 10:30–11:45 AM", where: "", size: 250, psets: "" },
    { id: "physics15a", code: "PHYSICS 15A", title: "Introductory Mechanics and Relativity", who: "", meets: "", where: "", size: 150, psets: "Weekly problem sets" },
    { id: "compsci61", code: "COMPSCI 61", title: "Systems Programming and Machine Organization", who: "", meets: "", where: "", size: 250, psets: "Problem sets" },
  ];
  const byId = Object.fromEntries(courses.map((c) => [c.id, c]));

  // "stat 110", "STAT110", "Stat-110" -> "stat110"
  const idFromCode = (code) => code.toLowerCase().replace(/[^a-z0-9]/g, "");
  // "STAT 110" style from free text
  function normalizeCode(text) {
    const m = String(text).trim().toUpperCase().match(/^([A-Z&]{2,10})\s*[- ]?\s*(\d{1,4}[A-Z]{0,2})$/);
    return m ? m[1] + " " + m[2] : null;
  }
  function search(q) {
    const s = q.trim().toLowerCase().replace(/\s+/g, " ");
    if (!s) return courses;
    const compact = s.replace(/[^a-z0-9]/g, "");
    return courses.filter(
      (c) => c.id.includes(compact) || c.code.toLowerCase().includes(s) || c.title.toLowerCase().includes(s) || (c.who || "").toLowerCase().includes(s),
    );
  }
  // Houses and class years are spaces too: you're placed in them automatically.
  const HOUSE_SHORT = { Adams: "Adams", Cabot: "Cabot", Currier: "Currier", Dunster: "Dunster", Eliot: "Eliot", Kirkland: "Kirkland", Leverett: "Leverett", Lowell: "Lowell", Mather: "Mather", Pforzheimer: "Pfoho", Quincy: "Quincy", Winthrop: "Winthrop", Dudley: "Dudley" };
  const houseId = (h) => (h && HOUSE_SHORT[h] ? "house-" + h.toLowerCase() : null);
  const yearId = (y) => (y && /^'\d\d$/.test(y) ? "year-" + y.slice(1) : null);
  function space(id) {
    if (id.startsWith("house-")) {
      const name = Object.keys(HOUSE_SHORT).find((h) => "house-" + h.toLowerCase() === id) || id.slice(6);
      return { id, kind: "house", code: HOUSE_SHORT[name] || name, title: name === "Dudley" ? "Dudley Community" : name + " House", who: "Everyone in " + (HOUSE_SHORT[name] || name) + " on Roster", meets: "", where: "", size: 400, psets: "" };
    }
    if (id.startsWith("year-")) return { id, kind: "year", code: "Class of 20" + id.slice(5), title: "Everyone graduating in 20" + id.slice(5), who: "", meets: "", where: "", size: 1700, psets: "" };
    return null;
  }
  function get(id, extra) {
    if (byId[id]) return byId[id];
    const sp = space(id);
    if (sp) return sp;
    if (extra && extra[id]) return extra[id];
    return { id, code: id.toUpperCase(), title: "", who: "", meets: "", where: "", size: 0, psets: "" };
  }

  // Section slots people pick from (any course); Stat 110 runs many weekly sections.
  const SLOTS = [
    { id: "m1800", label: "Mon 6:00 PM", d: [1], s: 1080, e: 1140 }, { id: "t1930", label: "Tue 7:30 PM", d: [2], s: 1170, e: 1230 },
    { id: "w1630", label: "Wed 4:30 PM", d: [3], s: 990, e: 1050 }, { id: "w1930", label: "Wed 7:30 PM", d: [3], s: 1170, e: 1230 },
    { id: "r1500", label: "Thu 3:00 PM", d: [4], s: 900, e: 1065 }, { id: "r1630", label: "Thu 4:30 PM", d: [4], s: 990, e: 1050 },
    { id: "r1930", label: "Thu 7:30 PM", d: [4], s: 1170, e: 1230 }, { id: "f1030", label: "Fri 10:30 AM", d: [5], s: 630, e: 690 },
  ];
  const slot = (id) => SLOTS.find((x) => x.id === id);
  // Hinge-style prompts, rewritten for a class.
  const PROMPTS = ["I usually start the pset…", "Find me studying at…", "I can help with…", "I need help with…", "Ask me about…", "The concept that finally clicked…", "Hot take about this class…", "Study playlist on repeat…"];
  const CONCENTRATIONS = ["African and African American Studies", "Anthropology", "Applied Mathematics", "Art, Film, and Visual Studies", "Astrophysics", "Biomedical Engineering", "Chemical and Physical Biology", "Chemistry", "Chemistry and Physics", "Classics", "Comparative Literature", "Comparative Study of Religion", "Computer Science", "Earth and Planetary Sciences", "East Asian Studies", "Economics", "Electrical Engineering", "Engineering Sciences", "English", "Environmental Science and Engineering", "Environmental Science and Public Policy", "Folklore and Mythology", "Germanic Languages and Literatures", "Government", "History", "History and Literature", "History and Science", "History of Art and Architecture", "Human Developmental and Regenerative Biology", "Human Evolutionary Biology", "Integrative Biology", "Linguistics", "Mathematics", "Mechanical Engineering", "Molecular and Cellular Biology", "Music", "Near Eastern Languages and Civilizations", "Neuroscience", "Philosophy", "Physics", "Psychology", "Romance Languages and Literatures", "Slavic Languages and Literatures", "Social Studies", "Sociology", "South Asian Studies", "Statistics", "Theater, Dance & Media", "Women, Gender, and Sexuality", "Undeclared"];

  const houses = ["Adams", "Cabot", "Currier", "Dunster", "Eliot", "Kirkland", "Leverett", "Lowell", "Mather", "Pforzheimer", "Quincy", "Winthrop", "Dudley", "First-year (Yard)"];
  const houseShort = { Pforzheimer: "Pfoho", "First-year (Yard)": "Yard" };
  const years = ["'27", "'28", "'29", "'30"];

  // Fall 2026 dates from the registrar's 2026-27 calendar.
  const termDates = [
    { title: "Course registration deadline (Fifth Monday)", at: "2026-10-05T23:59:00-04:00", kind: "deadline" },
    { title: "Indigenous Peoples' Day — no classes", at: "2026-10-12T00:00:00-04:00", kind: "holiday" },
    { title: "Withdraw / change grading basis deadline", at: "2026-11-16T23:59:00-05:00", kind: "deadline" },
    { title: "Thanksgiving recess begins", at: "2026-11-25T00:00:00-05:00", kind: "holiday" },
    { title: "Last day of classes", at: "2026-12-04T17:00:00-05:00", kind: "term" },
  ];

  const BOARD_CATS = [
    { id: "event", label: "Events", emoji: "🎟️" }, { id: "study", label: "Study groups", emoji: "📚" }, { id: "market", label: "Marketplace", emoji: "🏷️" },
    { id: "lost", label: "Lost & found", emoji: "🔎" }, { id: "general", label: "General", emoji: "💬" },
  ];
  const STATUSES = [["📚", "Studying"], ["🍽️", "At the dhall"], ["🏃", "Running late"], ["🧪", "In lab"], ["😴", "Do not disturb"], ["🎧", "Free, say hi"]];
  const isCourse = (id) => !/^(house|year)-/.test(id);
  return { courses, byId, get, search, idFromCode, normalizeCode, houses, houseShort, years, termDates, SLOTS, slot, PROMPTS, CONCENTRATIONS, houseId, yearId, space, isCourse, BOARD_CATS, STATUSES };
})();
