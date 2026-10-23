/* Browser preview of the !admin menu. Builds the real admin_v1.xml with the real admin_v1.vcss
   (translated to web CSS) and paints it from sample data the way src/AdminMenu.cs does.
   Embedded data comes from tools/gen_admin_preview.py: window.MA_DATA = { xml, vcss, lang: { en, de } }. */
(function () {
  "use strict";

  const DATA = window.MA_DATA;

  // ---- layout: XML -> elements ------------------------------------------------------------

  const TAGS = { Panel: "p-panel", Label: "p-label", Button: "p-button" };
  const bindings = []; // { el, parts } for labels with {s:var}
  const byId = {};

  function build(node) {
    const tag = TAGS[node.tagName];
    if (!tag) throw new Error("unknown element " + node.tagName);
    const el = document.createElement(tag);
    for (const attr of node.attributes) {
      if (attr.name === "class") el.className = attr.value;
      else if (attr.name === "id") { el.id = attr.value; byId[attr.value] = el; }
      else if (attr.name === "hittest") el.dataset.hit = attr.value;
      else if (attr.name === "text") {
        const parts = attr.value.split(/(\{s:[a-z0-9_]+\})/).filter(Boolean);
        if (parts.some((p) => p.startsWith("{s:"))) bindings.push({ el, parts });
        else el.textContent = attr.value;
      }
    }
    for (const child of node.children) el.appendChild(build(child));
    return el;
  }

  // ---- styles: vcss -> web CSS ------------------------------------------------------------

  const H_ALIGN = { left: "start", center: "center", right: "end" };
  const V_ALIGN = { top: "start", center: "center", middle: "center", bottom: "end" };

  function size(prop, value) {
    const axis = prop === "width" ? "w" : "h";
    const self = prop === "width" ? "--hs" : "--vs";
    const fill = /^fill-parent-flow\(\s*([\d.]+)\s*\)$/.exec(value);
    if (fill) return [`--fp${axis}: ${fill[1]}`, `${self}: stretch`, `${prop}: auto`];
    const reset = [`--fp${axis}: 0`, `${self}: initial`];
    if (value === "fit-children") return reset.concat(`${prop}: fit-content`);
    return reset.concat(`${prop}: ${value}`);
  }

  function declaration(prop, value) {
    switch (prop) {
      case "width":
      case "height":
        return size(prop, value);
      case "flow-children":
        return [`--flow: ${{ down: "col", right: "row" }[value] || "grid"}`];
      case "horizontal-align":
        return [`--ha: ${H_ALIGN[value] || "start"}`];
      case "vertical-align":
        return [`--va: ${V_ALIGN[value] || "start"}`];
      case "visibility":
        return [value === "collapse" ? "--vis: none" : "--vis: initial"];
      case "font-size":
        return [`font-size: ${/^[\d.]+$/.test(value) ? value + "px" : value}`];
      case "text-overflow":
        return [`text-overflow: ${value === "ellipsis" ? "ellipsis" : "clip"}`, "overflow: hidden"];
      case "world-blur":
        return ["backdrop-filter: blur(4px)"];
      case "wash-color":
      case "sound":
        return [];
      default:
        return [`${prop}: ${value}`];
    }
  }

  function translate(vcss) {
    const src = vcss.replace(/\/\*[\s\S]*?\*\//g, "");
    const rule = /([^{}]+)\{([^{}]*)\}/g;
    let out = "";
    let m;
    while ((m = rule.exec(src))) {
      const selector = m[1].trim()
        .replace(/\bPanel\b/g, TAGS.Panel)
        .replace(/\bLabel\b/g, TAGS.Label)
        .replace(/\bButton\b/g, TAGS.Button);
      const decls = [];
      for (const raw of m[2].split(";")) {
        const i = raw.indexOf(":");
        if (i < 0) continue;
        decls.push(...declaration(raw.slice(0, i).trim(), raw.slice(i + 1).trim()));
      }
      out += `${selector} { ${decls.join("; ")} }\n`;
    }
    return out;
  }

  // ---- texts ------------------------------------------------------------------------------

  let lang = "en";
  const T = (key) => DATA.lang[lang][key] ?? DATA.lang.en[key] ?? key;
  const N = (n) => String(n);
  const clock = (s) => { const t = Math.max(0, Math.ceil(s)); return N(Math.floor(t / 60)) + ":" + String(t % 60).padStart(2, "0"); };
  const fill = (text, map) => Object.keys(map).reduce((s, k) => s.split("{" + k + "}").join(map[k]), text);

  function durationText(minutes) {
    if (minutes <= 0) return T("menu.dur.perm");
    if (minutes % 1440 === 0) return fill(T("menu.dur.days"), { n: minutes / 1440 });
    if (minutes % 60 === 0) return fill(T("menu.dur.hours"), { n: minutes / 60 });
    return fill(T("menu.dur.minutes"), { n: minutes });
  }

  // ---- sample state (what the server would know) ------------------------------------------

  const ITEMS = [["weapon_ak47", "AK-47"], ["weapon_m4a1", "M4A4"], ["weapon_m4a1_silencer", "M4A1-S"], ["weapon_awp", "AWP"],
    ["weapon_deagle", "Deagle"], ["weapon_hegrenade", "HE"], ["weapon_flashbang", "Flash"], ["weapon_smokegrenade", "Smoke"],
    ["weapon_molotov", "Molotov"], ["item_assaultsuit", "Kevlar+H"], ["item_defuser", "Defuser"], ["weapon_healthshot", "Healthshot"]];
  const MAPS = ["de_ancient", "de_anubis", "de_dust2", "de_inferno", "de_mirage", "de_nuke", "de_overpass", "de_train", "de_vertigo", "cs_italy", "cs_office"];
  const DURATIONS = [60, 1440, 10080, 0];
  const VALUE_STEPS = [[25, 1, 500], [25, 0, 100], [1000, 0, 16000]];
  const SETTING_STEPS = [[0.25, 0.5, 15], [1, 0, 30], [1, 0, 60], [100, 100, 2000], [1, 0, 10]];
  const ACTIONS = ["kick", "ban", "mute", "gag", "rename", "tot", "toct", "tospec", "fswitch", "respawn", "kill", "slap", "freeze", "noclip", "god", "bring", "goto", "strip"];
  const CONFIRM_ACTIONS = ["kick", "rename", "kill", "strip"];
  const SERVER = ["rr", "mr", "pause", "tmt", "tmct", "wustart", "wuend", "wuext", "swap", "scramble", "bott", "botct", "botkick"];
  const CONFIRM_SERVER = ["mr", "swap", "scramble", "botkick"];
  const SWITCHES = ["wuhold", "ff", "alltalk", "deadtalk", "buyany", "respawn"];
  const SETTINGS = ["roundtime", "freezetime", "maxrounds", "gravity", "teamlimit"];
  const SERVER_HEADS = ["round", "warmup", "match", "teams", "rules"];
  const STAT_KEYS = ["hp", "armor", "money", "kda", "damage", "hs", "mvp", "score", "ping", "online"];
  const DPAGES = ["mod", "team", "player", "items"];
  const RECORD_KINDS = ["bans", "mutes", "gags"];
  const DANGER = ["kick", "ban", "kill", "slap", "strip", "rename", "restart", "swap", "scramble", "map"];
  const ROWS = 10, SPEC = 6, MAP_TILES = 12, RECORDS = 8, LOG_ROWS = 10;
  const ADMIN = "Admin";

  let nextId = 2;
  function player(name, team, k, d, a, extra) {
    const bot = name.startsWith("BOT ");
    const id = nextId++;
    return Object.assign({
      id, name, team, bot, alive: true, k, d, a,
      ping: bot ? 0 : 20 + ((id * 17) % 60),
      hp: 100, armor: 100, money: 800 + ((id * 1300) % 9000),
      damage: k * 92 + a * 31, hs: Math.round(k * 0.45), mvp: Math.floor(k / 4), score: k * 2 + a,
      online: bot ? -1 : 600 + id * 431,
      steam: bot ? "" : "7656119800" + String(1000000 + id * 7919).slice(-7),
      muted: false, gagged: false, frozen: false, noclip: false, god: false
    }, extra || {});
  }

  const S = {
    open: true,
    tab: 0,
    players: [
      player(ADMIN, "t", 14, 6, 3, { self: true, money: 4350 }),
      player("nightowl", "t", 11, 9, 2, { muted: true }),
      player("Tobi", "t", 7, 10, 5, { alive: false }),
      player("BOT Frank", "t", 5, 11, 1),
      player("BOT Ringo", "t", 3, 12, 2, { alive: false }),
      player("pixelpanda", "ct", 16, 7, 4),
      player("Mara", "ct", 12, 8, 6, { gagged: true }),
      player("lumen", "ct", 9, 9, 3, { alive: false }),
      player("BOT Vitaliy", "ct", 6, 10, 2),
      player("BOT Kask", "ct", 4, 12, 3),
      player("Chris_TV", "spec", 0, 0, 0),
      player("camera_02", "spec", 0, 0, 0)
    ],
    target: 0,
    dpage: 0,
    banPick: false,
    banDuration: 0,
    armed: null,
    armedUntil: 0,
    teamPage: [0, 0],
    map: "de_mirage",
    mapPage: 0,
    round: 14,
    score: [6, 7],
    roundLeft: 72,
    freezeLeft: 0,
    warmup: false,
    warmupLeft: 0,
    warmupHold: false,
    warmupExtend: 0,
    paused: false,
    pauseNext: false,
    rules: { ff: false, alltalk: false, deadtalk: true, buyany: false, respawn: false },
    settings: { roundtime: 1.92, freezetime: 15, maxrounds: 24, gravity: 800, teamlimit: 2 },
    records: {
      bans: [
        { steam: "76561198000123456", name: "spinbot", reason: T("menu.ban.reason0"), until: 0, date: "2026-10-21 19:42", admin: ADMIN },
        { steam: "76561198000654321", name: "griefer_99", reason: T("menu.ban.reason1"), until: Date.now() / 1000 + 86400, date: "2026-10-23 18:05", admin: ADMIN }
      ],
      mutes: [],
      gags: []
    },
    recordKind: 0,
    recordPage: 0,
    log: [],
    logPage: 0
  };

  S.target = S.players[1].id;
  function syncSanctions() {
    S.records.mutes = S.players.filter((p) => p.muted).map((p) => ({ steam: p.steam, name: p.name, date: today(-40), admin: ADMIN, player: p.id }));
    S.records.gags = S.players.filter((p) => p.gagged).map((p) => ({ steam: p.steam, name: p.name, date: today(-12), admin: ADMIN, player: p.id }));
  }
  function today(minutes) {
    const d = new Date(Date.now() + minutes * 60000);
    return d.toISOString().slice(0, 16).replace("T", " ");
  }

  function log(action, target, detail, minutesAgo) {
    S.log.push({ time: new Date(Date.now() - (minutesAgo || 0) * 60000), admin: ADMIN, action, target: target || "", detail: detail || "" });
  }
  log("ban", "spinbot", "permanent, Cheating", 1250);
  log("map", "de_mirage", "", 38);
  log("mute", "nightowl", "", 31);
  log("ban", "griefer_99", "1 d, Griefing", 22);
  log("gag", "Mara", "", 12);
  log("setting", "mp_roundtime", "1.92", 9);
  log("slap", "BOT Frank", "5 HP", 4);
  log("hp", "Admin", "150", 3);
  syncSanctions();

  const byPlayer = (id) => S.players.find((p) => p.id === id);
  const teamOf = (p) => (p.team === "t" ? 0 : p.team === "ct" ? 1 : 2);
  const playing = (p) => p.team !== "spec";
  const alive = (p) => playing(p) && p.alive;
  const self = () => S.players.find((p) => p.self);
  const sorted = (team) => S.players.filter((p) => p.team === team).sort((a, b) => b.score - a.score || b.k - a.k);

  // ---- paint ------------------------------------------------------------------------------

  const vars = {};
  const setVar = (name, value) => { vars[name] = value; };
  const flag = (id, cls, on) => byId[id].classList.toggle(cls, !!on);
  const group = (id, classes, index) => classes.forEach((c, i) => byId[id].classList.toggle(c, i === index));
  const armed = (id) => S.armed === id && performance.now() < S.armedUntil;

  function paint() {
    const root = byId["ma-root"];
    setVar("ma_title", T("menu.title"));
    setVar("ma_sub", "Kandru Community · Public #1");
    setVar("ma_nav_h", T("menu.nav"));
    setVar("ma_hint", T("menu.hint"));
    setVar("ma_credit", "made by: kandru.net");
    setVar("ma_sure", T("menu.sure"));
    paintStatus();

    const counts = [N(S.players.length), "", N(MAPS.length), N(S.records.bans.length + S.records.mutes.length + S.records.gags.length), N(S.log.length)];
    ["players", "server", "maps", "records", "log"].forEach((key, t) => {
      setVar("ma_tab" + t, T("menu.tab." + key));
      setVar("ma_tabc" + t, counts[t]);
      flag("ma-tab-" + t, "is-active", S.tab === t);
    });
    group("ma-root", ["view-players", "view-server", "view-maps", "view-records", "view-log"], S.tab);

    paintPlayers();
    paintServer();
    paintMaps();
    paintRecords();
    paintLog();

    for (const b of bindings) {
      const text = b.parts.map((p) => (p.startsWith("{s:") ? vars[p.slice(3, -1)] ?? "" : p)).join("");
      if (b.el.textContent !== text) b.el.textContent = text;
    }
    applyFlow();
    root.classList.remove("is-off");
  }

  function paintStatus() {
    let phase = "phase-live", text = T("menu.phase.live"), time = clock(S.roundLeft);
    if (S.warmup) {
      phase = "phase-warmup"; text = T("menu.phase.warmup");
      time = S.warmupHold || S.warmupExtend > 0 ? T("menu.phase.held") : clock(S.warmupLeft);
    } else if (S.paused && S.freezeLeft > 0) {
      phase = "phase-pause"; text = T("menu.phase.pause"); time = "";
    } else if (S.paused || S.pauseNext) {
      phase = "phase-pause"; text = T("menu.phase.pausenext");
    } else if (S.freezeLeft > 0) {
      phase = "phase-freeze"; text = T("menu.phase.freeze"); time = clock(S.freezeLeft);
    }
    const humans = S.players.filter((p) => !p.bot).length;
    const bots = S.players.length - humans;
    setVar("ma_st_map_h", T("menu.st.map"));
    setVar("ma_st_map", S.map);
    setVar("ma_st_round_h", T("menu.st.round"));
    setVar("ma_st_round", S.warmup ? "-" : N(S.round));
    setVar("ma_st_score_h", T("menu.st.score"));
    setVar("ma_st_t", N(S.score[0]));
    setVar("ma_st_ct", N(S.score[1]));
    setVar("ma_st_phase_h", T("menu.st.phase"));
    setVar("ma_st_phase", text);
    setVar("ma_st_time", time);
    setVar("ma_st_players_h", T("menu.st.players"));
    setVar("ma_st_players", bots > 0 ? fill(T("menu.st.playersbots"), { humans, bots }) : N(humans));
    const phases = ["phase-live", "phase-warmup", "phase-pause", "phase-freeze", "phase-end"];
    group("ma-st-phase", phases, phases.indexOf(phase));
  }

  function paintPlayers() {
    setVar("ma_tag_mute", T("menu.tag.mute"));
    setVar("ma_tag_gag", T("menu.tag.gag"));
    setVar("ma_team_empty", T("menu.team.empty"));
    const teams = [["t", "ma_ht", "ma-tp", "ma-t", "ma_t_page", "ma-t-r", "ma_tr"], ["ct", "ma_hct", "ma-ctp", "ma-ct", "ma_ct_page", "ma-ct-r", "ma_cr"]];
    teams.forEach(([team, head, pager, prefix, pageVar, rowId, rowVar], i) => {
      const list = sorted(team);
      const pages = Math.max(1, Math.ceil(list.length / ROWS));
      const page = S.teamPage[i] = Math.min(S.teamPage[i], pages - 1);
      setVar(head, T("menu.team." + team));
      setVar(head + "_n", N(list.length));
      setVar(pageVar, N(page + 1) + "/" + N(pages));
      flag(pager, "is-off", pages <= 1);
      flag(prefix + "-prev", "is-disabled", page === 0);
      flag(prefix + "-next", "is-disabled", page >= pages - 1);
      flag(prefix + "-empty", "is-off", list.length !== 0);
      for (let r = 0; r < ROWS; r++) {
        const p = list[page * ROWS + r];
        const id = rowId + r;
        if (!p) { flag(id, "is-off", true); continue; }
        setVar(rowVar + r + "_n", p.name);
        setVar(rowVar + r + "_s", N(p.k) + "/" + N(p.d) + "/" + N(p.a));
        setVar(rowVar + r + "_m", p.bot ? T("menu.row.bot") : N(p.ping) + "ms");
        flag(id, "is-active", p.id === S.target);
        flag(id, "is-dead", !p.alive);
        flag(id, "is-muted", p.muted);
        flag(id, "is-gagged", p.gagged);
        flag(id, "is-off", false);
      }
    });

    const specs = sorted("spec");
    setVar("ma_hs", T("menu.team.spec"));
    setVar("ma_hs_n", N(specs.length));
    const more = specs.length > SPEC ? "+" + N(specs.length - SPEC) : "";
    setVar("ma_s_more", more);
    flag("ma-s-more", "is-off", more.length === 0);
    for (let s = 0; s < SPEC; s++) {
      const p = specs[s];
      if (!p) { flag("ma-s-" + s, "is-off", true); continue; }
      setVar("ma_sr" + s + "_n", p.name);
      flag("ma-s-" + s, "is-active", p.id === S.target);
      flag("ma-s-" + s, "is-off", false);
    }

    const target = byPlayer(S.target);
    if (!target) {
      setVar("ma_d_empty", T("menu.detail.empty"));
      flag("ma-detail", "is-ban", false);
      flag("ma-detail", "is-empty", true);
      return;
    }
    paintDetail(target);
  }

  function allowed(target, action) {
    const me = self();
    const isSelf = target.self;
    const other = !isSelf && !target.bot;
    switch (action) {
      case "kick": case "ban": case "mute": case "gag": return other;
      case "rename": return !isSelf;
      case "tot": return target.team !== "t";
      case "toct": return target.team !== "ct";
      case "tospec": return target.team !== "spec";
      case "fswitch": return playing(target);
      case "respawn": return playing(target) && !target.alive;
      case "bring": case "goto": return !isSelf && alive(target) && alive(me);
      default: return alive(target); // kill, slap, freeze, noclip, god, strip
    }
  }

  function actionLabel(target, action) {
    if (action === "mute" && target.muted) return T("menu.act.unmute");
    if (action === "gag" && target.gagged) return T("menu.act.ungag");
    if (action === "freeze" && alive(target) && target.frozen) return T("menu.act.unfreeze");
    if (action === "noclip" && alive(target) && target.noclip) return T("menu.act.noclipoff");
    if (action === "god" && alive(target) && target.god) return T("menu.act.godoff");
    return T("menu.act." + action);
  }

  function paintDetail(p) {
    const team = teamOf(p);
    let sub = (p.bot ? T("menu.row.bot") : p.steam) + " · " + T("menu.team." + ["t", "ct", "spec"][team]);
    if (p.muted) sub += " · " + T("menu.tag.mute");
    if (p.gagged) sub += " · " + T("menu.tag.gag");
    setVar("ma_d_name", p.name);
    setVar("ma_d_sub", sub);
    group("ma-detail", ["team-t", "team-ct", "team-spec"], team);

    const values = [
      alive(p) ? N(p.hp) : "-", alive(p) ? N(p.armor) : "-", playing(p) ? "$" + N(p.money) : "-",
      N(p.k) + "/" + N(p.d) + "/" + N(p.a), N(p.damage),
      p.k > 0 ? N(p.hs) + " (" + N(Math.floor(p.hs * 100 / p.k)) + "%)" : N(p.hs),
      N(p.mvp), N(p.score), p.bot ? "-" : N(p.ping) + "ms", p.online < 0 ? "-" : clock(p.online)
    ];
    STAT_KEYS.forEach((key, k) => { setVar("ma_dl" + k, T("menu.stat." + key)); setVar("ma_dv" + k, values[k]); });
    DPAGES.forEach((key, i) => { setVar("ma_dt" + i, T("menu.dpage." + key)); flag("ma-dt-" + i, "is-active", S.dpage === i); });
    group("ma-detail", ["dpage-mod", "dpage-team", "dpage-player", "dpage-items"], S.dpage);

    for (const action of ACTIONS) {
      const id = "ma-a-" + action;
      setVar("ma_a_" + action, actionLabel(p, action));
      flag(id, "is-disabled", !allowed(p, action));
      if (CONFIRM_ACTIONS.includes(action)) flag(id, "is-confirm", armed(id));
    }

    ["hp", "armor", "money"].forEach((key, v) => {
      const can = key === "money" ? playing(p) : alive(p);
      const current = key === "hp" ? p.hp : key === "armor" ? p.armor : p.money;
      setVar("ma_ps_" + key, T("menu.ps." + key));
      setVar("ma_ps_" + key + "_v", can ? (key === "money" ? "$" : "") + N(current) : "-");
      flag("ma-ps-" + key + "-dec", "is-disabled", !can || current <= VALUE_STEPS[v][1]);
      flag("ma-ps-" + key + "-inc", "is-disabled", !can || current >= VALUE_STEPS[v][2]);
    });

    ITEMS.forEach(([, label], g) => {
      setVar("ma_g" + g, label);
      flag("ma-g-" + g, "is-disabled", !alive(p));
      flag("ma-g-" + g, "is-off", false);
    });

    setVar("ma_bp_h", fill(T("menu.ban.head"), { player: p.name }));
    setVar("ma_bp_dh", T("menu.ban.duration"));
    setVar("ma_bp_rh", T("menu.ban.reason"));
    setVar("ma_br_cancel", T("menu.ban.cancel"));
    DURATIONS.forEach((m, i) => { setVar("ma_bd" + i, durationText(m)); flag("ma-bd-" + i, "is-active", S.banDuration === i); });
    for (let r = 0; r < 4; r++) setVar("ma_br" + r, T("menu.ban.reason" + r));
    flag("ma-detail", "is-ban", S.banPick);
    flag("ma-detail", "is-empty", false);
  }

  function serverAllowed(key) {
    switch (key) {
      case "rr": case "wustart": return !S.warmup;
      case "pause": case "tmt": case "tmct": return !S.warmup;
      case "wuend": case "wuext": return S.warmup;
      case "botkick": return S.players.some((p) => p.bot);
      default: return true;
    }
  }

  function settingText(key, value) {
    switch (key) {
      case "roundtime": return clock(value * 60);
      case "freezetime": return N(Math.trunc(value)) + " s";
      case "maxrounds": return value <= 0 ? "∞" : N(Math.trunc(value));
      case "teamlimit": return value <= 0 ? T("menu.off") : N(Math.trunc(value));
      default: return N(Math.trunc(value));
    }
  }

  function paintServer() {
    SERVER_HEADS.forEach((key, h) => {
      setVar("ma_sv_h" + h, T("menu.sv.head." + key));
      setVar("ma_sv_n" + h, T("menu.sv.hint." + key));
    });
    if (S.warmupExtend > 0) setVar("ma_sv_n1", fill(T("menu.sv.hint.extended"), { time: clock(S.warmupExtend) }));
    for (const key of SERVER) {
      const id = "ma-sv-" + key;
      setVar("ma_sv_" + key, key === "pause" && (S.paused || S.pauseNext) ? T("menu.sv.unpause") : T("menu.sv." + key));
      flag(id, "is-disabled", !serverAllowed(key));
      if (CONFIRM_SERVER.includes(key)) flag(id, "is-confirm", armed(id));
    }
    for (const key of SWITCHES) {
      const on = key === "wuhold" ? S.warmupHold : S.rules[key];
      setVar("ma_sw_" + key, T("menu.sw." + key));
      setVar("ma_sw_" + key + "_st", T(on ? "menu.on" : "menu.off"));
      flag("ma-sw-" + key, "is-on", on);
      flag("ma-sw-" + key, "is-disabled", key === "wuhold" && !S.warmup);
    }
    SETTINGS.forEach((key, s) => {
      const value = S.settings[key];
      setVar("ma_sp_" + key, T("menu.sp." + key));
      setVar("ma_sp_" + key + "_v", settingText(key, value));
      flag("ma-sp-" + key + "-dec", "is-disabled", value <= SETTING_STEPS[s][1]);
      flag("ma-sp-" + key + "-inc", "is-disabled", value >= SETTING_STEPS[s][2]);
    });
  }

  function paintMaps() {
    const pages = Math.max(1, Math.ceil(MAPS.length / MAP_TILES));
    const page = S.mapPage = Math.min(S.mapPage, pages - 1);
    setVar("ma_mp_h", T("menu.map.head"));
    setVar("ma_mp_empty", T("menu.map.empty"));
    setVar("ma_mp_hint", T("menu.map.hint"));
    setVar("ma_mp_page", N(page + 1) + " / " + N(pages));
    flag("ma-mp-prev", "is-disabled", page === 0);
    flag("ma-mp-next", "is-disabled", page >= pages - 1);
    flag("ma-mp-empty", "is-off", MAPS.length !== 0);
    for (let m = 0; m < MAP_TILES; m++) {
      const map = MAPS[page * MAP_TILES + m];
      const id = "ma-mp-" + m;
      if (!map) { flag(id, "is-off", true); continue; }
      const current = map === S.map;
      setVar("ma_mp" + m, map);
      setVar("ma_mp" + m + "_s", current ? T("menu.map.current") : T("menu.map.official"));
      flag(id, "is-active", current);
      flag(id, "is-confirm", armed(id));
      flag(id, "is-disabled", false);
      flag(id, "is-off", false);
    }
  }

  function paintRecords() {
    RECORD_KINDS.forEach((key, k) => { setVar("ma_rf" + k, T("menu.rec." + key)); flag("ma-rf-" + k, "is-active", S.recordKind === k); });
    const kind = RECORD_KINDS[S.recordKind];
    const list = S.records[kind];
    const pages = Math.max(1, Math.ceil(list.length / RECORDS));
    const page = S.recordPage = Math.min(S.recordPage, pages - 1);
    setVar("ma_rc_empty", T("menu.rec." + kind + ".empty"));
    setVar("ma_rc_un", T("menu.rec." + kind + ".button"));
    setVar("ma_rc_page", N(page + 1) + " / " + N(pages));
    flag("ma-rc-prev", "is-disabled", page === 0);
    flag("ma-rc-next", "is-disabled", page >= pages - 1);
    flag("ma-rc-empty", "is-off", list.length !== 0);
    const now = Date.now() / 1000;
    for (let r = 0; r < RECORDS; r++) {
      const rec = list[page * RECORDS + r];
      if (!rec) { flag("ma-rc-" + r, "is-off", true); continue; }
      const meta = [rec.steam];
      if (kind === "bans") {
        if (rec.reason) meta.push(rec.reason);
        meta.push(rec.until <= 0 ? T("menu.dur.perm")
          : rec.until <= now ? T("menu.rec.expired")
          : fill(T("menu.rec.until"), { date: new Date(rec.until * 1000).toISOString().slice(0, 16).replace("T", " ") + " UTC" }));
      }
      if (rec.date) meta.push(rec.date + " UTC");
      if (rec.admin) meta.push(fill(T("menu.rec.by"), { admin: rec.admin }));
      setVar("ma_rc" + r + "_i", String(page * RECORDS + r + 1).padStart(2, "0"));
      setVar("ma_rc" + r + "_n", rec.name);
      setVar("ma_rc" + r + "_m", meta.join(" · "));
      flag("ma-rc-un-" + r, "is-confirm", armed("ma-rc-un-" + r));
      flag("ma-rc-un-" + r, "is-disabled", false);
      flag("ma-rc-" + r, "is-off", false);
    }
  }

  function paintLog() {
    const pages = Math.max(1, Math.ceil(S.log.length / LOG_ROWS));
    const page = S.logPage = Math.min(S.logPage, pages - 1);
    setVar("ma_lg_h", T("menu.log.head"));
    setVar("ma_lg_empty", T("menu.log.empty"));
    setVar("ma_lg_page", N(page + 1) + " / " + N(pages));
    flag("ma-lg-prev", "is-disabled", page === 0);
    flag("ma-lg-next", "is-disabled", page >= pages - 1);
    flag("ma-lg-empty", "is-off", S.log.length !== 0);
    const day = new Date().toDateString();
    for (let r = 0; r < LOG_ROWS; r++) {
      const entry = S.log[S.log.length - 1 - (page * LOG_ROWS + r)];
      if (!entry) { flag("ma-lg-" + r, "is-off", true); continue; }
      const t = entry.time;
      const two = (n) => String(n).padStart(2, "0");
      const time = t.toDateString() === day
        ? two(t.getHours()) + ":" + two(t.getMinutes()) + ":" + two(t.getSeconds())
        : two(t.getMonth() + 1) + "-" + two(t.getDate()) + " " + two(t.getHours()) + ":" + two(t.getMinutes());
      const text = fill(T("log.format"), {
        admin: entry.admin, action: T("log.action." + entry.action), target: entry.target,
        detail: entry.detail ? "(" + entry.detail + ")" : ""
      }).split(" ").filter(Boolean).join(" ");
      setVar("ma_lg" + r + "_t", time);
      setVar("ma_lg" + r + "_x", text);
      flag("ma-lg-" + r, "is-danger", DANGER.includes(entry.action));
      flag("ma-lg-" + r, "is-off", false);
    }
  }

  // panorama flow-children lives on the parent; the children's alignment rules need it as an attribute
  function applyFlow() {
    for (const el of document.querySelectorAll("p-panel, p-button")) {
      const flow = getComputedStyle(el).getPropertyValue("--flow").trim() || "grid";
      if (el.dataset.flow !== flow) el.dataset.flow = flow;
    }
  }

  // ---- clicks (what AdminMenu.OnClick does) -----------------------------------------------

  // destructive buttons run on the second click within 3 s
  function confirm(id) {
    if (armed(id)) { S.armed = null; return true; }
    S.armed = id;
    S.armedUntil = performance.now() + 3000;
    return false;
  }

  function click(id) {
    const el = byId[id];
    if (!el || el.classList.contains("is-disabled")) return;
    let m;
    if (id === "ma-close") return close();
    if ((m = /^ma-tab-(\d)$/.exec(id))) { S.tab = +m[1]; S.armed = null; return; }
    if ((m = /^ma-(t|ct)-r(\d+)$/.exec(id))) { const i = m[1] === "t" ? 0 : 1; return pick(sorted(m[1])[S.teamPage[i] * ROWS + +m[2]]); }
    if ((m = /^ma-(t|ct)-(prev|next)$/.exec(id))) { const i = m[1] === "t" ? 0 : 1; S.teamPage[i] += m[2] === "next" ? 1 : -1; return; }
    if ((m = /^ma-s-(\d)$/.exec(id))) return pick(sorted("spec")[+m[1]]);
    if ((m = /^ma-dt-(\d)$/.exec(id))) { S.dpage = +m[1]; S.banPick = false; return; }
    if ((m = /^ma-a-(\w+)$/.exec(id))) return playerAction(m[1], id);
    if ((m = /^ma-ps-(hp|armor|money)-(dec|inc)$/.exec(id))) return stepValue(m[1], m[2] === "inc" ? 1 : -1);
    if ((m = /^ma-g-(\d+)$/.exec(id))) { const p = byPlayer(S.target); log("give", p.name, ITEMS[+m[1]][0]); return; }
    if ((m = /^ma-bd-(\d)$/.exec(id))) { S.banDuration = +m[1]; return; }
    if (id === "ma-br-cancel") { S.banPick = false; return; }
    if ((m = /^ma-br-(\d)$/.exec(id))) return ban(+m[1]);
    if ((m = /^ma-sv-(\w+)$/.exec(id))) return serverAction(m[1], id);
    if ((m = /^ma-sw-(\w+)$/.exec(id))) return toggleRule(m[1]);
    if ((m = /^ma-sp-(\w+)-(dec|inc)$/.exec(id))) return stepSetting(m[1], m[2] === "inc" ? 1 : -1);
    if ((m = /^ma-mp-(\d+)$/.exec(id))) return changeMap(MAPS[S.mapPage * MAP_TILES + +m[1]], id);
    if ((m = /^ma-mp-(prev|next)$/.exec(id))) { S.mapPage += m[1] === "next" ? 1 : -1; return; }
    if ((m = /^ma-rf-(\d)$/.exec(id))) { S.recordKind = +m[1]; S.recordPage = 0; return; }
    if ((m = /^ma-rc-(prev|next)$/.exec(id))) { S.recordPage += m[1] === "next" ? 1 : -1; return; }
    if ((m = /^ma-rc-un-(\d)$/.exec(id))) return undoRecord(+m[1], id);
    if ((m = /^ma-lg-(prev|next)$/.exec(id))) { S.logPage += m[1] === "next" ? 1 : -1; return; }
  }

  function pick(p) {
    if (!p) return;
    S.target = p.id === S.target ? 0 : p.id;
    S.banPick = false;
    S.armed = null;
  }

  function playerAction(action, id) {
    const p = byPlayer(S.target);
    if (!p) return;
    if (CONFIRM_ACTIONS.includes(action) && !confirm(id)) return;
    switch (action) {
      case "kick": remove(p); log("kick", p.name); break;
      case "ban": S.banPick = true; break;
      case "mute": p.muted = !p.muted; log(p.muted ? "mute" : "unmute", p.name); syncSanctions(); break;
      case "gag": p.gagged = !p.gagged; log(p.gagged ? "gag" : "ungag", p.name); syncSanctions(); break;
      case "rename": { const old = p.name; p.name = fill(T("menu.rename.default"), { id: p.id }); log("rename", old, p.name); break; }
      case "tot": case "toct": case "tospec": p.team = action.slice(2); p.alive = false; log("switch", p.name, p.team.toUpperCase()); break;
      case "fswitch": p.team = p.team === "t" ? "ct" : "t"; log("fswitch", p.name, p.team.toUpperCase()); break;
      case "respawn": Object.assign(p, { alive: true, hp: 100, armor: 0 }); log("respawn", p.name); break;
      case "kill": p.alive = false; p.d++; log("kill", p.name); break;
      case "slap": p.hp = Math.max(1, p.hp - 5); log("slap", p.name, "5 HP"); break;
      case "freeze": p.frozen = !p.frozen; log(p.frozen ? "freeze" : "unfreeze", p.name); break;
      case "noclip": p.noclip = !p.noclip; log("noclip", p.name, T(p.noclip ? "menu.on" : "menu.off")); break;
      case "god": p.god = !p.god; log("god", p.name, T(p.god ? "menu.on" : "menu.off")); break;
      case "bring": case "goto": log(action, p.name); break;
      case "strip": log("strip", p.name); break;
    }
  }

  function remove(p) {
    S.players = S.players.filter((x) => x !== p);
    S.target = 0;
    syncSanctions();
  }

  function stepValue(key, dir) {
    const p = byPlayer(S.target);
    const v = ["hp", "armor", "money"].indexOf(key);
    const [step, min, max] = VALUE_STEPS[v];
    const field = key === "hp" ? "hp" : key === "armor" ? "armor" : "money";
    p[field] = Math.min(max, Math.max(min, (Math.round(p[field] / step) + dir) * step));
    log(key, p.name, N(p[field]));
  }

  function ban(reason) {
    const p = byPlayer(S.target);
    const minutes = DURATIONS[S.banDuration];
    const now = Date.now() / 1000;
    S.records.bans.push({ steam: p.steam, name: p.name, reason: T("menu.ban.reason" + reason), until: minutes > 0 ? now + minutes * 60 : 0, date: today(0), admin: ADMIN });
    log("ban", p.name, durationText(minutes) + ", " + T("menu.ban.reason" + reason));
    S.banPick = false;
    remove(p);
  }

  function serverAction(key, id) {
    if (CONFIRM_SERVER.includes(key) && !confirm(id)) return;
    switch (key) {
      case "rr": S.roundLeft = S.settings.roundtime * 60; S.freezeLeft = S.settings.freezetime; log("rr"); break;
      case "mr": Object.assign(S, { round: 1, score: [0, 0], roundLeft: S.settings.roundtime * 60, freezeLeft: S.settings.freezetime }); log("restart"); break;
      case "pause":
        if (S.paused || S.pauseNext) { S.paused = S.pauseNext = false; log("unpause"); }
        else { S.pauseNext = true; log("pause"); }
        break;
      case "tmt": case "tmct": S.pauseNext = true; log("timeout", key === "tmt" ? "T" : "CT"); break;
      case "wustart": Object.assign(S, { warmup: true, warmupLeft: 60, warmupHold: false, warmupExtend: 0, paused: false, pauseNext: false }); log("warmup", "", "start"); break;
      case "wuend": Object.assign(S, { warmup: false, warmupHold: false, warmupExtend: 0, round: 1, score: [0, 0], roundLeft: S.settings.roundtime * 60, freezeLeft: S.settings.freezetime }); log("warmup", "", "end"); break;
      case "wuext": S.warmupExtend = Math.min(3600, S.warmupExtend + 60); log("warmup", "", "+60 s"); break;
      case "swap":
        S.players.forEach((p) => { if (p.team !== "spec") p.team = p.team === "t" ? "ct" : "t"; });
        S.score = [S.score[1], S.score[0]];
        log("swap");
        break;
      case "scramble": {
        const list = S.players.filter(playing).sort(() => Math.random() - 0.5);
        list.forEach((p, i) => { p.team = i % 2 ? "ct" : "t"; });
        log("scramble");
        break;
      }
      case "bott": case "botct": {
        const names = ["Albert", "Dennis", "Hugo", "Ivan", "Jens", "Otto", "Quinn", "Rex", "Sven", "Vince"];
        const used = new Set(S.players.map((p) => p.name));
        const name = "BOT " + (names.find((n) => !used.has("BOT " + n)) || "Extra" + nextId);
        S.players.push(player(name, key === "bott" ? "t" : "ct", 0, 0, 0));
        log("bot", "", key === "bott" ? "+T" : "+CT");
        break;
      }
      case "botkick":
        if (S.players.some((p) => p.bot && p.id === S.target)) S.target = 0;
        S.players = S.players.filter((p) => !p.bot);
        log("bot", "", "kick");
        break;
    }
  }

  function toggleRule(key) {
    if (key === "wuhold") { S.warmupHold = !S.warmupHold; log("warmup", "", S.warmupHold ? "hold" : "resume"); return; }
    S.rules[key] = !S.rules[key];
    log("rule", T("menu.sw." + key), T(S.rules[key] ? "menu.on" : "menu.off"));
  }

  function stepSetting(key, dir) {
    const s = SETTINGS.indexOf(key);
    const [step, min, max] = SETTING_STEPS[s];
    const next = Math.min(max, Math.max(min, (Math.round(S.settings[key] / step) + dir) * step));
    if (next === S.settings[key]) return;
    S.settings[key] = next;
    const cvar = ["mp_roundtime", "mp_freezetime", "mp_maxrounds", "sv_gravity", "mp_limitteams"][s];
    log("setting", cvar, key === "roundtime" ? String(+next.toFixed(2)) : N(next));
  }

  function changeMap(map, id) {
    if (!map || map === S.map || !confirm(id)) return;
    Object.assign(S, { map, round: 1, score: [0, 0], warmup: true, warmupLeft: 60, warmupHold: false, warmupExtend: 0, paused: false, pauseNext: false });
    S.players.forEach((p) => { if (playing(p)) p.alive = true; });
    log("map", map);
  }

  function undoRecord(r, id) {
    if (!confirm(id)) return;
    const kind = RECORD_KINDS[S.recordKind];
    const rec = S.records[kind][S.recordPage * RECORDS + r];
    if (!rec) return;
    if (kind === "bans") { S.records.bans.splice(S.records.bans.indexOf(rec), 1); log("unban", rec.name); return; }
    const p = byPlayer(rec.player);
    if (p && kind === "mutes") { p.muted = false; log("unmute", p.name); }
    if (p && kind === "gags") { p.gagged = false; log("ungag", p.name); }
    syncSanctions();
  }

  // ---- open / close, clock ----------------------------------------------------------------

  function close() {
    const root = byId["ma-root"];
    root.classList.add("is-fading");
    S.open = false;
    document.body.classList.add("pv-closed");
    setTimeout(() => { if (!S.open) root.classList.add("is-off"); }, 200);
  }

  function open() {
    const root = byId["ma-root"];
    S.open = true;
    document.body.classList.remove("pv-closed");
    root.classList.add("is-fading");
    paint();
    // let the faded state render first, then fade in (a timer also runs in background tabs)
    setTimeout(() => root.classList.remove("is-fading"), 30);
  }

  function tick() {
    if (S.warmup) {
      if (S.warmupExtend > 0) S.warmupExtend = Math.max(0, S.warmupExtend - 1);
      else if (!S.warmupHold && --S.warmupLeft <= 0) {
        Object.assign(S, { warmup: false, round: 1, score: [0, 0], roundLeft: S.settings.roundtime * 60, freezeLeft: S.settings.freezetime });
      }
    } else if (S.freezeLeft > 0) {
      if (S.pauseNext) { S.paused = true; S.pauseNext = false; }
      if (!S.paused) S.freezeLeft--;
    } else if (!S.paused) {
      if (--S.roundLeft <= 0) {
        S.score[S.round % 2]++;
        S.round++;
        S.roundLeft = S.settings.roundtime * 60;
        S.freezeLeft = S.settings.freezetime;
        S.players.forEach((p) => { if (playing(p)) Object.assign(p, { alive: true, hp: 100 }); });
      }
    }
    S.players.forEach((p) => { if (p.online >= 0) p.online++; });
    if (S.open) paint();
  }

  // ---- page -------------------------------------------------------------------------------

  function fit() {
    const viewport = document.querySelector(".pv-viewport");
    const stage = document.querySelector(".pv-stage");
    // #shot: 1:1 around the card, for screenshots
    const scale = document.body.classList.contains("pv-shot") ? 1 : Math.min(viewport.clientWidth / 1920, viewport.clientHeight / 1080);
    stage.style.transform = `translate(${(viewport.clientWidth - 1920 * scale) / 2}px, ${(viewport.clientHeight - 1080 * scale) / 2}px) scale(${scale})`;
  }

  function start() {
    const style = document.createElement("style");
    style.textContent = translate(DATA.vcss);
    document.head.appendChild(style);

    const xml = new DOMParser().parseFromString(DATA.xml, "application/xml");
    const screen = xml.querySelector("root > Panel");
    document.querySelector(".pv-stage").appendChild(build(screen));

    document.querySelector(".pv-stage").addEventListener("click", (e) => {
      const button = e.target.closest("p-button");
      if (!button || !S.open) return;
      click(button.id);
      paint();
    });
    document.getElementById("pv-lang").addEventListener("change", (e) => { lang = e.target.value; paint(); });
    document.getElementById("pv-reopen").addEventListener("click", open);
    window.addEventListener("resize", fit);
    window.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.open) close(); });

    // deep links for screenshots: #tab=1&player=Mara&page=2&ban=1&lang=de
    const q = new URLSearchParams(location.hash.slice(1));
    if (q.has("shot")) document.body.classList.add("pv-shot");
    if (q.has("lang")) { lang = q.get("lang") === "de" ? "de" : "en"; document.getElementById("pv-lang").value = lang; }
    if (q.has("tab")) S.tab = Math.min(4, Math.max(0, +q.get("tab") || 0));
    if (q.has("player")) { const p = S.players.find((x) => x.name === q.get("player")); S.target = p ? p.id : 0; }
    if (q.has("page")) S.dpage = Math.min(3, Math.max(0, +q.get("page") || 0));
    if (q.has("ban")) S.banPick = true;
    if (q.has("records")) S.recordKind = Math.min(2, Math.max(0, +q.get("records") || 0));
    if (q.has("warmup")) Object.assign(S, { warmup: true, warmupLeft: 47 });

    fit();
    paint();
    setInterval(tick, 1000);
  }

  start();
})();
