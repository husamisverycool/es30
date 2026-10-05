// ---------------------------------------------------------------------------
// Runtime — decides between the live class chat (shared `db`, real classmates)
// and the demo class (LocalDB with marked example classmates), and wraps
// identity, presence, Claude and downloads behind one small object.
// ---------------------------------------------------------------------------
const Runtime = (() => {
  const hasClaude = () => typeof window.claude === "object" && window.claude && typeof window.claude.use === "function";
  const use = (name) => (hasClaude() ? window.claude.use(name).catch(() => null) : Promise.resolve(null));

  async function boot() {
    const params = new URLSearchParams(location.search);
    const forceDemo = !!window.ROSTER_FORCE_DEMO || params.has("demo");
    // Outside claude.ai (the Netlify build): a live class if this site has the /api function.
    if (!hasClaude()) {
      const web = forceDemo || typeof Remote === "undefined" ? null : await Remote.connect(params);
      if (web) {
        return {
          forceDemo: false, live: true, web: true, db: web.db, user: null,
          me: { id: web.uid, name: (web.placement && web.placement.name) || "", avatarUrl: "" },
          uid: web.uid, isOwner: !!web.hello.isOrganizer, guest: false, canWrite: true,
          sample: web.hello.ai ? Remote.sample : null, room: null, downloads: Remote.downloads, signedIn: true,
          hello: web.hello, placement: web.placement, remote: web.remote,
        };
      }
      return { forceDemo: true, live: false, web: false, webStatic: !forceDemo, db: null, user: null, me: null, uid: null, isOwner: false, guest: false, canWrite: false, sample: null, room: null, downloads: typeof Remote === "undefined" ? null : Remote.downloads, signedIn: false };
    }
    const [db, user, sample, room, downloads] = await Promise.all([
      forceDemo ? null : use("db"), use("user"), use("sample"), forceDemo ? null : use("room"), use("downloads"),
    ]);
    let me = null, canWrite = null, isOwner = false, guest = false;
    if (user) {
      try {
        me = await user.me();
        isOwner = !!me.isOwner;
        canWrite = await user.can("data.write");
        // "Verified" = a member of the organization that owns this artifact (not a guest).
        if (me.id) { const pr = await user.profiles([me.id]); guest = !!(pr && pr[me.id] && pr[me.id].guest); }
      } catch (_) { me = me || null; }
    }
    const live = !!(db && me && me.id);
    return {
      forceDemo,
      live,
      db,
      user,
      me,
      uid: me && me.id,
      isOwner,
      guest,
      // null = the platform said nothing; keep inputs and let a refused write decide.
      canWrite: canWrite === null ? (live ? true : false) : canWrite,
      sample,
      room,
      downloads,
      signedIn: !!(me && me.id),
    };
  }

  // Profiles resolver: live uses the platform; demo uses the example roster.
  function profileResolver(rt, demoPeople) {
    if (rt && rt.live && rt.user) {
      return async (ids) => {
        try { return await rt.user.profiles(ids); } catch (_) { return {}; }
      };
    }
    return async (ids) => {
      const out = {};
      for (const id of ids) {
        const p = demoPeople[id];
        out[id] = p
          ? { id, name: p.name, avatarUrl: "", color: p.color, isMe: false, guest: false }
          : { id, name: "", avatarUrl: "", color: "#8a8f98", isMe: false, guest: false };
      }
      return out;
    };
  }

  return { boot, profileResolver, hasClaude };
})();
