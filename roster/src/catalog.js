// ---------------------------------------------------------------------------
// Harvard Fall 2026 catalog (a starter set — anyone can add a course by its
// my.harvard code). Sources: my.harvard / Coursicle listings, gened.college,
// writingprogram.fas.harvard.edu, registrar 2026-27 academic calendar.
// ---------------------------------------------------------------------------
const Catalog = (() => {
  const courses = [
    { id: "stat110", code: "STAT 110", title: "Introduction to Probability", who: "Joe Blitzstein", meets: "Tu Th 1:30–2:45 PM", where: "Sanders Theatre", size: 500, psets: "Weekly, due Fridays 5:00 PM on Gradescope" },
    { id: "lifesci1a", code: "LIFESCI 1A", title: "An Integrated Introduction to the Life Sciences: Chemistry, Molecular Biology, and Cell Biology", short: "Integrated Intro to the Life Sciences", who: "Daniel Kahne, Rachelle Gaudet", meets: "Lecture + weekly section and lab", where: "Science Center", size: 400, psets: "Weekly problem sets" },
    { id: "expos20", code: "EXPOS 20", title: "Medicine and the Moral Imagination", who: "Preceptor-led seminar", meets: "Seminar of 15", where: "", size: 15, psets: "Three essays, each drafted and revised" },
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
  function get(id, extra) {
    if (byId[id]) return byId[id];
    if (extra && extra[id]) return extra[id];
    return { id, code: id.toUpperCase(), title: "", who: "", meets: "", where: "", size: 0, psets: "" };
  }

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

  return { courses, byId, get, search, idFromCode, normalizeCode, houses, houseShort, years, termDates };
})();
