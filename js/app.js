/*!
 * Pissarra — app.js
 * Lògica de l'aplicació: eines, selecció, transformacions, text, historial,
 * desament automàtic, porta-retalls, importació i exportació.
 */
(function () {
  'use strict';

  const R = window.PissarraRender;
  const SK = window.PissarraSketch;

  /* =========================================================
   * Utilitats i constants
   * ========================================================= */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const randSeed = () => Math.floor(Math.random() * 2147483647);
  const round2 = (v) => Math.round(v * 100) / 100;
  const TAU = Math.PI * 2;
  /** Gira el punt (x, y) un angle a (radians) al voltant de (cx, cy). */
  const rotPt = (x, y, cx, cy, a) => {
    const c = Math.cos(a), s = Math.sin(a), dx = x - cx, dy = y - cy;
    return [cx + dx * c - dy * s, cy + dx * s + dy * c];
  };
  /** Angle normalitzat a [0, 2π), amb els valors gairebé nuls arrodonits a 0. */
  function normAngle(a) {
    a = ((a % TAU) + TAU) % TAU;
    return a < 1e-6 || TAU - a < 1e-6 ? 0 : a;
  }

  const STORAGE_KEY = 'pissarra:v1';
  const GRID = 20;
  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 30;
  const LH = R.LH;
  const TYPES = ['rectangle', 'ellipse', 'diamond', 'line', 'arrow', 'freedraw', 'text', 'image'];
  const SHAPES = new Set(['rectangle', 'ellipse', 'diamond']);
  const LINEAR = new Set(['line', 'arrow']);
  const CREATE_TOOLS = new Set(['rectangle', 'ellipse', 'diamond', 'line', 'arrow', 'freedraw', 'text']);

  /** A quins tipus d'element s'aplica cada propietat. */
  const PROP_TYPES = {
    stroke: ['rectangle', 'ellipse', 'diamond', 'line', 'arrow', 'freedraw', 'text'],
    fill: ['rectangle', 'ellipse', 'diamond'],
    fillStyle: ['rectangle', 'ellipse', 'diamond'],
    strokeWidth: ['rectangle', 'ellipse', 'diamond', 'line', 'arrow', 'freedraw'],
    strokeStyle: ['rectangle', 'ellipse', 'diamond', 'line', 'arrow'],
    roughness: ['rectangle', 'ellipse', 'diamond', 'line', 'arrow'],
    roundness: ['rectangle'],
    arrowheads: ['line', 'arrow'],
    fontSize: ['text'],
    fontFamily: ['text'],
    textAlign: ['text'],
    opacity: TYPES,
  };
  const appliesTo = (key, type) => (PROP_TYPES[key] || []).includes(type);

  const BUCKET_CURSOR = 'url("data:image/svg+xml,' + encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M11 3l9 9-6.3 6.3a2 2 0 0 1-2.8 0L6 13.4a2 2 0 0 1 0-2.8z M6 11.5h13.5 M3.3 14.5s-1.8 2.4-1.8 3.6a1.8 1.8 0 0 0 3.6 0c0-1.2-1.8-3.6-1.8-3.6z\" stroke=\"white\" stroke-width=\"3.6\"/><path d=\"M11 3l9 9-6.3 6.3a2 2 0 0 1-2.8 0L6 13.4a2 2 0 0 1 0-2.8z M6 11.5h13.5 M3.3 14.5s-1.8 2.4-1.8 3.6a1.8 1.8 0 0 0 3.6 0c0-1.2-1.8-3.6-1.8-3.6z\" stroke=\"black\" stroke-width=\"1.5\"/></g></svg>") + '") 3 21, crosshair';
  const EYEDROP_CURSOR = 'url("data:image/svg+xml,' + encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14.5 6.5l3 3M12.5 8.5l-8 8V19.5h3l8-8M15.5 5.5l1.6-1.6a2.1 2.1 0 0 1 3 3l-1.6 1.6z\" stroke=\"white\" stroke-width=\"3.6\"/><path d=\"M14.5 6.5l3 3M12.5 8.5l-8 8V19.5h3l8-8\" stroke=\"black\" stroke-width=\"1.5\"/><path d=\"M15.5 5.5l1.6-1.6a2.1 2.1 0 0 1 3 3l-1.6 1.6z\" fill=\"black\" stroke=\"black\" stroke-width=\"1.2\"/></g></svg>") + '") 4 20, crosshair';
  const RESIZE_CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];
  const HANDLE_DIR = { e: 0, se: 45, s: 90, sw: 135, w: 180, nw: 225, n: 270, ne: 315 };
  const ROTATE_CURSOR =
    'url("data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M18.5 12a6.5 6.5 0 1 1-1.9-4.6M17 3.8v4h-4" stroke="white" stroke-width="4"/>' +
      '<path d="M18.5 12a6.5 6.5 0 1 1-1.9-4.6M17 3.8v4h-4" stroke="black" stroke-width="1.6"/></g></svg>'
    ) +
    '") 12 12, grab';
  const ERASER_CURSOR =
    'url("data:image/svg+xml,' +
    encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="7" fill="white" fill-opacity="0.6" stroke="black" stroke-width="1.5"/></svg>') +
    '") 10 10, crosshair';

  /* =========================================================
   * Estat
   * ========================================================= */
  const S = {
    elements: [],
    selected: new Set(),
    tool: 'selection',
    editingGroup: null, // grup dins del qual s'està editant (doble clic sobre un grup)
    locked: false,
    theme: 'dark',
    grid: false,
    nudge: 1, // píxels que es mou la selecció amb les fletxes
    background: null, // color de fons de la pissarra (null: el del tema)
    recentColors: [], // últims colors triats amb el selector
    bgImage: null, // imatge de fons de la pissarra: { fileId, mode, opacity, w, h }
    view: { x: 0, y: 0, zoom: 1 },
    style: {
      stroke: '#1e1e1e', fill: 'transparent', fillStyle: 'hachure', strokeWidth: 2,
      strokeStyle: 'solid', roughness: 1, opacity: 100, roundness: 'round',
      arrowheads: 'end', fontSize: 20, fontFamily: 'hand', textAlign: 'left',
      lastStroke: '#1e1e1e',
      bucketTarget: 'fill', // el pot de pintura pinta el fons ('fill') o el traç ('stroke')
    },
  };
  /** Imatges inserides: id → dataURL (separades dels elements per alleugerir l'historial). */
  const files = Object.create(null);

  const app = $('#app');
  const canvas = $('#canvas');
  const ctx = canvas.getContext('2d');
  const ta = $('#text-editor');
  const toolbar = $('#toolbar');
  const propsEl = $('#props');
  const menu = $('#menu');
  const menuBtn = $('#menu-btn');
  let W = 0, H = 0, DPR = 1;

  const bump = (el) => { el.version = (el.version || 0) + 1; };
  const byId = (id) => S.elements.find((e) => e.id === id);
  const selectedEls = () => S.elements.filter((e) => S.selected.has(e.id));
  const stripPrivate = (k, v) => (k.charAt(0) === '_' ? undefined : v);
  const cloneEl = (el) => JSON.parse(JSON.stringify(el, stripPrivate));
  const serialize = (els) => JSON.parse(JSON.stringify(els, stripPrivate));
  const alignFactor = (a) => (a === 'center' ? 0.5 : a === 'right' ? 1 : 0);

  function newElement(type, x, y, extra) {
    const st = S.style;
    const el = {
      id: uid(), type, x, y, w: 0, h: 0, seed: randSeed(), version: 1,
      // El traç transparent només s'aplica a les formes; la resta faria servir l'últim color visible
      stroke: st.stroke === 'transparent' && !SHAPES.has(type) ? st.lastStroke || '#1e1e1e' : st.stroke, fill: st.fill, fillStyle: st.fillStyle, strokeWidth: st.strokeWidth,
      strokeStyle: st.strokeStyle, roughness: st.roughness, opacity: st.opacity, roundness: st.roundness,
      groupIds: currentGroupPath(),
    };
    if (type === 'text') Object.assign(el, { text: '', fontSize: st.fontSize, fontFamily: st.fontFamily, textAlign: st.textAlign });
    return Object.assign(el, extra || {});
  }

  function measureTextEl(el) {
    const m = R.measureText(el.text || '', el.fontSize, el.fontFamily);
    el.w = m.w;
    el.h = m.h;
  }

  function isValidElement(el) {
    if (!el || typeof el !== 'object' || !TYPES.includes(el.type)) return false;
    if (!isFinite(el.x) || !isFinite(el.y)) return false;
    if ((LINEAR.has(el.type) || el.type === 'freedraw') && !(Array.isArray(el.points) && el.points.length)) return false;
    return true;
  }

  /** Les línies i el llapis no guarden angle: el gir s'aplica directament als punts. */
  function bakeAngle(el) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const p of el.points) {
      x1 = Math.min(x1, p[0]); y1 = Math.min(y1, p[1]);
      x2 = Math.max(x2, p[0]); y2 = Math.max(y2, p[1]);
    }
    const cx = el.x + (x1 + x2) / 2, cy = el.y + (y1 + y2) / 2;
    const wp = el.points.map((p) => rotPt(el.x + p[0], el.y + p[1], cx, cy, el.angle));
    el.angle = 0;
    el.x = wp[0][0];
    el.y = wp[0][1];
    el.points = wp.map((q) => [round2(q[0] - el.x), round2(q[1] - el.y)]);
  }

  /** Completa els camps que faltin (fitxers antics o importats). */
  function normalizeElement(el) {
    const out = Object.assign({
      id: uid(), seed: randSeed(), version: 1, w: 0, h: 0,
      stroke: '#1e1e1e', fill: 'transparent', fillStyle: 'hachure', strokeWidth: 2,
      strokeStyle: 'solid', roughness: 1, opacity: 100, roundness: 'sharp',
    }, el);
    delete out._c;
    delete out._editing;
    out.x = +out.x; out.y = +out.y; out.w = +out.w || 0; out.h = +out.h || 0;
    if (out.type === 'text') {
      out.text = String(out.text == null ? '' : out.text);
      out.fontSize = clamp(+out.fontSize || 20, 4, 1000);
      if (!R.FONTS[out.fontFamily]) out.fontFamily = 'hand';
      if (!['left', 'center', 'right'].includes(out.textAlign)) out.textAlign = 'left';
      measureTextEl(out);
    }
    if (LINEAR.has(out.type) || out.type === 'freedraw') {
      out.points = out.points.filter((p) => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1])).map((p) => [+p[0], +p[1]]);
      if (LINEAR.has(out.type) && out.points.length < 2) out.points.push([out.points[0][0] + 1, out.points[0][1]]);
    }
    out.angle = normAngle(+out.angle || 0);
    out.groupIds = Array.isArray(out.groupIds) ? out.groupIds.filter((g) => typeof g === 'string' && g) : [];
    if ((LINEAR.has(out.type) || out.type === 'freedraw') && out.angle) bakeAngle(out);
    if (out.type === 'image') { out.flipX = !!out.flipX; out.flipY = !!out.flipY; }
    if (out.stroke === 'transparent' && !SHAPES.has(out.type)) out.stroke = '#1e1e1e';
    else { delete out.flipX; delete out.flipY; }
    for (const k of ['startBinding', 'endBinding']) {
      const b = out[k];
      if (LINEAR.has(out.type) && b && typeof b.id === 'string' && isFinite(b.fx) && isFinite(b.fy)) {
        out[k] = { id: b.id, fx: clamp(+b.fx, 0, 1), fy: clamp(+b.fy, 0, 1) };
      } else delete out[k];
    }
    if (LINEAR.has(out.type) && !out.arrowheads) out.arrowheads = out.type === 'arrow' ? 'end' : 'none';
    return out;
  }

  /* =========================================================
   * Emmagatzematge local (desament automàtic)
   * ========================================================= */
  const storage = {
    get() { try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(STORAGE_KEY, v); return true; } catch (e) { return false; } },
  };

  function usedFiles(els) {
    const out = {};
    for (const el of els) if (el.type === 'image' && files[el.fileId]) out[el.fileId] = files[el.fileId];
    return out;
  }

  let saveTimer = 0;
  let warnedQuota = false;
  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 350);
  }
  function saveNow() {
    const data = {
      v: 1,
      elements: serialize(S.elements),
      files: sceneFiles(),
      app: { theme: S.theme, grid: S.grid, view: S.view, style: S.style, locked: S.locked, nudge: S.nudge, background: S.background, recentColors: S.recentColors, bgImage: S.bgImage },
    };
    if (storage.set(JSON.stringify(data))) return;
    // Si no hi cap (imatges grans), es desa almenys el dibuix sense imatges
    data.files = {};
    storage.set(JSON.stringify(data));
    if (!warnedQuota) {
      warnedQuota = true;
      toast('No hi ha prou espai al navegador per desar les imatges. Desa el dibuix a un fitxer per no perdre-les.', 5000);
    }
  }

  function loadSaved() {
    const raw = storage.get();
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      if (Array.isArray(d.elements)) S.elements = d.elements.filter(isValidElement);
      Object.assign(files, sanitizeFiles(d.files));
      const a = d.app || {};
      if (a.theme === 'light' || a.theme === 'dark') S.theme = a.theme;
      S.grid = !!a.grid;
      S.locked = !!a.locked;
      S.background = validBg(a.background);
      S.bgImage = validBgImage(a.bgImage);
      if (Array.isArray(a.recentColors)) S.recentColors = a.recentColors.map(validBg).filter(Boolean).slice(0, 11);
      if (isFinite(a.nudge) && +a.nudge > 0) S.nudge = clamp(Math.round(+a.nudge), 1, 500);
      if (a.view && isFinite(a.view.x) && isFinite(a.view.y) && isFinite(a.view.zoom)) {
        S.view = { x: +a.view.x, y: +a.view.y, zoom: clamp(+a.view.zoom, MIN_ZOOM, MAX_ZOOM) };
      }
      if (a.style) for (const k in S.style) if (a.style[k] !== undefined) S.style[k] = a.style[k];
    } catch (e) {
      console.warn('Pissarra: no s\'ha pogut llegir el dibuix desat', e);
    }
  }

  /* =========================================================
   * Fletxes i línies enganxades als elements
   * Cada extrem pot tenir una unió { id, fx, fy }: l'element i un punt de
   * focus relatiu a la seva caixa (de 0 a 1). L'extrem es col·loca on la
   * recta que va del punt veí cap al focus talla la vora de l'element,
   * de manera que en moure, girar o redimensionar l'element, el segueix.
   * ========================================================= */
  const BINDABLE = new Set(['rectangle', 'ellipse', 'diamond', 'text', 'image']);
  const BIND_GAP = 5; // separació entre la punta i la vora
  let bindHintId = null;
  const noBind = (e) => !!(e && (e.ctrlKey || e.metaKey)); // Ctrl/Cmd: no enganxa

  function elementMap() {
    const m = new Map();
    for (const e of S.elements) m.set(e.id, e);
    return m;
  }
  /** Món → coordenades locals de l'element (sense gir, origen a la cantonada). */
  function toLocal(el, wx, wy) {
    if (el.angle) {
      const c = R.elCenter(el);
      [wx, wy] = rotPt(wx, wy, c[0], c[1], -el.angle);
    }
    return [wx - el.x, wy - el.y];
  }
  function fromLocal(el, lx, ly) {
    let x = el.x + lx, y = el.y + ly;
    if (el.angle) {
      const c = R.elCenter(el);
      [x, y] = rotPt(x, y, c[0], c[1], el.angle);
    }
    return [x, y];
  }
  function insideLocal(el, lx, ly) {
    const w = el.w, h = el.h;
    if (lx < 0 || ly < 0 || lx > w || ly > h) return false;
    if (el.type === 'ellipse') return w > 0 && h > 0 && ((lx - w / 2) / (w / 2)) ** 2 + ((ly - h / 2) / (h / 2)) ** 2 <= 1;
    if (el.type === 'diamond') return w > 0 && h > 0 && Math.abs(lx - w / 2) / (w / 2) + Math.abs(ly - h / 2) / (h / 2) <= 1;
    return true;
  }
  /** Primer punt on la semirecta A + t·D (t ≥ 0) talla la vora de l'element, en coordenades locals. */
  function rayOutline(el, ax, ay, dx, dy) {
    const w = el.w, h = el.h;
    let best = Infinity;
    if (el.type === 'ellipse') {
      const rx = w / 2, ry = h / 2;
      if (rx < 0.01 || ry < 0.01) return null;
      const ox = (ax - rx) / rx, oy = (ay - ry) / ry, vx = dx / rx, vy = dy / ry;
      const qa = vx * vx + vy * vy, qb = 2 * (ox * vx + oy * vy), qc = ox * ox + oy * oy - 1;
      const disc = qb * qb - 4 * qa * qc;
      if (qa < 1e-12 || disc < 0) return null;
      const sq = Math.sqrt(disc);
      for (const t of [(-qb - sq) / (2 * qa), (-qb + sq) / (2 * qa)]) if (t >= 0 && t < best) best = t;
    } else {
      const poly = el.type === 'diamond'
        ? [[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]
        : [[0, 0], [w, 0], [w, h], [0, h]];
      for (let i = 0; i < 4; i++) {
        const [px, py] = poly[i], [qx, qy] = poly[(i + 1) % 4];
        const ex = qx - px, ey = qy - py;
        const den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-12) continue;
        const t = ((px - ax) * ey - (py - ay) * ex) / den;
        const u = ((px - ax) * dy - (py - ay) * dx) / den;
        if (t >= 0 && u >= 0 && u <= 1 && t < best) best = t;
      }
    }
    return best === Infinity ? null : [ax + dx * best, ay + dy * best];
  }
  /** Element on s'enganxaria un extrem deixat en aquest punt (a dins o molt a prop de la vora). */
  function bindCandidate(wx, wy, exclude) {
    const tol = (touchy() ? 14 : 10) / S.view.zoom;
    for (let i = S.elements.length - 1; i >= 0; i--) {
      const el = S.elements[i];
      if (!BINDABLE.has(el.type) || el._editing || (exclude && exclude.has(el.id))) continue;
      const [lx, ly] = toLocal(el, wx, wy);
      if (insideLocal(el, lx, ly) || hitElement(el, wx, wy, tol)) return el;
    }
    return null;
  }
  function makeBinding(el, wx, wy) {
    const [lx, ly] = toLocal(el, wx, wy);
    let fx = el.w > 0 ? clamp(lx / el.w, 0, 1) : 0.5;
    let fy = el.h > 0 ? clamp(ly / el.h, 0, 1) : 0.5;
    // A prop del centre, la fletxa apunta al centre
    if (Math.abs(fx - 0.5) < 0.18 && Math.abs(fy - 0.5) < 0.18) { fx = 0.5; fy = 0.5; }
    return { id: el.id, fx: Math.round(fx * 1000) / 1000, fy: Math.round(fy * 1000) / 1000 };
  }
  function bindFocusWorld(b, map) {
    const el = map.get(b.id);
    return el ? fromLocal(el, b.fx * el.w, b.fy * el.h) : null;
  }
  /** Posició de l'extrem enganxat, venint des del punt veí adj. */
  function boundEndpoint(b, adj, map) {
    const el = map.get(b.id);
    if (!el || !adj) return null;
    const [ax, ay] = toLocal(el, adj[0], adj[1]);
    const fx = b.fx * el.w, fy = b.fy * el.h;
    if (insideLocal(el, ax, ay)) return fromLocal(el, fx, fy);
    const dx = fx - ax, dy = fy - ay, L = Math.hypot(dx, dy);
    if (L < 1e-6) return fromLocal(el, fx, fy);
    const hit = rayOutline(el, ax, ay, dx, dy);
    if (!hit) return fromLocal(el, fx, fy);
    const gap = Math.min(BIND_GAP, Math.hypot(hit[0] - ax, hit[1] - ay) / 2);
    return fromLocal(el, hit[0] - (dx / L) * gap, hit[1] - (dy / L) * gap);
  }
  /** Recol·loca els extrems enganxats d'una fletxa o línia. */
  function refreshArrow(a, map) {
    const n = a.points.length;
    if (n < 2) return;
    const sb = a.startBinding && map.has(a.startBinding.id) ? a.startBinding : null;
    const eb = a.endBinding && map.has(a.endBinding.id) ? a.endBinding : null;
    if (!sb && !eb) return;
    const pts = a.points.map((p) => [a.x + p[0], a.y + p[1]]);
    // Amb dos punts i tots dos extrems enganxats, cada extrem apunta al focus de l'altre
    const adjS = n > 2 ? pts[1] : eb ? bindFocusWorld(eb, map) : pts[n - 1];
    const adjE = n > 2 ? pts[n - 2] : sb ? bindFocusWorld(sb, map) : pts[0];
    if (sb) pts[0] = boundEndpoint(sb, adjS, map) || pts[0];
    if (eb) pts[n - 1] = boundEndpoint(eb, adjE, map) || pts[n - 1];
    const nx = round2(pts[0][0]), ny = round2(pts[0][1]);
    const np = pts.map((q) => [round2(q[0] - nx), round2(q[1] - ny)]);
    const same = nx === round2(a.x) && ny === round2(a.y) &&
      np.every((p, i) => p[0] === round2(a.points[i][0]) && p[1] === round2(a.points[i][1]));
    if (same) return;
    a.x = nx;
    a.y = ny;
    a.points = np;
    bump(a);
  }
  /** Actualitza les fletxes enganxades (a tots els elements, o només als de ids). */
  function refreshBindings(ids) {
    if (!S.elements.some((a) => a.startBinding || a.endBinding)) return;
    const map = elementMap();
    for (const a of S.elements) {
      if (!LINEAR.has(a.type) || (!a.startBinding && !a.endBinding)) continue;
      if (ids && !ids.has(a.id) &&
        !(a.startBinding && ids.has(a.startBinding.id)) &&
        !(a.endBinding && ids.has(a.endBinding.id))) continue;
      refreshArrow(a, map);
    }
  }
  /** Treu les unions a elements que ja no existeixen. */
  function cleanBindings() {
    const ok = new Set();
    for (const e of S.elements) if (BINDABLE.has(e.type)) ok.add(e.id);
    for (const a of S.elements) {
      for (const k of ['startBinding', 'endBinding']) {
        if (a[k] && (!LINEAR.has(a.type) || !ok.has(a[k].id))) delete a[k];
      }
    }
  }
  /** Desenganxa les fletxes d'aquest conjunt que estan unides a elements de fora del conjunt. */
  function detachOutside(els) {
    const inSet = new Set(els.map((e) => e.id));
    const removed = [];
    for (const a of els) {
      if (!LINEAR.has(a.type)) continue;
      for (const k of ['startBinding', 'endBinding']) {
        if (a[k] && !inSet.has(a[k].id)) {
          removed.push([a.id, k, a[k]]);
          delete a[k];
        }
      }
    }
    return removed;
  }
  function reattach(list) {
    for (const [id, k, b] of list) {
      const a = byId(id);
      if (a) a[k] = b;
    }
  }
  /** En copiar: les unions apunten a les còpies; si l'element no s'ha copiat, es treuen. */
  function remapBindings(clones, idMap) {
    for (const c of clones) {
      for (const k of ['startBinding', 'endBinding']) {
        if (!c[k]) continue;
        if (idMap.has(c[k].id)) c[k] = { id: idMap.get(c[k].id), fx: c[k].fx, fy: c[k].fy };
        else delete c[k];
      }
    }
  }
  /** Contorn ressaltat de l'element on s'enganxa una fletxa. */
  function drawBindHighlight(el, th) {
    if (!el) return;
    const z = S.view.zoom;
    const [cx, cy] = toScreen(...R.elCenter(el));
    const hw = (el.w * z) / 2 + 6, hh = (el.h * z) / 2 + 6;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(el.angle || 0);
    ctx.beginPath();
    if (el.type === 'ellipse') ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
    else if (el.type === 'diamond') {
      ctx.moveTo(0, -hh - 3);
      ctx.lineTo(hw + 3, 0);
      ctx.lineTo(0, hh + 3);
      ctx.lineTo(-hw - 3, 0);
      ctx.closePath();
    } else if (ctx.roundRect) ctx.roundRect(-hw, -hh, hw * 2, hh * 2, 8);
    else ctx.rect(-hw, -hh, hw * 2, hh * 2);
    ctx.strokeStyle = th.accent;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  /* =========================================================
   * Grups
   * Cada element té groupIds, del grup més intern al més extern.
   * Un clic selecciona el grup més extern; amb doble clic s'entra dins
   * del grup (S.editingGroup) i llavors es treballa amb el nivell següent.
   * ========================================================= */
  const groupsOf = (el) => el.groupIds || [];
  const groupMembers = (gid) => S.elements.filter((e) => groupsOf(e).includes(gid));

  /** Grup que se selecciona en fer clic a l'element, segons el nivell d'edició actual (o null). */
  function targetGroup(el) {
    const g = groupsOf(el);
    if (!g.length) return null;
    if (S.editingGroup) {
      const k = g.indexOf(S.editingGroup);
      if (k >= 0) return k > 0 ? g[k - 1] : null;
    }
    return g[g.length - 1];
  }
  /** Identificadors que se seleccionen junts en fer clic a l'element. */
  function unitIdsFor(el) {
    const g = targetGroup(el);
    return g ? groupMembers(g).map((e) => e.id) : [el.id];
  }
  const expandToUnits = (ids) => {
    const out = new Set();
    for (const id of ids) {
      const el = byId(id);
      if (el) unitIdsFor(el).forEach((x) => out.add(x));
    }
    return Array.from(out);
  };
  /** Divideix la selecció en unitats: cada grup seleccionat o cada element solt. */
  function selectionUnits() {
    const seen = new Set();
    const units = [];
    for (const el of selectedEls()) {
      if (seen.has(el.id)) continue;
      const g = targetGroup(el);
      const members = g ? groupMembers(g).filter((e) => S.selected.has(e.id)) : [el];
      members.forEach((e) => seen.add(e.id));
      units.push(members);
    }
    return units;
  }
  /** Grups als quals pertanyen els elements nous (quan s'edita dins d'un grup). */
  function currentGroupPath() {
    if (!S.editingGroup) return [];
    const m = S.elements.find((e) => groupsOf(e).includes(S.editingGroup));
    return m ? m.groupIds.slice(m.groupIds.indexOf(S.editingGroup)) : [];
  }
  /** Treu els grups que s'han quedat amb menys de dos elements. */
  function cleanGroups() {
    const count = new Map();
    for (const el of S.elements) for (const g of groupsOf(el)) count.set(g, (count.get(g) || 0) + 1);
    for (const el of S.elements) {
      const g = groupsOf(el);
      if (g.length && g.some((x) => count.get(x) < 2)) el.groupIds = g.filter((x) => count.get(x) >= 2);
    }
    if (S.editingGroup && !(count.get(S.editingGroup) >= 2)) S.editingGroup = null;
  }
  /**
   * Assigna grups nous a unes còpies. Els grups copiats sencers reben un identificador nou;
   * amb keepPartial (duplicar) es conserven els grups que no s'han copiat sencers,
   * i sense (enganxar) es descarten els que tindrien un sol element.
   */
  function remapGroups(clones, keepPartial) {
    const inSet = new Map();
    for (const c of clones) for (const g of groupsOf(c)) inSet.set(g, (inSet.get(g) || 0) + 1);
    const total = new Map();
    for (const e of S.elements) for (const g of groupsOf(e)) total.set(g, (total.get(g) || 0) + 1);
    const fresh = new Map();
    const newId = (g) => { if (!fresh.has(g)) fresh.set(g, 'g_' + uid()); return fresh.get(g); };
    for (const c of clones) {
      c.groupIds = groupsOf(c).map((g) => {
        if (keepPartial) return inSet.get(g) === total.get(g) ? newId(g) : g;
        return inSet.get(g) >= 2 ? newId(g) : null;
      }).filter(Boolean);
    }
  }

  function groupSelected() {
    if (editing) commitText();
    if (selectionUnits().length < 2) return;
    const gid = 'g_' + uid();
    for (const el of selectedEls()) {
      const g = groupsOf(el).slice();
      const pos = S.editingGroup ? g.indexOf(S.editingGroup) : -1;
      g.splice(pos > -1 ? pos : g.length, 0, gid);
      el.groupIds = g;
    }
    // Els elements del grup queden seguits a la pila, a l'altura del més alt
    const isSel = (e) => S.selected.has(e.id);
    let top = -1;
    S.elements.forEach((e, i) => { if (isSel(e)) top = i; });
    const before = S.elements.slice(0, top).filter((e) => !isSel(e)).length;
    const rest = S.elements.filter((e) => !isSel(e));
    S.elements = rest.slice(0, before).concat(S.elements.filter(isSel), rest.slice(before));
    commit();
    toast('Elements agrupats');
  }

  function ungroupSelected() {
    if (editing) commitText();
    const gids = new Set(selectedEls().map(targetGroup).filter(Boolean));
    if (!gids.size) return;
    for (const el of S.elements) {
      if (groupsOf(el).some((g) => gids.has(g))) el.groupIds = el.groupIds.filter((g) => !gids.has(g));
    }
    commit();
    toast('Grup desfet');
  }

  /* =========================================================
   * Historial (desfés / refés)
   * ========================================================= */
  const history = { stack: [], index: -1 };
  const snapshot = () => JSON.stringify(S.elements, stripPrivate);

  function commit() {
    cleanGroups();
    cleanBindings();
    refreshBindings();
    const snap = snapshot();
    if (history.stack[history.index] !== snap) {
      history.stack.length = history.index + 1;
      history.stack.push(snap);
      if (history.stack.length > 200) history.stack.shift();
      history.index = history.stack.length - 1;
      saveSoon();
    }
    updateUI();
    requestRender();
  }

  function restore(snap) {
    S.elements = JSON.parse(snap);
    const ids = new Set(S.elements.map((e) => e.id));
    for (const id of Array.from(S.selected)) if (!ids.has(id)) S.selected.delete(id);
    if (S.editingGroup && !S.elements.some((e) => groupsOf(e).includes(S.editingGroup))) S.editingGroup = null;
    saveSoon();
    updateUI();
    requestRender();
  }
  function undo() {
    if (drag) return;
    if (editing) commitText();
    if (history.index > 0) { history.index--; restore(history.stack[history.index]); }
  }
  function redo() {
    if (drag) return;
    if (editing) commitText();
    if (history.index < history.stack.length - 1) { history.index++; restore(history.stack[history.index]); }
  }

  /* =========================================================
   * Vista (desplaçament i zoom)
   * ========================================================= */
  const toWorld = (sx, sy) => [(sx - S.view.x) / S.view.zoom, (sy - S.view.y) / S.view.zoom];
  const toScreen = (wx, wy) => [wx * S.view.zoom + S.view.x, wy * S.view.zoom + S.view.y];
  const snapV = (v) => (S.grid ? Math.round(v / GRID) * GRID : v);
  const snapPt = (x, y) => [snapV(x), snapV(y)];

  function afterViewChange() {
    if (editing) positionEditor();
    $('#zoom-label').textContent = Math.round(S.view.zoom * 100) + '%';
    saveSoon();
    requestRender();
  }
  function zoomTo(z, sx, sy) {
    if (sx == null) { sx = W / 2; sy = H / 2; }
    z = clamp(z, MIN_ZOOM, MAX_ZOOM);
    const [wx, wy] = toWorld(sx, sy);
    S.view.zoom = z;
    S.view.x = sx - wx * z;
    S.view.y = sy - wy * z;
    afterViewChange();
  }
  function zoomStep(dir) {
    const steps = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5, 6, 8, 10, 15, 20, 30];
    const z = S.view.zoom;
    let next = dir > 0 ? steps.find((s) => s > z + 0.001) : steps.slice().reverse().find((s) => s < z - 0.001);
    if (next == null) next = dir > 0 ? MAX_ZOOM : MIN_ZOOM;
    zoomTo(next);
  }
  function viewCenter() { return toWorld(W / 2, H / 2); }

  function fitToContent(els) {
    els = els || S.elements;
    if (!els.length) {
      S.view = { x: 0, y: 0, zoom: 1 };
      afterViewChange();
      return;
    }
    const b = R.sceneBounds(els);
    const mobile = W <= 640;
    const padX = mobile ? 24 : 80;
    const padTop = mobile ? 70 : 90;
    const padBottom = mobile ? 150 : 80;
    const z = clamp(Math.min((W - padX * 2) / Math.max(b.w, 1), (H - padTop - padBottom) / Math.max(b.h, 1)), MIN_ZOOM, 2);
    S.view.zoom = z;
    S.view.x = W / 2 - (b.x + b.w / 2) * z;
    S.view.y = padTop + (H - padTop - padBottom) / 2 - (b.y + b.h / 2) * z;
    afterViewChange();
  }

  /* =========================================================
   * Pintat
   * ========================================================= */
  let queued = false;
  const erasing = new Set();

  function requestRender() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; render(); });
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 3);
    W = app.clientWidth;
    H = app.clientHeight;
    canvas.width = Math.max(1, Math.round(W * DPR));
    canvas.height = Math.max(1, Math.round(H * DPR));
    if (editing) positionEditor();
    render();
  }

  function render() {
    const th = R.THEMES[S.theme];
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = R.canvasBg(S.theme, S.background);
    ctx.fillRect(0, 0, W, H);
    if (S.bgImage) R.drawBackgroundImage(ctx, S.bgImage, files, { x: 0, y: 0, w: W, h: H }, S.view, requestRender);
    if (S.grid) drawGrid(R.isDarkColor(R.canvasBg(S.theme, S.background)) ? R.THEMES.dark : R.THEMES.light);

    const z = S.view.zoom;
    const [vx1, vy1] = toWorld(0, 0);
    const [vx2, vy2] = toWorld(W, H);
    const m = 60 / z;
    ctx.save();
    ctx.translate(S.view.x, S.view.y);
    ctx.scale(z, z);
    for (const el of S.elements) {
      if (el._editing && el.type === 'text') continue;
      const b = R.getBounds(el);
      if (b.x > vx2 + m || b.y > vy2 + m || b.x + b.w < vx1 - m || b.y + b.h < vy1 - m) continue;
      R.drawElement(ctx, el, S.theme, { files, faded: erasing.has(el.id), onImageLoad: requestRender, ghost: true, zoom: S.view.zoom });
    }
    ctx.restore();
    drawOverlay(th);
    $('#hint').classList.toggle('show', S.elements.length === 0 && !editing);
  }

  function drawGrid(th) {
    let step = GRID * S.view.zoom;
    while (step < 10) step *= 5;
    ctx.lineWidth = 1;
    const minor = new Path2D();
    const major = new Path2D();
    const x0 = ((S.view.x % step) + step) % step;
    const y0 = ((S.view.y % step) + step) % step;
    for (let x = x0; x <= W; x += step) {
      const i = Math.round((x - S.view.x) / step);
      const p = i % 5 === 0 ? major : minor;
      p.moveTo(Math.round(x) + 0.5, 0);
      p.lineTo(Math.round(x) + 0.5, H);
    }
    for (let y = y0; y <= H; y += step) {
      const i = Math.round((y - S.view.y) / step);
      const p = i % 5 === 0 ? major : minor;
      p.moveTo(0, Math.round(y) + 0.5);
      p.lineTo(W, Math.round(y) + 0.5);
    }
    ctx.strokeStyle = th.grid;
    ctx.stroke(minor);
    ctx.strokeStyle = th.gridMajor;
    ctx.stroke(major);
  }

  const selectionBounds = () => R.sceneBounds(selectedEls());
  function singleLinear() {
    if (S.selected.size !== 1) return null;
    const el = byId(S.selected.values().next().value);
    return el && LINEAR.has(el.type) ? el : null;
  }

  let lastPointerType = 'mouse';
  const touchy = () => lastPointerType !== 'mouse';

  /** Marc de selecció en coordenades del món (girat quan hi ha un sol element girat). */
  function selFrame() {
    const sel = selectedEls();
    if (!sel.length) return null;
    if (sel.length === 1) {
      const b = R.rawBounds(sel[0]);
      return { x: b.x, y: b.y, w: b.w, h: b.h, angle: sel[0].angle || 0 };
    }
    const b = selectionBounds();
    return { x: b.x, y: b.y, w: b.w, h: b.h, angle: 0 };
  }
  /** Punt (u, v) relatiu a la cantonada del marc → coordenades de pantalla. */
  function framePt(f, u, v) {
    const [x, y] = rotPt(f.x + u, f.y + v, f.x + f.w / 2, f.y + f.h / 2, f.angle);
    return toScreen(x, y);
  }
  function frameCorners(f, padPx) {
    const p = padPx / S.view.zoom;
    return [framePt(f, -p, -p), framePt(f, f.w + p, -p), framePt(f, f.w + p, f.h + p), framePt(f, -p, f.h + p)];
  }
  const ROT_GAP = 26; // distància (px) de la nansa de girar a la vora del marc

  function getHandles() {
    const sel = selectedEls();
    if (!sel.length) return [];
    const z = S.view.zoom;
    const lin = singleLinear();
    if (lin) {
      const b = R.getBounds(lin);
      const [x, y] = toScreen(b.x + b.w / 2, b.y);
      return [{ id: 'rot', x, y: y - ROT_GAP - 6, angle: 0 }];
    }
    const f = selFrame();
    const p = 6 / z;
    const hs = [
      { id: 'nw', u: -p, v: -p }, { id: 'ne', u: f.w + p, v: -p },
      { id: 'se', u: f.w + p, v: f.h + p }, { id: 'sw', u: -p, v: f.h + p },
    ];
    const onlyCorners = sel.length === 1 && sel[0].type === 'text';
    if (!onlyCorners) {
      if (f.w * z > 44) hs.push({ id: 'n', u: f.w / 2, v: -p }, { id: 's', u: f.w / 2, v: f.h + p });
      if (f.h * z > 44) hs.push({ id: 'w', u: -p, v: f.h / 2 }, { id: 'e', u: f.w + p, v: f.h / 2 });
    }
    hs.push({ id: 'rot', u: f.w / 2, v: -p - ROT_GAP / z });
    return hs.map((h) => {
      const [x, y] = framePt(f, h.u, h.v);
      return { id: h.id, x, y, angle: f.angle };
    });
  }
  function handleAt(sx, sy) {
    const r = touchy() ? 18 : 9;
    const hs = getHandles();
    const rot = hs.find((h) => h.id === 'rot' && Math.hypot(h.x - sx, h.y - sy) <= r);
    if (rot) return rot;
    let best = null, bd = Infinity;
    for (const h of hs) {
      const d = Math.hypot(h.x - sx, h.y - sy);
      if (d <= r && d < bd) { best = h; bd = d; }
    }
    return best;
  }
  function handleCursor(h) {
    if (h.id === 'rot') return ROTATE_CURSOR;
    const deg = HANDLE_DIR[h.id] + (h.angle * 180) / Math.PI;
    return RESIZE_CURSORS[((Math.round(deg / 45) % 4) + 4) % 4];
  }
  function linearHandleAt(el, sx, sy) {
    const r = touchy() ? 18 : 9;
    const pts = el.points.map((p) => toScreen(el.x + p[0], el.y + p[1]));
    for (let i = pts.length - 1; i >= 0; i--) {
      if (Math.hypot(pts[i][0] - sx, pts[i][1] - sy) <= r) return { index: i };
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 36) continue;
      if (Math.hypot((a[0] + b[0]) / 2 - sx, (a[1] + b[1]) / 2 - sy) <= r * 0.85) return { index: i, mid: true };
    }
    return null;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }
  function strokePoly(pts) {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = Math.round(p[0]) + 0.5, y = Math.round(p[1]) + 0.5;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
  }
  function drawHandles(hs, th) {
    const size = touchy() ? 12 : 9;
    ctx.fillStyle = th.handleFill;
    ctx.strokeStyle = th.accent;
    ctx.lineWidth = 1.5;
    for (const h of hs) {
      ctx.save();
      ctx.translate(h.x, h.y);
      if (h.id === 'rot') {
        ctx.beginPath();
        ctx.arc(0, 0, size / 2 + 1, 0, Math.PI * 2);
      } else {
        ctx.rotate(h.angle);
        roundRect(-size / 2, -size / 2, size, size, 2.5);
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawOverlay(th) {
    const sel = selectedEls();
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = th.accent;
    const creating = drag && (drag.type === 'create' || drag.type === 'freedraw');
    const busy = drag && ((drag.type === 'move' && drag.moved) || drag.type === 'rotate');
    if (S.editingGroup) {
      // Marc del grup que s'està editant
      const gm = groupMembers(S.editingGroup);
      if (gm.length) {
        const b = R.sceneBounds(gm);
        ctx.setLineDash([2, 5]);
        ctx.globalAlpha = 0.7;
        strokePoly(frameCorners({ x: b.x, y: b.y, w: b.w, h: b.h, angle: 0 }, 12));
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
      }
    }
    if (sel.length && !creating) {
      if (sel.length > 1) {
        // Un marc discontinu per cada element solt o grup seleccionat
        const units = selectionUnits();
        if (units.length > 1) {
          ctx.setLineDash([4, 4]);
          for (const u of units) {
            const b = u.length === 1 ? R.rawBounds(u[0]) : R.sceneBounds(u);
            strokePoly(frameCorners({ x: b.x, y: b.y, w: b.w, h: b.h, angle: u.length === 1 ? u[0].angle || 0 : 0 }, 3));
          }
          ctx.setLineDash([]);
        }
      }
      const lin = singleLinear();
      if (lin) {
        const pts = lin.points.map((p) => toScreen(lin.x + p[0], lin.y + p[1]));
        const pr = touchy() ? 7 : 5;
        ctx.fillStyle = th.accent;
        ctx.globalAlpha = 0.45;
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1];
          if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 36) continue;
          ctx.beginPath();
          ctx.arc((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, pr - 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1.5;
        pts.forEach((p, i) => {
          // Els extrems enganxats a un element es pinten plens
          const bound = (i === 0 && lin.startBinding) || (i === pts.length - 1 && lin.endBinding);
          ctx.fillStyle = bound ? th.accent : th.handleFill;
          ctx.beginPath();
          ctx.arc(p[0], p[1], pr, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
        if (!busy) drawHandles(getHandles(), th);
      } else {
        strokePoly(frameCorners(selFrame(), 6));
        if (!busy) drawHandles(getHandles(), th);
      }
    }
    if (drag && drag.type === 'rotate' && drag.label != null) {
      const txt = drag.label + '°';
      ctx.font = '600 12px ' + R.FONTS.normal;
      const w = ctx.measureText(txt).width + 14;
      const x = Math.min(drag.lsx + 16, W - w - 8), y = Math.max(drag.lsy - 30, 8);
      ctx.fillStyle = th.accent;
      roundRect(x, y, w, 22, 6);
      ctx.fill();
      ctx.fillStyle = th.handleFill;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(txt, x + 7, y + 11.5);
    }
    // Elements on s'enganxarà (o s'ha enganxat) la fletxa que s'està dibuixant
    const bindIds = [];
    if (drag && drag.type === 'create' && LINEAR.has(drag.el.type)) {
      if (drag.el.startBinding) bindIds.push(drag.el.startBinding.id);
      if (drag.el.endBinding) bindIds.push(drag.el.endBinding.id);
    } else if (drag && drag.type === 'point' && drag.bindKey && drag.el[drag.bindKey]) {
      bindIds.push(drag.el[drag.bindKey].id);
    } else if (!drag && bindHintId && (S.tool === 'arrow' || S.tool === 'line')) bindIds.push(bindHintId);
    for (const id of bindIds) drawBindHighlight(byId(id), th);
    if (hoverId && !drag && (cpEyedrop || S.tool === 'bucket' || S.tool === 'eyedropper')) {
      const el = byId(hoverId);
      if (el) {
        const b = R.rawBounds(el);
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1.5;
        strokePoly(frameCorners({ x: b.x, y: b.y, w: b.w, h: b.h, angle: el.angle || 0 }, 4));
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
      }
    }
    if (drag && drag.type === 'marquee') {
      const [ax, ay] = toScreen(drag.x0, drag.y0);
      const [bx, by] = toScreen(drag.x1, drag.y1);
      ctx.fillStyle = th.accent;
      ctx.globalAlpha = 0.08;
      ctx.fillRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.min(ax, bx) + 0.5, Math.min(ay, by) + 0.5, Math.abs(bx - ax), Math.abs(by - ay));
    }
    ctx.restore();
  }

  /* =========================================================
   * Proves de contacte (quin element hi ha sota el punter)
   * ========================================================= */
  function distSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = clamp(t, 0, 1);
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  function distPolyline(px, py, pts) {
    if (pts.length === 1) return Math.hypot(px - pts[0][0], py - pts[0][1]);
    let m = Infinity;
    for (let i = 0; i < pts.length - 1; i++) m = Math.min(m, distSeg(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
    return m;
  }

  function hitElement(el, px, py, tol) {
    if (el.angle) {
      // Es treballa en el sistema de l'element sense girar
      const c = R.elCenter(el);
      [px, py] = rotPt(px, py, c[0], c[1], -el.angle);
    }
    const b = R.rawBounds(el);
    const sw = el.strokeWidth || 1;
    const mg = tol + sw * 2;
    if (px < b.x - mg || py < b.y - mg || px > b.x + b.w + mg || py > b.y + b.h + mg) return false;
    const lx = px - el.x, ly = py - el.y;
    const t = tol + sw / 2;
    const filled = el.fill && el.fill !== 'transparent';
    switch (el.type) {
      case 'rectangle': {
        const inside = lx >= 0 && ly >= 0 && lx <= el.w && ly <= el.h;
        if (inside && filled) return true;
        const d = inside
          ? Math.min(lx, ly, el.w - lx, el.h - ly)
          : Math.hypot(Math.max(-lx, 0, lx - el.w), Math.max(-ly, 0, ly - el.h));
        return d <= t;
      }
      case 'diamond': {
        const hw = el.w / 2, hh = el.h / 2;
        if (filled && hw > 0 && hh > 0 && Math.abs(lx - hw) / hw + Math.abs(ly - hh) / hh <= 1) return true;
        return distPolyline(lx, ly, [[hw, 0], [el.w, hh], [hw, el.h], [0, hh], [hw, 0]]) <= t;
      }
      case 'ellipse': {
        const rx = el.w / 2, ry = el.h / 2;
        if (rx < 1 || ry < 1) return distPolyline(lx, ly, [[0, 0], [el.w, 0], [el.w, el.h], [0, el.h], [0, 0]]) <= t;
        const nx = (lx - rx) / rx, ny = (ly - ry) / ry;
        const d = Math.hypot(nx, ny);
        if (filled && d <= 1) return true;
        const a = Math.atan2(ny, nx);
        return Math.abs(d - 1) * Math.hypot(rx * Math.cos(a), ry * Math.sin(a)) <= t;
      }
      case 'line':
      case 'arrow':
        return distPolyline(lx, ly, R.linearSamples(el)) <= t;
      case 'freedraw':
        return distPolyline(lx, ly, el.points) <= t + R.freedrawWidth(sw) / 2;
      default:
        return lx >= -tol && ly >= -tol && lx <= el.w + tol && ly <= el.h + tol;
    }
  }

  function hitTest(wx, wy) {
    const tol = (touchy() ? 12 : 6) / S.view.zoom;
    for (let i = S.elements.length - 1; i >= 0; i--) {
      if (hitElement(S.elements[i], wx, wy, tol)) return S.elements[i];
    }
    return null;
  }
  function insideShape(el, wx, wy) {
    if (el.angle) {
      const c = R.elCenter(el);
      [wx, wy] = rotPt(wx, wy, c[0], c[1], -el.angle);
    }
    return wx >= el.x && wy >= el.y && wx <= el.x + el.w && wy <= el.y + el.h;
  }
  const inBox = (x, y, b, pad) => x >= b.x - pad && y >= b.y - pad && x <= b.x + b.w + pad && y <= b.y + b.h + pad;

  /* =========================================================
   * Selecció i operacions amb elements
   * ========================================================= */
  function setSelection(ids) {
    S.selected = new Set(ids);
    updateProps();
    requestRender();
  }

  function removeIds(ids) {
    const s = new Set(ids);
    S.elements = S.elements.filter((e) => !s.has(e.id));
    for (const id of s) S.selected.delete(id);
  }

  function deleteSelected() {
    if (!S.selected.size) return;
    removeIds(Array.from(S.selected));
    commit();
  }

  function duplicateSelected() {
    const sel = selectedEls();
    if (!sel.length) return;
    const off = S.grid ? GRID : 12;
    const clones = sel.map((el) => {
      const c = cloneEl(el);
      c.id = uid();
      c.seed = randSeed();
      c.x += off;
      c.y += off;
      return c;
    });
    remapGroups(clones, true);
    remapBindings(clones, new Map(sel.map((el, i) => [el.id, clones[i].id])));
    S.elements.push(...clones);
    setSelection(clones.map((c) => c.id));
    commit();
  }

  function reorder(mode) {
    if (!S.selected.size) return;
    const isSel = (e) => S.selected.has(e.id);
    let els = S.elements.slice();
    if (mode === 'front') els = els.filter((e) => !isSel(e)).concat(els.filter(isSel));
    else if (mode === 'back') els = els.filter(isSel).concat(els.filter((e) => !isSel(e)));
    else if (mode === 'forward') {
      for (let i = els.length - 2; i >= 0; i--) {
        if (isSel(els[i]) && !isSel(els[i + 1])) { const t = els[i]; els[i] = els[i + 1]; els[i + 1] = t; }
      }
    } else if (mode === 'backward') {
      for (let i = 1; i < els.length; i++) {
        if (isSel(els[i]) && !isSel(els[i - 1])) { const t = els[i]; els[i] = els[i - 1]; els[i - 1] = t; }
      }
    }
    S.elements = els;
    commit();
  }

  function alignSelected(mode) {
    if (selectionUnits().length < 2) return;
    detachOutside(selectedEls());
    const b = selectionBounds();
    for (const unit of selectionUnits()) {
      const e = R.sceneBounds(unit);
      let dx = 0, dy = 0;
      if (mode === 'left') dx = b.x - e.x;
      else if (mode === 'center') dx = b.x + b.w / 2 - (e.x + e.w / 2);
      else if (mode === 'right') dx = b.x + b.w - (e.x + e.w);
      else if (mode === 'top') dy = b.y - e.y;
      else if (mode === 'middle') dy = b.y + b.h / 2 - (e.y + e.h / 2);
      else if (mode === 'bottom') dy = b.y + b.h - (e.y + e.h);
      for (const el of unit) { el.x += dx; el.y += dy; }
    }
    commit();
  }

  function nudge(dx, dy) {
    if (!S.selected.size) return;
    detachOutside(selectedEls());
    for (const el of selectedEls()) { el.x += dx; el.y += dy; }
    commit();
  }

  function normalizeLinear(el) {
    const [px, py] = el.points[0];
    if (px || py) {
      el.x += px;
      el.y += py;
      el.points = el.points.map((p) => [p[0] - px, p[1] - py]);
    }
    bump(el);
  }

  /* =========================================================
   * Interacció amb el punter (ratolí, llapis i tàctil)
   * ========================================================= */
  const pointers = new Map();
  let drag = null;
  let spaceDown = false;
  let lastTap = { t: 0, x: 0, y: 0 };
  let lastWorldPointer = null;
  let pointerOverCanvas = false;

  function evPos(e, rect) {
    const r = rect || canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  function baseCursor() {
    if (spaceDown || S.tool === 'hand') return 'grab';
    switch (S.tool) {
      case 'selection': return 'default';
      case 'text': return 'text';
      case 'eraser': return ERASER_CURSOR;
      case 'bucket': return BUCKET_CURSOR;
      case 'eyedropper': return EYEDROP_CURSOR;
      default: return 'crosshair';
    }
  }
  let curCursor = '';
  function setCursor(c) {
    if (c !== curCursor) { canvas.style.cursor = c; curCursor = c; }
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerenter', () => { pointerOverCanvas = true; });
  canvas.addEventListener('pointerleave', () => {
    pointerOverCanvas = false;
    if (hoverId || bindHintId) { hoverId = null; bindHintId = null; requestRender(); }
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  // Evita els esdeveniments de ratolí simulats després d'un toc (treurien el focus de l'editor de text)
  canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  canvas.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });

  function onPointerDown(e) {
    lastPointerType = e.pointerType || 'mouse';
    e.preventDefault();
    closeMenu();
    const [sx, sy] = evPos(e);
    pointers.set(e.pointerId, { x: sx, y: sy });
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* res */ }
    if (editing) {
      // Un toc fora de l'editor només confirma el text
      commitText();
      return;
    }

    if (pointers.size === 2) { cancelDrag(); startPinch(); return; }
    if (pointers.size > 2) return;

    const [wx, wy] = toWorld(sx, sy);
    // Comptagotes del selector de color: el clic agafa el color i no fa res més
    if (cpEyedrop && e.button === 0) { eyedropAt(wx, wy, 'picker'); return; }
    if (e.button === 1 || (e.button === 0 && spaceDown) || S.tool === 'hand') {
      drag = { type: 'pan', sx, sy, vx: S.view.x, vy: S.view.y };
      setCursor('grabbing');
      return;
    }
    if (e.button !== 0) return;

    const now = performance.now();
    const near = Math.hypot(sx - lastTap.x, sy - lastTap.y) < (lastPointerType === 'mouse' ? 6 : 24);
    const isDouble = now - lastTap.t < 420 && near;
    lastTap = isDouble ? { t: 0, x: 0, y: 0 } : { t: now, x: sx, y: sy };

    switch (S.tool) {
      case 'selection':
        downSelection(e, wx, wy, sx, sy, isDouble);
        break;
      case 'eraser':
        drag = { type: 'erase', lx: wx, ly: wy };
        eraseAt(wx, wy);
        break;
      case 'bucket':
        if (e.altKey) { eyedropAt(wx, wy, 'bucket'); break; }
        drag = { type: 'paint', lx: wx, ly: wy, origs: new Map(), reason: null };
        paintAt(wx, wy);
        break;
      case 'eyedropper':
        eyedropAt(wx, wy, 'tool');
        break;
      case 'text': {
        const hit = hitTest(wx, wy);
        if (hit && hit.type === 'text') startEditText(hit, false);
        else createTextAt(wx, wy);
        drag = { type: 'focus' };
        break;
      }
      default:
        if (CREATE_TOOLS.has(S.tool)) startCreate(S.tool, wx, wy, e);
    }
    requestRender();
  }

  function downSelection(e, wx, wy, sx, sy, isDouble) {
    const lin = singleLinear();
    if (lin) {
      const h = linearHandleAt(lin, sx, sy);
      if (h) {
        if (isDouble && !h.mid && lin.points.length > 2) {
          lin.points.splice(h.index, 1);
          normalizeLinear(lin);
          commit();
          return;
        }
        const orig = { x: lin.x, y: lin.y, points: lin.points.map((p) => p.slice()), startBinding: lin.startBinding, endBinding: lin.endBinding };
        let index = h.index;
        if (h.mid) {
          const a = lin.points[index], b = lin.points[index + 1];
          lin.points.splice(index + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
          index += 1;
          bump(lin);
        }
        // Un extrem que s'arrossega es desenganxa; es torna a enganxar si es deixa sobre un element
        const bindKey = h.mid ? null : index === 0 ? 'startBinding' : index === lin.points.length - 1 ? 'endBinding' : null;
        if (bindKey) delete lin[bindKey];
        drag = { type: 'point', el: lin, index, orig, bindKey };
        return;
      }
    }
    const handle = handleAt(sx, sy);
    if (handle) {
      if (handle.id === 'rot') startRotate(wx, wy);
      else startResize(handle.id);
      return;
    }

    const hit = hitTest(wx, wy);
    // Clic fora del grup que s'edita: se'n surt
    if (S.editingGroup && (!hit || !groupsOf(hit).includes(S.editingGroup))) S.editingGroup = null;
    if (isDouble) {
      // Doble clic sobre un grup: s'hi entra i se selecciona l'element (o subgrup) de sota
      const tg = hit && targetGroup(hit);
      if (tg) {
        S.editingGroup = tg;
        setSelection(unitIdsFor(hit));
        return;
      }
      if (hit && hit.type === 'text') { startEditText(hit, false); drag = { type: 'focus' }; return; }
      // Doble clic sobre una forma (o al seu interior, encara que no tingui fons): text centrat
      const shape = hit && SHAPES.has(hit.type) ? hit
        : !hit ? S.elements.slice().reverse().find((el) => SHAPES.has(el.type) && insideShape(el, wx, wy)) : null;
      if (shape) {
        const b = R.getBounds(shape);
        createTextAt(b.x + b.w / 2, b.y + b.h / 2, 'center', shape.angle || 0);
        drag = { type: 'focus' };
        return;
      }
      if (!hit || hit.type !== 'image') { createTextAt(wx, wy); drag = { type: 'focus' }; return; }
    }
    if (e.shiftKey) {
      if (hit) {
        const s = new Set(S.selected);
        const unit = unitIdsFor(hit);
        if (s.has(hit.id)) unit.forEach((id) => s.delete(id)); else unit.forEach((id) => s.add(id));
        setSelection(Array.from(s));
        if (S.selected.has(hit.id)) startMove(wx, wy, e.altKey);
      } else {
        drag = { type: 'marquee', x0: wx, y0: wy, x1: wx, y1: wy, base: Array.from(S.selected) };
      }
      return;
    }
    if (hit) {
      if (!S.selected.has(hit.id)) setSelection(unitIdsFor(hit));
      startMove(wx, wy, e.altKey);
      return;
    }
    if (S.selected.size && inBox(wx, wy, selectionBounds(), 6 / S.view.zoom)) {
      startMove(wx, wy, e.altKey);
      return;
    }
    setSelection([]);
    drag = { type: 'marquee', x0: wx, y0: wy, x1: wx, y1: wy, base: [] };
  }

  function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    const [sx, sy] = evPos(e, rect);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: sx, y: sy });
    const [wx, wy] = toWorld(sx, sy);
    lastWorldPointer = [wx, wy];
    if (!drag) {
      if (e.pointerType === 'mouse') updateHoverCursor(sx, sy, wx, wy);
      return;
    }
    switch (drag.type) {
      case 'pinch': if (pointers.size >= 2) movePinch(); return;
      case 'pan':
        S.view.x = drag.vx + (sx - drag.sx);
        S.view.y = drag.vy + (sy - drag.sy);
        afterViewChange();
        return;
      case 'create': moveCreate(e, wx, wy); break;
      case 'freedraw': moveFreedraw(e, rect); break;
      case 'move': moveSelection(wx, wy); refreshBindings(drag.origs); break;
      case 'resize': moveResize(wx, wy, e.shiftKey); refreshBindings(drag.origs); break;
      case 'rotate': moveRotate(wx, wy, e.shiftKey); refreshBindings(drag.origs); break;
      case 'point': movePoint(wx, wy, e.shiftKey, noBind(e)); break;
      case 'marquee': drag.x1 = wx; drag.y1 = wy; updateMarquee(); break;
      case 'erase': eraseAlong(wx, wy); break;
      case 'paint': paintAlong(wx, wy); break;
    }
    requestRender();
  }

  function onPointerUp(e) {
    pointers.delete(e.pointerId);
    if (!drag) {
      if (editing) ta.focus({ preventScroll: true });
      return;
    }
    if (drag.type === 'pinch') {
      if (pointers.size === 0) drag = null;
      return;
    }
    const d = drag;
    drag = null;
    switch (d.type) {
      case 'pan': setCursor(baseCursor()); break;
      case 'create': finishCreate(d); break;
      case 'freedraw': commit(); break;
      case 'move': if (d.moved) commit(); break;
      case 'resize': commit(); break;
      case 'rotate': commit(); break;
      case 'point': normalizeLinear(d.el); commit(); break;
      case 'erase': finishErase(); break;
      case 'paint': finishPaint(d); break;
    }
    if (editing) ta.focus({ preventScroll: true });
    updateUI();
    requestRender();
  }

  function cancelDrag() {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.type === 'create' || d.type === 'freedraw') removeIds([d.el.id]);
    else if (d.type === 'move') {
      if (d.dupIds) { removeIds(d.dupIds); S.selected = new Set(d.prevSel); }
      else for (const [id, o] of d.origs) { const el = byId(id); if (el) { el.x = o.x; el.y = o.y; } }
      if (d.detached) reattach(d.detached);
    } else if (d.type === 'resize' || d.type === 'rotate') {
      for (const [id, o] of d.origs) {
        const i = S.elements.findIndex((e) => e.id === id);
        if (i >= 0) S.elements[i] = o;
      }
    } else if (d.type === 'point') {
      Object.assign(d.el, d.orig);
      bump(d.el);
    } else if (d.type === 'erase') erasing.clear();
    else if (d.type === 'paint') {
      for (const [id, o] of d.origs) { const el = byId(id); if (el) { Object.assign(el, o); bump(el); } }
    }
    refreshBindings();
    updateUI();
    requestRender();
  }

  function updateHoverCursor(sx, sy, wx, wy) {
    if (spaceDown || S.tool === 'hand') return setCursor('grab');
    if (cpEyedrop || S.tool === 'bucket' || S.tool === 'eyedropper') {
      // Ressalta l'element que es pintarà o del qual s'agafarà el color
      const t = bucketHit(wx, wy);
      const id = t ? t.id : null;
      if (id !== hoverId) { hoverId = id; requestRender(); }
      return setCursor(cpEyedrop ? EYEDROP_CURSOR : baseCursor());
    }
    if (S.tool === 'arrow' || S.tool === 'line') {
      const c = bindCandidate(wx, wy);
      const id = c ? c.id : null;
      if (id !== bindHintId) { bindHintId = id; requestRender(); }
      return setCursor(baseCursor());
    }
    if (S.tool !== 'selection') return setCursor(baseCursor());
    const lin = singleLinear();
    if (lin && linearHandleAt(lin, sx, sy)) return setCursor('pointer');
    const h = handleAt(sx, sy);
    if (h) return setCursor(handleCursor(h));
    if (hitTest(wx, wy) || (S.selected.size && inBox(wx, wy, selectionBounds(), 6 / S.view.zoom))) return setCursor('move');
    setCursor('default');
  }

  /* --- Pessic (dos dits) --- */
  function startPinch() {
    const [a, b] = Array.from(pointers.values());
    drag = {
      type: 'pinch',
      d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      mx: (a.x + b.x) / 2,
      my: (a.y + b.y) / 2,
      view: Object.assign({}, S.view),
    };
  }
  function movePinch() {
    const [a, b] = Array.from(pointers.values());
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const v = drag.view;
    const z = clamp((v.zoom * d) / drag.d0, MIN_ZOOM, MAX_ZOOM);
    const wx = (drag.mx - v.x) / v.zoom, wy = (drag.my - v.y) / v.zoom;
    S.view.zoom = z;
    S.view.x = mx - wx * z;
    S.view.y = my - wy * z;
    afterViewChange();
  }

  /* --- Creació d'elements --- */
  function startCreate(type, wx, wy, e) {
    setSelection([]);
    if (type === 'freedraw') {
      const el = newElement('freedraw', round2(wx), round2(wy), { points: [[0, 0]] });
      S.elements.push(el);
      drag = { type: 'freedraw', el };
      return;
    }
    if (type === 'text') return;
    const [x, y] = snapPt(wx, wy);
    const extra = LINEAR.has(type)
      ? { points: [[0, 0], [0, 0]], arrowheads: type === 'arrow' ? S.style.arrowheads : 'none' }
      : {};
    const el = newElement(type, x, y, extra);
    S.elements.push(el);
    drag = { type: 'create', el, x0: x, y0: y };
    if (LINEAR.has(type) && !noBind(e)) {
      // Si es comença sobre un element (o molt a prop), l'inici s'hi enganxa
      const t = bindCandidate(wx, wy, new Set([el.id]));
      if (t) el.startBinding = makeBinding(t, wx, wy);
    }
  }

  function moveCreate(e, wx, wy) {
    const el = drag.el;
    const [x, y] = snapPt(wx, wy);
    if (LINEAR.has(el.type)) {
      let dx = x - drag.x0, dy = y - drag.y0;
      if (e.shiftKey) {
        const step = Math.PI / 12;
        const a = Math.round(Math.atan2(dy, dx) / step) * step;
        const l = Math.hypot(dx, dy);
        dx = Math.cos(a) * l;
        dy = Math.sin(a) * l;
      }
      // Punt final en coordenades del món (l'inici es pot haver mogut cap a la vora d'un element)
      el.points[1] = [round2(drag.x0 + dx - el.x), round2(drag.y0 + dy - el.y)];
      const exclude = new Set([el.id]);
      if (el.startBinding) exclude.add(el.startBinding.id);
      const t = noBind(e) ? null : bindCandidate(x, y, exclude);
      if (t) el.endBinding = makeBinding(t, x, y);
      else delete el.endBinding;
      refreshArrow(el, elementMap());
    } else {
      let w = x - drag.x0, h = y - drag.y0;
      if (e.shiftKey) {
        const s = Math.max(Math.abs(w), Math.abs(h));
        w = (w < 0 ? -1 : 1) * s;
        h = (h < 0 ? -1 : 1) * s;
      }
      el.x = Math.min(drag.x0, drag.x0 + w);
      el.y = Math.min(drag.y0, drag.y0 + h);
      el.w = Math.abs(w);
      el.h = Math.abs(h);
    }
    bump(el);
  }

  function moveFreedraw(e, rect) {
    const el = drag.el;
    const evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
    const list = evs.length ? evs : [e];
    const minD = 0.8 / S.view.zoom;
    for (const ce of list) {
      const [wx, wy] = toWorld(...evPos(ce, rect));
      const last = el.points[el.points.length - 1];
      const px = wx - el.x, py = wy - el.y;
      if (Math.hypot(px - last[0], py - last[1]) >= minD) el.points.push([round2(px), round2(py)]);
    }
    bump(el);
  }

  function finishCreate(d) {
    const el = d.el;
    const b = R.getBounds(el);
    if (Math.max(b.w, b.h) * S.view.zoom < 4) {
      removeIds([el.id]);
      requestRender();
      return;
    }
    if (S.locked) { commit(); return; }
    setTool('selection');
    setSelection([el.id]);
    commit();
  }

  /* --- Moure --- */
  function startMove(wx, wy, alt) {
    const sel = selectedEls();
    drag = {
      type: 'move', x0: wx, y0: wy, moved: false, alt,
      box: selectionBounds(),
      origs: new Map(sel.map((el) => [el.id, { x: el.x, y: el.y }])),
    };
  }
  function moveSelection(wx, wy) {
    let dx = wx - drag.x0, dy = wy - drag.y0;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) * S.view.zoom < 3) return;
      drag.moved = true;
      // Les fletxes que es mouen sense l'element on estan enganxades se'n desenganxen
      if (!drag.alt) drag.detached = detachOutside(selectedEls());
      if (drag.alt) {
        // Alt + arrossegar: duplica i mou la còpia
        const sel = selectedEls();
        const clones = sel.map((el) => { const c = cloneEl(el); c.id = uid(); c.seed = randSeed(); return c; });
        remapGroups(clones, true);
        remapBindings(clones, new Map(sel.map((el, i) => [el.id, clones[i].id])));
        drag.prevSel = sel.map((el) => el.id);
        drag.dupIds = clones.map((c) => c.id);
        S.elements.push(...clones);
        S.selected = new Set(drag.dupIds);
        drag.origs = new Map(clones.map((c) => [c.id, { x: c.x, y: c.y }]));
        detachOutside(clones);
      }
    }
    if (S.grid) {
      dx = snapV(drag.box.x + dx) - drag.box.x;
      dy = snapV(drag.box.y + dy) - drag.box.y;
    }
    for (const [id, o] of drag.origs) {
      const el = byId(id);
      if (el) { el.x = o.x + dx; el.y = o.y + dy; }
    }
  }

  /* --- Canviar la mida --- */
  function startResize(handle) {
    const sel = selectedEls();
    drag = {
      type: 'resize', handle, box: selectionBounds(),
      origs: new Map(sel.map((el) => [el.id, cloneEl(el)])),
      single: sel.length === 1 ? sel[0].type : null,
      rotated: sel.some((el) => el.angle),
    };
    detachOutside(sel);
  }

  function moveResize(wx, wy, shift) {
    if (drag.origs.size === 1 && drag.rotated) { resizeRotated(wx, wy, shift); return; }
    const h = drag.handle;
    const b = drag.box;
    [wx, wy] = snapPt(wx, wy);
    let x1 = b.x, y1 = b.y;
    const x2 = b.x + b.w, y2 = b.y + b.h;
    let nx2 = x2, ny2 = y2;
    if (h.includes('w')) x1 = wx;
    if (h.includes('e')) nx2 = wx;
    if (h.includes('n')) y1 = wy;
    if (h.includes('s')) ny2 = wy;
    let nw = nx2 - x1, nh = ny2 - y1;
    // Amb elements girats dins la selecció, l'escala ha de ser uniforme per no deformar-los
    const keep = drag.single === 'text' ? true : drag.single === 'image' ? !shift : drag.rotated ? true : shift;
    if (keep && b.w > 0 && b.h > 0) {
      const ratio = b.w / b.h;
      if (h.length === 2) {
        if (Math.abs(nw) / b.w > Math.abs(nh) / b.h) nh = (nh < 0 ? -1 : 1) * Math.abs(nw) / ratio;
        else nw = (nw < 0 ? -1 : 1) * Math.abs(nh) * ratio;
        x1 = h.includes('w') ? x2 - nw : b.x;
        y1 = h.includes('n') ? y2 - nh : b.y;
      } else if (h === 'n' || h === 's') {
        nw = Math.abs(nh) * ratio;
        x1 = b.x + (b.w - nw) / 2;
      } else {
        nh = Math.abs(nw) / ratio;
        y1 = b.y + (b.h - nh) / 2;
      }
    }
    const sx = b.w ? nw / b.w : 1;
    const sy = b.h ? nh / b.h : 1;
    for (const [id, o] of drag.origs) {
      const el = byId(id);
      if (el) applyScale(el, o, b, x1, y1, sx, sy);
    }
  }

  function applyScale(el, o, b, x1, y1, sx, sy) {
    const mapX = (x) => x1 + (x - b.x) * sx;
    const mapY = (y) => y1 + (y - b.y) * sy;
    if (o.type === 'image') {
      el.flipX = sx < 0 ? !o.flipX : !!o.flipX;
      el.flipY = sy < 0 ? !o.flipY : !!o.flipY;
    }
    if (o.angle) {
      // Element girat: s'escala la mida i es mou el centre (una reflexió inverteix l'angle)
      let ang = o.angle;
      if (sx < 0) ang = -ang;
      if (sy < 0) ang = -ang;
      el.angle = normAngle(ang);
      const ncx = mapX(o.x + o.w / 2), ncy = mapY(o.y + o.h / 2);
      if (o.type === 'text') {
        el.fontSize = clamp(round2(o.fontSize * Math.abs(sy || sx)), 4, 1000);
        measureTextEl(el);
      } else {
        el.w = o.w * Math.abs(sx);
        el.h = o.h * Math.abs(sy);
      }
      el.x = ncx - el.w / 2;
      el.y = ncy - el.h / 2;
      bump(el);
      return;
    }
    if (LINEAR.has(el.type) || el.type === 'freedraw') {
      el.x = mapX(o.x);
      el.y = mapY(o.y);
      el.points = o.points.map((p) => [round2(p[0] * sx), round2(p[1] * sy)]);
    } else if (el.type === 'text') {
      const s = drag.single === 'text' ? Math.abs(sy || sx) : Math.sqrt(Math.abs(sx * sy)) || 1;
      el.fontSize = clamp(round2(o.fontSize * s), 4, 1000);
      measureTextEl(el);
      const nx = mapX(o.x), ny = mapY(o.y);
      el.x = sx < 0 ? nx - el.w : nx;
      el.y = sy < 0 ? ny - el.h : ny;
    } else {
      const ax = mapX(o.x), bx = mapX(o.x + o.w), ay = mapY(o.y), by = mapY(o.y + o.h);
      el.x = Math.min(ax, bx);
      el.y = Math.min(ay, by);
      el.w = Math.abs(bx - ax);
      el.h = Math.abs(by - ay);
    }
    bump(el);
  }

  /** Canviar la mida d'un sol element girat: es treballa en el sistema de l'element. */
  function resizeRotated(wx, wy, shift) {
    const [id, o] = drag.origs.entries().next().value;
    const el = byId(id);
    if (!el) return;
    const h = drag.handle;
    const a = o.angle;
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    const [lx, ly] = rotPt(wx, wy, cx, cy, -a);
    const px = lx - o.x, py = ly - o.y;
    let nw = o.w, nh = o.h;
    if (h.includes('e')) nw = px;
    if (h.includes('w')) nw = o.w - px;
    if (h.includes('s')) nh = py;
    if (h.includes('n')) nh = o.h - py;
    nw = Math.max(nw, 1);
    nh = Math.max(nh, 1);
    const keep = o.type === 'text' ? true : o.type === 'image' ? !shift : shift;
    if (keep && o.w > 0 && o.h > 0) {
      const ratio = o.w / o.h;
      if (h.length === 2) {
        if (nw / o.w > nh / o.h) nh = nw / ratio;
        else nw = nh * ratio;
      } else if (h === 'n' || h === 's') nw = nh * ratio;
      else nh = nw / ratio;
    }
    if (o.type === 'text') {
      el.fontSize = clamp(round2(o.fontSize * (nh / o.h)), 4, 1000);
      measureTextEl(el);
      nw = el.w;
      nh = el.h;
    }
    // La vora o cantonada oposada a la nansa queda fixa
    const x1 = h.includes('w') ? o.w - nw : h.includes('e') ? 0 : (o.w - nw) / 2;
    const y1 = h.includes('n') ? o.h - nh : h.includes('s') ? 0 : (o.h - nh) / 2;
    const [ncx, ncy] = rotPt(o.x + x1 + nw / 2, o.y + y1 + nh / 2, cx, cy, a);
    el.w = nw;
    el.h = nh;
    el.x = ncx - nw / 2;
    el.y = ncy - nh / 2;
    bump(el);
  }

  /* --- Girar i invertir --- */
  function rotationCenter(sel) {
    if (sel.length === 1) return R.elCenter(sel[0]);
    const b = R.sceneBounds(sel);
    return [b.x + b.w / 2, b.y + b.h / 2];
  }

  /** Gira els elements (a partir de les còpies originals) un angle d al voltant de (cx, cy). */
  function rotateEls(origs, cx, cy, d) {
    for (const [id, o] of origs) {
      const el = byId(id);
      if (!el) continue;
      if (LINEAR.has(o.type) || o.type === 'freedraw') {
        const wp = o.points.map((p) => rotPt(o.x + p[0], o.y + p[1], cx, cy, d));
        el.x = wp[0][0];
        el.y = wp[0][1];
        el.points = wp.map((q) => [round2(q[0] - el.x), round2(q[1] - el.y)]);
      } else {
        const [nx, ny] = rotPt(o.x + o.w / 2, o.y + o.h / 2, cx, cy, d);
        el.x = nx - o.w / 2;
        el.y = ny - o.h / 2;
        el.angle = normAngle((o.angle || 0) + d);
      }
      bump(el);
    }
  }

  function startRotate(wx, wy) {
    const sel = selectedEls();
    const [cx, cy] = rotationCenter(sel);
    drag = {
      type: 'rotate', cx, cy,
      a0: Math.atan2(wy - cy, wx - cx),
      base: sel.length === 1 ? sel[0].angle || 0 : 0,
      origs: new Map(sel.map((el) => [el.id, cloneEl(el)])),
      label: null,
    };
    detachOutside(sel);
  }

  function moveRotate(wx, wy, shift) {
    let target = drag.base + Math.atan2(wy - drag.cy, wx - drag.cx) - drag.a0;
    if (shift) {
      // Maj: passos de 15°
      const step = Math.PI / 12;
      target = Math.round(target / step) * step;
    } else {
      // Petit imant als angles rectes
      const right = Math.round(target / (Math.PI / 2)) * (Math.PI / 2);
      if (Math.abs(target - right) < 0.04) target = right;
    }
    rotateEls(drag.origs, drag.cx, drag.cy, target - drag.base);
    drag.label = Math.round((normAngle(target) * 180) / Math.PI) % 360;
    [drag.lsx, drag.lsy] = toScreen(wx, wy);
  }

  function rotateSelectedBy(d) {
    if (editing) commitText();
    const sel = selectedEls();
    if (!sel.length) return;
    const [cx, cy] = rotationCenter(sel);
    detachOutside(sel);
    rotateEls(new Map(sel.map((el) => [el.id, cloneEl(el)])), cx, cy, d);
    commit();
  }

  /** Inverteix la selecció horitzontalment ('h') o verticalment ('v') respecte al seu centre. */
  function flipSelected(axis) {
    if (editing) commitText();
    const sel = selectedEls();
    if (!sel.length) return;
    detachOutside(sel);
    const b = selectionBounds();
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const horiz = axis === 'h';
    for (const el of sel) {
      if (LINEAR.has(el.type) || el.type === 'freedraw') {
        if (horiz) {
          el.x = 2 * cx - el.x;
          el.points = el.points.map((p) => [-p[0] || 0, p[1]]);
        } else {
          el.y = 2 * cy - el.y;
          el.points = el.points.map((p) => [p[0], -p[1] || 0]);
        }
        if (LINEAR.has(el.type)) normalizeLinear(el);
        else bump(el);
        continue;
      }
      const [ex, ey] = R.elCenter(el);
      if (horiz) el.x = 2 * cx - ex - el.w / 2;
      else el.y = 2 * cy - ey - el.h / 2;
      // Una reflexió inverteix el sentit del gir; el text es manté llegible
      el.angle = normAngle(-(el.angle || 0));
      if (el.type === 'image') {
        if (horiz) el.flipX = !el.flipX;
        else el.flipY = !el.flipY;
      }
      bump(el);
    }
    commit();
  }

  /* --- Punts de línies i fletxes --- */
  function movePoint(wx, wy, shift, skipBind) {
    const el = drag.el;
    let [x, y] = snapPt(wx, wy);
    if (shift && el.points.length > 1) {
      const nb = el.points[drag.index === 0 ? 1 : drag.index - 1];
      const ax = el.x + nb[0], ay = el.y + nb[1];
      const step = Math.PI / 12;
      const a = Math.round(Math.atan2(y - ay, x - ax) / step) * step;
      const l = Math.hypot(x - ax, y - ay);
      x = ax + Math.cos(a) * l;
      y = ay + Math.sin(a) * l;
    }
    el.points[drag.index] = [round2(x - el.x), round2(y - el.y)];
    bump(el);
    if (drag.bindKey) {
      const other = el[drag.bindKey === 'startBinding' ? 'endBinding' : 'startBinding'];
      const exclude = new Set([el.id]);
      if (other && el.points.length === 2) exclude.add(other.id);
      const t = skipBind ? null : bindCandidate(x, y, exclude);
      if (t) el[drag.bindKey] = makeBinding(t, x, y);
      else delete el[drag.bindKey];
    }
    refreshArrow(el, elementMap());
  }

  /* --- Selecció per àrea --- */
  function updateMarquee() {
    const x = Math.min(drag.x0, drag.x1), y = Math.min(drag.y0, drag.y1);
    const w = Math.abs(drag.x1 - drag.x0), h = Math.abs(drag.y1 - drag.y0);
    const ids = S.elements.filter((el) => {
      const b = R.getBounds(el);
      return b.x >= x && b.y >= y && b.x + b.w <= x + w && b.y + b.h <= y + h;
    }).map((el) => el.id);
    setSelection(drag.base.concat(expandToUnits(ids)));
  }

  /* --- Goma --- */
  function eraseAt(wx, wy) {
    const tol = (touchy() ? 12 : 6) / S.view.zoom;
    for (const el of S.elements) {
      if (!erasing.has(el.id) && hitElement(el, wx, wy, tol)) unitIdsFor(el).forEach((id) => erasing.add(id));
    }
  }
  function eraseAlong(wx, wy) {
    const dx = wx - drag.lx, dy = wy - drag.ly;
    const n = Math.max(1, Math.ceil((Math.hypot(dx, dy) * S.view.zoom) / 4));
    for (let i = 1; i <= n; i++) eraseAt(drag.lx + (dx * i) / n, drag.ly + (dy * i) / n);
    drag.lx = wx;
    drag.ly = wy;
  }
  function finishErase() {
    if (erasing.size) {
      removeIds(Array.from(erasing));
      erasing.clear();
      commit();
    }
  }

  /* --- Roda del ratolí / trackpad --- */
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const [sx, sy] = evPos(e);
    let dx = e.deltaX, dy = e.deltaY;
    if (e.deltaMode === 1) { dx *= 16; dy *= 16; } else if (e.deltaMode === 2) { dx *= H; dy *= H; }
    if (e.ctrlKey || e.metaKey) {
      zoomTo(S.view.zoom * Math.exp(-clamp(dy, -60, 60) * 0.01), sx, sy);
      return;
    }
    if (e.shiftKey && !dx) { dx = dy; dy = 0; }
    S.view.x -= dx;
    S.view.y -= dy;
    afterViewChange();
  }, { passive: false });

  // Evita el zoom de pàgina amb gestos a Safari
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  /* =========================================================
   * Text
   * ========================================================= */
  let editing = null;

  function createTextAt(wx, wy, align, angle) {
    const fs = S.style.fontSize;
    const el = newElement('text', wx, wy - (fs * LH) / 2, {
      text: '', fontSize: fs, fontFamily: S.style.fontFamily,
      textAlign: align || S.style.textAlign, w: 0, h: fs * LH, angle: angle || 0,
    });
    S.elements.push(el);
    startEditText(el, true);
  }

  function startEditText(el, isNew) {
    if (editing) commitText();
    S.selected = new Set();
    updateProps();
    editing = { el, isNew, ref: textRef(el) };
    el._editing = true;
    ta.value = el.text || '';
    ta.hidden = false;
    positionEditor();
    ta.focus({ preventScroll: true });
    const n = ta.value.length;
    ta.setSelectionRange(n, n);
    requestRender();
  }

  /** Punt fix del text mentre s'escriu (vora superior, segons l'alineació), en coordenades del món. */
  function textRef(el) {
    const f = alignFactor(el.textAlign);
    return rotPt(el.x + el.w * f, el.y, el.x + el.w / 2, el.y + el.h / 2, el.angle || 0);
  }
  /** Col·loca el text perquè el seu punt fix coincideixi amb ref, tenint en compte el gir. */
  function placeFromRef(el, ref) {
    const f = alignFactor(el.textAlign);
    const [dx, dy] = rotPt(el.w * f - el.w / 2, -el.h / 2, 0, 0, el.angle || 0);
    el.x = ref[0] - dx - el.w / 2;
    el.y = ref[1] - dy - el.h / 2;
  }

  function positionEditor() {
    if (!editing) return;
    const el = editing.el;
    const z = S.view.zoom;
    const m = R.measureText(ta.value, el.fontSize, el.fontFamily);
    el.w = m.w;
    el.h = m.h;
    placeFromRef(el, editing.ref);
    refreshBindings(new Set([el.id]));
    const [sx, sy] = toScreen(el.x, el.y);
    const s = ta.style;
    s.left = sx + 'px';
    s.top = sy + 'px';
    s.font = el.fontSize * z + 'px ' + R.FONTS[el.fontFamily];
    s.lineHeight = String(LH);
    s.width = Math.ceil(m.w * z + 4) + 'px';
    s.height = Math.ceil(m.h * z) + 'px';
    s.color = R.themeColor(el.stroke, S.theme);
    s.textAlign = el.textAlign;
    s.opacity = String((el.opacity == null ? 100 : el.opacity) / 100);
    s.marginLeft = -2 * alignFactor(el.textAlign) + 'px';
    s.transformOrigin = (m.w * z) / 2 + 2 * alignFactor(el.textAlign) + 'px ' + (m.h * z) / 2 + 'px';
    s.transform = el.angle ? 'rotate(' + el.angle + 'rad)' : '';
  }

  function commitText() {
    if (!editing) return;
    const { el, isNew } = editing;
    editing = null;
    el._editing = false;
    ta.hidden = true;
    if (document.activeElement === ta) ta.blur();
    const text = ta.value.replace(/\s+$/, '');
    if (!text.trim()) {
      removeIds([el.id]);
      if (!isNew) commit();
      updateUI();
      requestRender();
      return;
    }
    const ref = textRef(el);
    if (el.text !== text) { el.text = text; bump(el); }
    measureTextEl(el);
    placeFromRef(el, ref);
    if (!S.locked && S.tool === 'text') setTool('selection');
    setSelection([el.id]);
    commit();
  }

  ta.addEventListener('input', positionEditor);
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      commitText();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const s = ta.selectionStart;
      ta.setRangeText('    ', s, ta.selectionEnd, 'end');
      positionEditor();
    }
  });
  ta.addEventListener('blur', () => {
    // Si el focus ha anat a un altre control (botó, menú…), es confirma el text
    if (editing && pointers.size === 0) setTimeout(() => { if (editing && document.activeElement !== ta) commitText(); }, 0);
  });

  /* =========================================================
   * Eines i interfície
   * ========================================================= */
  function setTool(t) {
    if (t === 'image') { openImagePicker(); return; }
    if (editing) commitText();
    if (t === 'eyedropper' && S.tool !== 'eyedropper') eyedropPrev = S.tool;
    S.tool = t;
    if (cpEyedrop) setCpEyedrop(false);
    hoverId = null;
    bindHintId = null;
    if (t !== 'selection') { S.editingGroup = null; setSelection([]); }
    for (const b of $$('[data-tool]', toolbar)) {
      if (b.dataset.tool !== 'lock') b.setAttribute('aria-pressed', String(b.dataset.tool === t));
    }
    setCursor(baseCursor());
    updateProps();
    requestRender();
  }

  function toggleLock() {
    S.locked = !S.locked;
    updateUI();
    saveSoon();
    toast(S.locked ? 'L\'eina es mantindrà activa després de dibuixar' : 'L\'eina tornarà a la selecció després de dibuixar');
  }
  function toggleGrid() {
    S.grid = !S.grid;
    updateUI();
    saveSoon();
    requestRender();
  }

  /* --- Pas de les fletxes (preferència desada) --- */
  const nudgeInput = $('#nudge-input');
  function setNudge(v) {
    const n = Math.round(+v);
    if (!isFinite(n) || n < 1) return false;
    S.nudge = Math.min(n, 500);
    updateNudgeUI();
    saveSoon();
    return true;
  }
  function updateNudgeUI() {
    for (const b of $$('#nudge-seg [data-step]')) b.classList.toggle('active', +b.dataset.step === S.nudge);
    if (document.activeElement !== nudgeInput) nudgeInput.value = S.nudge;
  }
  $('#nudge-seg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-step]');
    if (b) setNudge(b.dataset.step);
  });
  nudgeInput.addEventListener('input', () => setNudge(nudgeInput.value));
  nudgeInput.addEventListener('change', () => {
    if (!setNudge(nudgeInput.value)) nudgeInput.value = S.nudge;
    else nudgeInput.value = S.nudge;
  });
  /* --- Fons de la pissarra (es desa amb el dibuix) --- */
  function validBg(c) {
    if (typeof c !== 'string') return null;
    c = c.trim().toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(c)) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    return /^#[0-9a-f]{6}$/.test(c) ? c : null;
  }
  function setBackground(c) {
    S.background = validBg(c);
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', R.canvasBg(S.theme, S.background));
    updateBgUI();
    saveSoon();
    requestRender();
  }
  /* --- Imatge de fons de la pissarra (es desa amb el dibuix) --- */
  function validBgImage(o) {
    if (!o || typeof o !== 'object' || typeof o.fileId !== 'string' || !files[o.fileId]) return null;
    return {
      fileId: o.fileId,
      mode: ['cover', 'contain', 'tile'].includes(o.mode) ? o.mode : 'cover',
      opacity: clamp(Math.round(+o.opacity || 100), 10, 100),
      w: Math.max(1, +o.w || 1),
      h: Math.max(1, +o.h || 1),
    };
  }
  /** Imatges del dibuix: les dels elements i la del fons. */
  function sceneFiles() {
    const out = usedFiles(S.elements);
    if (S.bgImage && files[S.bgImage.fileId]) out[S.bgImage.fileId] = files[S.bgImage.fileId];
    return out;
  }
  function setBgImage(o) {
    S.bgImage = validBgImage(o);
    updateBgImageUI();
    saveSoon();
    requestRender();
  }
  function updateBgImageUI() {
    const b = S.bgImage;
    $('#bgimg-pick').hidden = !!b;
    $('#bgimg-set').hidden = !b;
    if (!b) return;
    $('#bgimg-thumb').style.backgroundImage = 'url("' + files[b.fileId] + '")';
    for (const x of $$('#bgimg-mode [data-mode]')) x.classList.toggle('active', x.dataset.mode === b.mode);
    $('#bgimg-opacity').value = b.opacity;
    $('#bgimg-op-out').textContent = b.opacity + '%';
  }
  /** Redueix la imatge (màx. 2048 px) i la desa en JPEG si no té transparència, per ocupar poc. */
  async function setBgImageFromFile(file) {
    try {
      const img = await loadImage(await readAsDataURL(file));
      const iw = img.naturalWidth || 1, ih = img.naturalHeight || 1;
      const s = Math.min(1, 2048 / Math.max(iw, ih));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(iw * s));
      c.height = Math.max(1, Math.round(ih * s));
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0, c.width, c.height);
      const px = x.getImageData(0, 0, c.width, c.height).data;
      let alpha = false;
      for (let i = 3; i < px.length; i += 4) if (px[i] < 250) { alpha = true; break; }
      const url = alpha ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.86);
      const prev = S.bgImage;
      const fid = 'bg_' + uid();
      files[fid] = url;
      setBgImage({ fileId: fid, mode: prev ? prev.mode : 'cover', opacity: prev ? prev.opacity : 100, w: c.width, h: c.height });
      if (prev) delete files[prev.fileId];
      toast('Imatge de fons posada');
    } catch (err) {
      toast('No s\'ha pogut carregar la imatge');
    }
  }
  const fileBg = $('#file-bg');
  const pickBgFile = () => { fileBg.value = ''; fileBg.click(); };
  $('#bgimg-pick').addEventListener('click', pickBgFile);
  $('#bgimg-change').addEventListener('click', pickBgFile);
  fileBg.addEventListener('change', () => {
    const f = fileBg.files && fileBg.files[0];
    if (f) setBgImageFromFile(f);
  });
  $('#bgimg-remove').addEventListener('click', () => {
    const prev = S.bgImage;
    setBgImage(null);
    if (prev) delete files[prev.fileId];
    toast('S\'ha tret la imatge de fons');
  });
  $('#bgimg-mode').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]');
    if (!b || !S.bgImage) return;
    S.bgImage.mode = b.dataset.mode;
    updateBgImageUI();
    saveSoon();
    requestRender();
  });
  $('#bgimg-opacity').addEventListener('input', (e) => {
    if (!S.bgImage) return;
    S.bgImage.opacity = clamp(+e.target.value, 10, 100);
    $('#bgimg-op-out').textContent = S.bgImage.opacity + '%';
    saveSoon();
    requestRender();
  });

  function updateBgUI() {
    updateBgImageUI();
    const v = S.background;
    let matched = false;
    for (const b of $$('#bg-swatches [data-bg]')) {
      if (b.dataset.bg !== 'default') b.style.setProperty('--c', R.canvasBg(S.theme, b.dataset.bg));
      const on = b.dataset.bg === 'default' ? !v : b.dataset.bg === v;
      b.classList.toggle('active', on);
      if (on) matched = true;
    }
    const custom = $('#bg-swatches .swatch-custom');
    custom.classList.toggle('active', !matched);
    custom.style.setProperty('--c', R.canvasBg(S.theme, v));
    if (picker.key === 'bg') refreshPicker();
  }
  $('#bg-swatches').addEventListener('click', (e) => {
    const b = e.target.closest('[data-bg]');
    if (b) setBackground(b.dataset.bg === 'default' ? null : b.dataset.bg);
  });

  nudgeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { nudgeInput.blur(); closeMenu(); }
  });
  function toggleTheme() {
    S.theme = S.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    saveSoon();
  }

  function applyTheme() {
    document.documentElement.dataset.theme = S.theme;
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', R.canvasBg(S.theme, S.background));
    updateBgUI();
    if (picker.key) buildPickerSwatches();
    for (const sw of $$('.swatch[data-value]')) {
      const v = sw.dataset.value;
      if (v !== 'transparent') sw.style.setProperty('--c', R.themeColor(v, S.theme));
    }
    const label = S.theme === 'dark' ? 'Tema clar' : 'Tema fosc';
    $('#menu-theme span').textContent = label;
    $('#theme-btn').title = S.theme === 'dark' ? 'Canvia a tema clar' : 'Canvia a tema fosc';
    $('#theme-btn').setAttribute('aria-label', $('#theme-btn').title);
    if (editing) positionEditor();
    updateProps();
    requestRender();
  }

  /** Tipus d'element que afecta el panell d'estil (selecció o eina activa). */
  function contextTypes() {
    const sel = selectedEls();
    if (sel.length) return new Set(sel.map((e) => e.type));
    if (CREATE_TOOLS.has(S.tool)) return new Set([S.tool]);
    if (editing) return new Set(['text']);
    return new Set();
  }

  const bucketMode = () => S.tool === 'bucket' && !S.selected.size && !editing;
  const contextHasShape = () => bucketMode() || Array.from(contextTypes()).some((t) => SHAPES.has(t));

  function currentValue(key) {
    const target = editing ? [editing.el] : selectedEls();
    const el = target.find((e) => appliesTo(key, e.type) && (key !== 'stroke' || e.stroke !== 'transparent' || SHAPES.has(e.type)));
    if (el) return el[key];
    if (key === 'stroke' && S.style.stroke === 'transparent' && !contextHasShape()) return S.style.lastStroke || '#1e1e1e';
    return S.style[key];
  }

  function updateProps() {
    const types = contextTypes();
    const sel = selectedEls();
    const any = (key) => Array.from(types).some((t) => appliesTo(key, t));
    const bucket = bucketMode();
    const show = types.size > 0 || bucket;
    propsEl.classList.toggle('visible', show);
    const tgl = $('#props-toggle');
    tgl.hidden = !show;
    tgl.setAttribute('aria-expanded', String(show && propsEl.classList.contains('open')));

    for (const sec of $$('[data-prop]', propsEl)) {
      const key = sec.dataset.prop;
      let vis;
      if (bucket) {
        // Pot de pintura: només el color (i l'emplenat) que es farà servir
        const tgt = S.style.bucketTarget;
        vis = key === 'bucketTarget' || key === tgt || (key === 'fillStyle' && tgt === 'fill' && S.style.fill !== 'transparent');
      } else if (key === 'bucketTarget') vis = false;
      else if (key === 'layers' || key === 'actions' || key === 'transform') vis = sel.length > 0;
      else if (key === 'align') vis = sel.length > 1;
      else if (key === 'fillStyle') vis = any('fillStyle') && currentValue('fill') !== 'transparent';
      else vis = any(key);
      sec.hidden = !vis;
    }
    if (sel.length) {
      const units = selectionUnits();
      $('[data-action="group"]', propsEl).disabled = units.length < 2;
      $('[data-action="ungroup"]', propsEl).disabled = !sel.some((el) => targetGroup(el));
    }
    // El traç transparent només té sentit per a rectangles, rombes i el·lipses
    $('.swatches[data-key="stroke"] [data-value="transparent"]', propsEl).disabled = !contextHasShape();

    for (const group of $$('[data-key]', propsEl)) {
      const key = group.dataset.key;
      const v = currentValue(key);
      if (group.tagName === 'INPUT') {
        if (group.type === 'range') {
          group.value = v;
          $('#opacity-out').textContent = v;
        }
        continue;
      }
      let matched = false;
      for (const b of $$('button[data-value]', group)) {
        const on = String(b.dataset.value).toLowerCase() === String(v).toLowerCase();
        b.classList.toggle('active', on);
        if (on) matched = true;
      }
      const custom = $('.swatch-custom', group);
      if (custom) {
        custom.classList.toggle('active', !matched && v !== 'transparent');
        custom.style.setProperty('--c', R.themeColor(v, S.theme));
      }
    }
    if (picker.key === 'stroke' || picker.key === 'fill') {
      // Si la propietat ja no es pot editar (canvi de selecció), es tanca el selector
      const sec = $('[data-prop="' + picker.key + '"]', propsEl);
      if (!propsEl.classList.contains('visible') || (sec && sec.hidden)) closePicker();
      else refreshPicker();
    }
  }

  function setProp(key, value, doCommit) {
    if (doCommit === undefined) doCommit = true;
    if (key !== 'arrowheads' || !singleLineSelected()) S.style[key] = value;
    if (key === 'stroke' && value !== 'transparent') S.style.lastStroke = value;
    const targets = editing ? [editing.el] : selectedEls();
    for (const el of targets) {
      if (!appliesTo(key, el.type)) continue;
      if (key === 'stroke' && value === 'transparent' && !SHAPES.has(el.type)) continue;
      el[key] = value;
      if (editing && el === editing.el && key === 'textAlign') editing.ref = textRef(el);
      if (el.type === 'text' && (key === 'fontSize' || key === 'fontFamily') && !el._editing) measureTextEl(el);
      bump(el);
    }
    if (editing) { positionEditor(); ta.focus({ preventScroll: true }); }
    updateProps();
    requestRender();
    if (doCommit && !editing) commit();
    else saveSoon();
  }
  function singleLineSelected() {
    const sel = selectedEls();
    return sel.length > 0 && sel.every((e) => e.type === 'line');
  }

  function updateUI() {
    for (const b of $$('[data-tool]', toolbar)) {
      if (b.dataset.tool === 'lock') b.setAttribute('aria-pressed', String(S.locked));
      else b.setAttribute('aria-pressed', String(b.dataset.tool === S.tool));
    }
    $('#undo-btn').disabled = history.index <= 0;
    $('#redo-btn').disabled = history.index >= history.stack.length - 1;
    $('#zoom-label').textContent = Math.round(S.view.zoom * 100) + '%';
    $('#menu-grid').setAttribute('aria-checked', String(S.grid));
    updateNudgeUI();
    updateProps();
  }

  /* =========================================================
   * Selector de color propi (substitueix la finestra del sistema)
   * ========================================================= */
  // Paleta Open Color (la mateixa família de colors que fa servir l'Excalidraw)
  const OC = {
    gris: ['#f8f9fa', '#f1f3f5', '#e9ecef', '#dee2e6', '#ced4da', '#adb5bd', '#868e96', '#495057', '#343a40', '#212529'],
    vermell: ['#fff5f5', '#ffe3e3', '#ffc9c9', '#ffa8a8', '#ff8787', '#ff6b6b', '#fa5252', '#f03e3e', '#e03131', '#c92a2a'],
    rosa: ['#fff0f6', '#ffdeeb', '#fcc2d7', '#faa2c1', '#f783ac', '#f06595', '#e64980', '#d6336c', '#c2255c', '#a61e4d'],
    'raïm': ['#f8f0fc', '#f3d9fa', '#eebefa', '#e599f7', '#da77f2', '#cc5de8', '#be4bdb', '#ae3ec9', '#9c36b5', '#862e9c'],
    violeta: ['#f3f0ff', '#e5dbff', '#d0bfff', '#b197fc', '#9775fa', '#845ef7', '#7950f2', '#7048e8', '#6741d9', '#5f3dc4'],
    blau: ['#e7f5ff', '#d0ebff', '#a5d8ff', '#74c0fc', '#4dabf7', '#339af0', '#228be6', '#1c7ed6', '#1971c2', '#1864ab'],
    cian: ['#e3fafc', '#c5f6fa', '#99e9f2', '#66d9e8', '#3bc9db', '#22b8cf', '#15aabf', '#1098ad', '#0c8599', '#0b7285'],
    'verd blavós': ['#e6fcf5', '#c3fae8', '#96f2d7', '#63e6be', '#38d9a9', '#20c997', '#12b886', '#0ca678', '#099268', '#087f5b'],
    verd: ['#ebfbee', '#d3f9d8', '#b2f2bb', '#8ce99a', '#69db7c', '#51cf66', '#40c057', '#37b24d', '#2f9e44', '#2b8a3e'],
    groc: ['#fff9db', '#fff3bf', '#ffec99', '#ffe066', '#ffd43b', '#fcc419', '#fab005', '#f59f00', '#f08c00', '#e67700'],
    taronja: ['#fff4e6', '#ffe8cc', '#ffd8a8', '#ffc078', '#ffa94d', '#ff922b', '#fd7e14', '#f76707', '#e8590c', '#d9480f'],
  };
  const OC_SHADES = [0, 2, 4, 6, 8, 9];
  const PICKER_TITLES = { stroke: 'Color del traç', fill: 'Color del fons', bg: 'Fons de la pissarra' };

  const cpEl = $('#color-picker');
  const cpSv = $('#cp-sv');
  const cpHandle = $('#cp-sv-handle');
  const cpHue = $('#cp-hue');
  const cpHex = $('#cp-hex');
  const picker = { key: null, anchor: null, h: 0, s: 0, v: 0, value: null, changed: false };

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return [h, max ? d / max : 0, max];
  }
  function hsvToHex(h, s, v) {
    const f = (n) => {
      const k = (n + h / 60) % 6;
      return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
    };
    return '#' + [f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  /** Com es veurà el color a la pissarra amb el tema actual. */
  const shownColor = (v) => (picker.key === 'bg' ? R.canvasBg(S.theme, v) : R.themeColor(v, S.theme));

  function pickerCurrent() {
    if (picker.key === 'bg') return S.background;
    return currentValue(picker.key);
  }

  function makeSwatch(value, title, extraClass) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cp-sw' + (extraClass ? ' ' + extraClass : '');
    b.dataset.color = value;
    b.title = title;
    b.setAttribute('aria-label', title);
    if (value !== 'transparent' && value !== 'default') b.style.setProperty('--c', shownColor(value));
    return b;
  }

  function buildPickerSwatches() {
    const basics = $('#cp-basics');
    basics.textContent = '';
    if (picker.key === 'bg') basics.append(makeSwatch('default', 'Per defecte del tema', 'swatch-default'));
    else {
      const none = makeSwatch('transparent', picker.key === 'stroke' ? 'Sense traç (només formes)' : 'Sense fons', 'swatch-none');
      if (picker.key === 'stroke' && !contextHasShape()) none.disabled = true;
      basics.append(none);
    }
    basics.append(makeSwatch('#1e1e1e', 'Tinta (#1e1e1e)'), makeSwatch('#ffffff', 'Blanc (#ffffff)'));

    const pal = $('#cp-palette');
    pal.textContent = '';
    const names = Object.keys(OC);
    for (const shade of OC_SHADES) {
      for (const name of names) {
        const hex = OC[name][shade];
        pal.append(makeSwatch(hex, name.charAt(0).toUpperCase() + name.slice(1) + ' ' + shade + ' (' + hex + ')'));
      }
    }

    const rec = $('#cp-recent');
    rec.textContent = '';
    for (const c of S.recentColors) rec.append(makeSwatch(c, 'Recent (' + c + ')'));
    $('#cp-recent-wrap').hidden = !S.recentColors.length;
    $('#cp-note').hidden = S.theme !== 'dark';
    markActiveSwatch();
  }

  function markActiveSwatch() {
    const v = picker.value == null ? (picker.key === 'bg' ? 'default' : 'transparent') : picker.value;
    for (const b of $$('.cp-sw', cpEl)) b.classList.toggle('active', b.dataset.color === v);
  }

  /** Actualitza el quadre, la barra de to, l'hexadecimal i la mostra a partir de picker.h/s/v i picker.value. */
  function renderPicker(syncHex) {
    cpSv.style.setProperty('--hue', String(Math.round(picker.h)));
    cpHandle.style.left = picker.s * 100 + '%';
    cpHandle.style.top = (1 - picker.v) * 100 + '%';
    cpHandle.style.background = hsvToHex(picker.h, picker.s, picker.v);
    cpSv.setAttribute('aria-valuetext', 'Saturació ' + Math.round(picker.s * 100) + '%, brillantor ' + Math.round(picker.v * 100) + '%');
    cpHue.value = Math.round(picker.h) % 360;
    const v = picker.value;
    const pv = $('#cp-preview');
    const none = v == null || v === 'transparent';
    pv.classList.toggle('is-none', none && picker.key !== 'bg');
    pv.style.setProperty('--c', none ? (picker.key === 'bg' ? R.canvasBg(S.theme, null) : 'transparent') : shownColor(v));
    if (syncHex && document.activeElement !== cpHex) cpHex.value = none ? '' : v.slice(1);
    cpHex.placeholder = none ? (picker.key === 'bg' ? 'per defecte' : 'transparent') : '';
    $('.cp-hex', cpEl).classList.remove('invalid');
    markActiveSwatch();
  }

  /** Torna a llegir el valor actual (selecció o fons) sense perdre el to quan el color és gris. */
  function refreshPicker() {
    if (!picker.key) return;
    const cur = pickerCurrent();
    const val = cur && /^#[0-9a-f]{6}$/i.test(cur) ? cur.toLowerCase() : cur === 'transparent' ? 'transparent' : null;
    if (val === picker.value) return;
    picker.value = val;
    if (val && val !== 'transparent') {
      const [h, s, v] = rgbToHsv(...hexToRgb(val));
      if (s > 0.001 && v > 0.001) picker.h = h;
      picker.s = s;
      picker.v = v;
    }
    renderPicker(true);
  }

  /** Aplica un color des del selector (live: sense entrada nova a l'historial fins que es tanca). */
  function applyPicked(val, syncHex) {
    picker.value = val;
    picker.changed = true;
    if (picker.key === 'bg') setBackground(val);
    else setProp(picker.key, val || 'transparent', false);
    renderPicker(syncHex);
  }
  function applyHsv() {
    applyPicked(hsvToHex(picker.h, picker.s, picker.v), true);
  }

  function placePicker() {
    if (window.matchMedia('(max-width: 640px)').matches || !picker.anchor) {
      cpEl.style.left = cpEl.style.top = '';
      return;
    }
    const a = picker.anchor.getBoundingClientRect();
    const host = picker.anchor.closest('.props, .menu');
    const hr = host ? host.getBoundingClientRect() : a;
    const pw = cpEl.offsetWidth, ph = cpEl.offsetHeight;
    let x = hr.right + 10;
    if (x + pw > W - 8) x = Math.max(8, hr.left - pw - 10);
    if (x + pw > W - 8) x = Math.max(8, W - pw - 8);
    const y = clamp(a.top - 40, 8, Math.max(8, H - ph - 8));
    cpEl.style.left = Math.round(x) + 'px';
    cpEl.style.top = Math.round(y) + 'px';
  }

  function openPicker(key, anchor) {
    if (picker.key === key) { closePicker(); return; }
    if (picker.key) closePicker();
    if (editing && key !== 'bg') commitText();
    picker.key = key;
    picker.anchor = anchor;
    picker.changed = false;
    picker.value = undefined;
    picker.h = 0; picker.s = 0; picker.v = 0;
    $('#cp-title').textContent = PICKER_TITLES[key];
    cpEl.setAttribute('aria-label', PICKER_TITLES[key]);
    buildPickerSwatches();
    cpEl.hidden = false;
    refreshPicker();
    if (picker.value === undefined) renderPicker(true);
    placePicker();
    for (const b of $$('[data-picker]')) b.setAttribute('aria-expanded', String(b === anchor));
  }

  function closePicker(restoreFocus) {
    if (!picker.key) return;
    const key = picker.key;
    const anchor = picker.anchor;
    // El focus no pot quedar dins del selector amagat (bloquejaria les dreceres de teclat)
    if (cpEl.contains(document.activeElement)) {
      if (restoreFocus && anchor && anchor.offsetParent) anchor.focus({ preventScroll: true });
      else document.activeElement.blur();
    }
    const val = picker.value;
    if (picker.changed) {
      if (val && /^#[0-9a-f]{6}$/.test(val)) {
        S.recentColors = [val].concat(S.recentColors.filter((c) => c !== val)).slice(0, 11);
      }
      if (key !== 'bg' && !editing) commit();
      saveSoon();
    }
    if (cpEyedrop) setCpEyedrop(false);
    picker.key = null;
    picker.anchor = null;
    cpEl.hidden = true;
    for (const b of $$('[data-picker]')) b.setAttribute('aria-expanded', 'false');
  }

  // Obrir des de qualsevol mostra «Més colors…»
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-picker]');
    if (b) openPicker(b.dataset.picker, b);
  });
  // Clic fora: tanca (i, si és sobre el llenç, no fa res més)
  document.addEventListener('pointerdown', (e) => {
    if (!picker.key || cpEl.contains(e.target) || e.target.closest('[data-picker]')) return;
    if (cpEyedrop && e.target === canvas) return; // el clic és per agafar el color
    closePicker();
    if (e.target === canvas) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  window.addEventListener('resize', () => { if (picker.key) placePicker(); });

  // Mostres
  cpEl.addEventListener('click', (e) => {
    const b = e.target.closest('.cp-sw');
    if (!b || b.disabled) return;
    const c = b.dataset.color;
    if (c === 'default' || c === 'transparent') { applyPicked(null, true); return; }
    const [h, s, v] = rgbToHsv(...hexToRgb(c));
    if (s > 0.001 && v > 0.001) picker.h = h;
    picker.s = s;
    picker.v = v;
    applyPicked(c, true);
  });
  $('#cp-close').addEventListener('click', () => closePicker(true));

  // Quadre de saturació i brillantor
  function svFromEvent(e) {
    const r = cpSv.getBoundingClientRect();
    picker.s = clamp((e.clientX - r.left) / r.width, 0, 1);
    picker.v = clamp(1 - (e.clientY - r.top) / r.height, 0, 1);
    applyHsv();
  }
  cpSv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    cpSv.focus({ preventScroll: true });
    try { cpSv.setPointerCapture(e.pointerId); } catch (_) { /* res */ }
    svFromEvent(e);
  });
  cpSv.addEventListener('pointermove', (e) => { if (cpSv.hasPointerCapture && cpSv.hasPointerCapture(e.pointerId)) svFromEvent(e); });
  cpSv.addEventListener('keydown', (e) => {
    const st = e.shiftKey ? 0.1 : 0.02;
    if (e.key === 'ArrowLeft') picker.s = clamp(picker.s - st, 0, 1);
    else if (e.key === 'ArrowRight') picker.s = clamp(picker.s + st, 0, 1);
    else if (e.key === 'ArrowUp') picker.v = clamp(picker.v + st, 0, 1);
    else if (e.key === 'ArrowDown') picker.v = clamp(picker.v - st, 0, 1);
    else return;
    e.preventDefault();
    applyHsv();
  });
  // Barra de to
  cpHue.addEventListener('input', () => {
    picker.h = +cpHue.value;
    if (picker.value == null || picker.value === 'transparent' || picker.s < 0.01) {
      // Si no hi havia color (o era gris), es pren un color viu del to triat
      picker.s = Math.max(picker.s, 0.75);
      picker.v = Math.max(picker.v, 0.85);
    }
    applyHsv();
  });
  // Codi hexadecimal
  cpHex.addEventListener('input', () => {
    let t = cpHex.value.trim().replace(/^#/, '').toLowerCase();
    if (/^[0-9a-f]{3}$/.test(t)) t = t.replace(/./g, (c) => c + c);
    if (/^[0-9a-f]{6}$/.test(t)) {
      const c = '#' + t;
      const [h, s, v] = rgbToHsv(...hexToRgb(c));
      if (s > 0.001 && v > 0.001) picker.h = h;
      picker.s = s;
      picker.v = v;
      applyPicked(c, false);
    } else {
      $('.cp-hex', cpEl).classList.toggle('invalid', t.length >= 3);
    }
  });
  cpHex.addEventListener('blur', () => renderPicker(true));
  cpHex.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); closePicker(true); } });
  // Comptagotes: el següent clic a la pissarra agafa el color d'un element o del fons
  $('#cp-eyedrop').addEventListener('click', () => setCpEyedrop(!cpEyedrop));
  function pickerApplyColor(c) {
    const [h, s, v] = rgbToHsv(...hexToRgb(c));
    if (s > 0.001 && v > 0.001) picker.h = h;
    picker.s = s;
    picker.v = v;
    applyPicked(c, true);
  }
  // Dins del selector, les tecles no activen les dreceres de la pissarra
  cpEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (cpEyedrop) setCpEyedrop(false); else closePicker(true);
    }
    if (!e.ctrlKey && !e.metaKey) e.stopPropagation();
  });

  /* =========================================================
   * Pot de pintura i comptagotes
   * ========================================================= */
  let hoverId = null; // element ressaltat amb el pot o el comptagotes
  let cpEyedrop = false; // comptagotes del selector de color actiu
  let eyedropPrev = 'selection'; // eina a la qual es torna després del comptagotes

  /** Punt dins de la forma (rectangle, rombe o el·lipse), tingui fons o no. */
  function insideShapeGeom(el, wx, wy) {
    if (el.angle) {
      const c = R.elCenter(el);
      [wx, wy] = rotPt(wx, wy, c[0], c[1], -el.angle);
    }
    const lx = wx - el.x, ly = wy - el.y, hw = el.w / 2, hh = el.h / 2;
    if (lx < 0 || ly < 0 || lx > el.w || ly > el.h) return false;
    if (el.type === 'ellipse') return hw > 0 && hh > 0 && ((lx - hw) / hw) ** 2 + ((ly - hh) / hh) ** 2 <= 1;
    if (el.type === 'diamond') return hw > 0 && hh > 0 && Math.abs(lx - hw) / hw + Math.abs(ly - hh) / hh <= 1;
    return true;
  }
  /** Element de més amunt sota el punter; l'interior de les formes compta encara que no tinguin fons. */
  function bucketHit(wx, wy) {
    const tol = (touchy() ? 12 : 6) / S.view.zoom;
    for (let i = S.elements.length - 1; i >= 0; i--) {
      const el = S.elements[i];
      if (hitElement(el, wx, wy, tol) || (SHAPES.has(el.type) && insideShapeGeom(el, wx, wy))) return el;
    }
    return null;
  }

  /* --- Pot de pintura --- */
  function paintEl(el) {
    if (drag.origs.has(el.id)) return;
    const tgt = S.style.bucketTarget;
    if (el.type === 'image') { drag.reason = drag.reason || 'image'; return; }
    if (tgt === 'fill') {
      if (!SHAPES.has(el.type)) { drag.reason = drag.reason || 'nofill'; return; }
      if (el.fill === S.style.fill && (el.fillStyle === S.style.fillStyle || S.style.fill === 'transparent')) { drag.reason = drag.reason || 'same'; return; }
      drag.origs.set(el.id, { fill: el.fill, fillStyle: el.fillStyle });
      el.fill = S.style.fill;
      el.fillStyle = S.style.fillStyle;
    } else {
      let c = S.style.stroke;
      if (c === 'transparent' && !SHAPES.has(el.type)) { drag.reason = drag.reason || 'notransparent'; return; }
      if (el.stroke === c) { drag.reason = drag.reason || 'same'; return; }
      drag.origs.set(el.id, { stroke: el.stroke });
      el.stroke = c;
    }
    bump(el);
  }
  function paintAt(wx, wy) {
    const el = bucketHit(wx, wy);
    if (el) paintEl(el);
  }
  function paintAlong(wx, wy) {
    const dx = wx - drag.lx, dy = wy - drag.ly;
    const n = Math.max(1, Math.ceil((Math.hypot(dx, dy) * S.view.zoom) / 6));
    for (let i = 1; i <= n; i++) paintAt(drag.lx + (dx * i) / n, drag.ly + (dy * i) / n);
    drag.lx = wx;
    drag.ly = wy;
  }
  function finishPaint(d) {
    if (d.origs.size) { commit(); return; }
    const msg = {
      nofill: 'Les línies, el llapis i el text no tenen fons. Tria «Traç» a «Pinta» per canviar-ne el color.',
      notransparent: 'El traç transparent només es pot posar a les formes.',
      image: 'Les imatges no es poden pintar.',
    }[d.reason];
    if (msg) toast(msg, 4000);
  }

  /* --- Comptagotes --- */
  const imgSampler = new Map();
  /** Color d'un píxel d'una imatge inserida (o null si és transparent). */
  async function getSampler(fileId) {
    const src = files[fileId];
    if (!src) return null;
    let entry = imgSampler.get(fileId);
    if (!entry || entry.src !== src) {
      const img = new Image();
      img.src = src;
      try { await img.decode(); } catch (_) { return null; }
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || 1;
      c.height = img.naturalHeight || 1;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0);
      entry = { src, ctx: x, w: c.width, h: c.height };
      imgSampler.set(fileId, entry);
    }
    return entry;
  }
  function pixelHex(entry, px, py) {
    px = clamp(Math.floor(px), 0, entry.w - 1);
    py = clamp(Math.floor(py), 0, entry.h - 1);
    const d = entry.ctx.getImageData(px, py, 1, 1).data;
    if (d[3] < 16) return null;
    return '#' + [d[0], d[1], d[2]].map((n) => n.toString(16).padStart(2, '0')).join('');
  }
  async function sampleImage(el, wx, wy) {
    const entry = await getSampler(el.fileId);
    if (!entry) return null;
    if (el.angle) {
      const ce = R.elCenter(el);
      [wx, wy] = rotPt(wx, wy, ce[0], ce[1], -el.angle);
    }
    let u = (wx - el.x) / el.w, v = (wy - el.y) / el.h;
    if (el.flipX) u = 1 - u;
    if (el.flipY) v = 1 - v;
    return pixelHex(entry, u * entry.w, v * entry.h);
  }
  /** Color de la imatge de fons en un punt (o null si allà no n'hi ha). */
  async function sampleBgImage(wx, wy) {
    const b = S.bgImage;
    const entry = b && (await getSampler(b.fileId));
    if (!entry) return null;
    if (b.mode === 'tile') {
      const mod = (a, n) => ((a % n) + n) % n;
      return pixelHex(entry, mod(wx, entry.w), mod(wy, entry.h));
    }
    const [sx, sy] = toScreen(wx, wy);
    const s = b.mode === 'contain' ? Math.min(W / entry.w, H / entry.h) : Math.max(W / entry.w, H / entry.h);
    const ox = (W - entry.w * s) / 2, oy = (H - entry.h * s) / 2;
    const px = (sx - ox) / s, py = (sy - oy) / s;
    if (px < 0 || py < 0 || px >= entry.w || py >= entry.h) return null;
    return pixelHex(entry, px, py);
  }
  /**
   * Color de la pissarra en un punt: el fons d'una forma (si s'hi fa clic a dins i en té),
   * el traç de l'element, un píxel d'una imatge o, si no hi ha res, el fons de la pissarra.
   * Es retorna el color desat (el de tema clar), no el que es veu en tema fosc.
   */
  async function colorAt(wx, wy) {
    const el = bucketHit(wx, wy);
    if (el) {
      if (el.type === 'image') {
        const c = await sampleImage(el, wx, wy);
        if (c) return { color: c, kind: null, from: 'imatge' };
      } else {
        const hasFill = el.fill && el.fill !== 'transparent';
        const hasStroke = el.stroke && el.stroke !== 'transparent';
        if (SHAPES.has(el.type) && hasFill && insideShapeGeom(el, wx, wy)) return { color: el.fill, kind: 'fill', from: 'fons' };
        if (hasStroke) return { color: el.stroke, kind: 'stroke', from: 'traç' };
        if (hasFill) return { color: el.fill, kind: 'fill', from: 'fons' };
      }
    }
    if (S.bgImage) {
      const c = await sampleBgImage(wx, wy);
      if (c) return { color: c, kind: null, from: 'imatge de fons' };
    }
    return { color: S.background || '#ffffff', kind: null, from: 'pissarra' };
  }

  /**
   * mode 'picker': el color va al selector de color obert.
   * mode 'bucket' (Alt+clic amb el pot): passa a ser el color amb què pinta el pot.
   * mode 'tool' (eina comptagotes): es desa com a color de traç o de fons i es torna a l'eina anterior.
   */
  async function eyedropAt(wx, wy, mode) {
    const res = await colorAt(wx, wy);
    const c = validBg(res.color) || res.color;
    if (!/^#[0-9a-f]{6}$/.test(c)) return;
    if (mode === 'picker') {
      setCpEyedrop(false);
      if (picker.key) pickerApplyColor(c);
      return;
    }
    const kind = mode === 'tool' && res.kind ? res.kind : S.style.bucketTarget;
    S.style[kind] = c;
    if (kind === 'stroke') S.style.lastStroke = c;
    if (mode === 'tool') S.style.bucketTarget = kind;
    saveSoon();
    toast('Color agafat: ' + c + ' (' + (kind === 'fill' ? 'fons' : 'traç') + ')');
    if (mode === 'tool') setTool(eyedropPrev && eyedropPrev !== 'eyedropper' ? eyedropPrev : 'selection');
    else updateProps();
  }

  function setCpEyedrop(on) {
    cpEyedrop = on;
    $('#cp-eyedrop').setAttribute('aria-pressed', String(on));
    if (!on) hoverId = null;
    setCursor(on ? EYEDROP_CURSOR : baseCursor());
    if (on && window.matchMedia('(pointer: coarse)').matches) toast('Toca un element o la pissarra per agafar-ne el color');
    requestRender();
  }

  /* --- Panell de propietats --- */
  const parseVal = (v) => (/^-?\d+(\.\d+)?$/.test(v) ? +v : v);
  propsEl.addEventListener('pointerdown', (e) => {
    // Evita que l'editor de text perdi el focus quan es canvia l'estil mentre s'escriu
    if (editing && e.target.closest('button')) e.preventDefault();
  });
  propsEl.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-value]');
    if (!b) return;
    const group = b.closest('[data-key]');
    if (group) setProp(group.dataset.key, parseVal(b.dataset.value));
  });
  propsEl.addEventListener('input', (e) => {
    const t = e.target;
    if (t.type === 'range') setProp('opacity', +t.value, false);
  });
  propsEl.addEventListener('change', (e) => {
    const t = e.target;
    if (t.type === 'range' && !editing) commit();
  });

  /* --- Barra d'eines --- */
  toolbar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tool]');
    if (!b) return;
    if (b.dataset.tool === 'lock') toggleLock();
    else setTool(b.dataset.tool);
  });

  /* --- Menú --- */
  let menuOpen = false;
  function openMenu() {
    menu.hidden = false;
    menuOpen = true;
    menuBtn.setAttribute('aria-expanded', 'true');
  }
  function closeMenu() {
    if (!menuOpen) return;
    menu.hidden = true;
    menuOpen = false;
    menuBtn.setAttribute('aria-expanded', 'false');
  }
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menuOpen) closeMenu(); else openMenu();
  });
  document.addEventListener('pointerdown', (e) => {
    if (menuOpen && !menu.contains(e.target) && !menuBtn.contains(e.target) && !cpEl.contains(e.target)) closeMenu();
  }, true);

  /* --- Accions (botons amb data-action) --- */
  function runAction(a) {
    switch (a) {
      case 'open': openFilePicker(); break;
      case 'save': openSaveDialog(); break;
      case 'export': openExport(); break;
      case 'image': openImagePicker(); break;
      case 'grid': toggleGrid(); break;
      case 'theme': toggleTheme(); break;
      case 'fit': fitToContent(); break;
      case 'clear': clearCanvas(); break;
      case 'help': closeMenu(); $('#help-dialog').showModal(); break;
      case 'undo': undo(); break;
      case 'redo': redo(); break;
      case 'zoom-in': zoomStep(1); break;
      case 'zoom-out': zoomStep(-1); break;
      case 'zoom-reset': zoomTo(1); break;
      case 'front': case 'back': case 'forward': case 'backward': reorder(a); break;
      case 'duplicate': duplicateSelected(); break;
      case 'group': groupSelected(); break;
      case 'ungroup': ungroupSelected(); break;
      case 'rotate-left': rotateSelectedBy(-Math.PI / 2); break;
      case 'rotate-right': rotateSelectedBy(Math.PI / 2); break;
      case 'flip-h': flipSelected('h'); break;
      case 'flip-v': flipSelected('v'); break;
      case 'delete': deleteSelected(); break;
      case 'props-toggle': {
        const open = !propsEl.classList.contains('open');
        propsEl.classList.toggle('open', open);
        $('#props-toggle').setAttribute('aria-expanded', String(open));
        break;
      }
      default:
        if (a.indexOf('align-') === 0) alignSelected(a.slice(6));
    }
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b || b.disabled) return;
    if (menu.contains(b)) closeMenu();
    runAction(b.dataset.action);
  });

  /* --- Avisos --- */
  let toastTimer = 0;
  function toast(msg, ms) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms || 2600);
  }

  /* --- Confirmació --- */
  function confirmDialog(msg, okLabel) {
    const dlg = $('#confirm-dialog');
    $('#confirm-msg').textContent = msg;
    $('#confirm-ok').textContent = okLabel || 'D\'acord';
    dlg.returnValue = '';
    dlg.showModal();
    return new Promise((res) => {
      dlg.addEventListener('close', () => res(dlg.returnValue === 'ok'), { once: true });
    });
  }

  async function clearCanvas() {
    if (!S.elements.length) return;
    const ok = await confirmDialog('Vols esborrar tot el dibuix? Ho podràs desfer amb Ctrl+Z.', 'Neteja');
    if (!ok) return;
    if (editing) commitText();
    S.elements = [];
    S.selected.clear();
    commit();
  }

  /* =========================================================
   * Teclat
   * ========================================================= */
  const TOOL_KEYS = {
    v: 'selection', 1: 'selection', h: 'hand', r: 'rectangle', 2: 'rectangle', d: 'diamond', 3: 'diamond',
    o: 'ellipse', 4: 'ellipse', a: 'arrow', 5: 'arrow', l: 'line', 6: 'line', p: 'freedraw', 7: 'freedraw',
    t: 'text', 8: 'text', 9: 'image', e: 'eraser', 0: 'eraser', b: 'bucket', i: 'eyedropper',
  };
  function isTypingTarget(t) {
    if (!t) return false;
    if (t.tagName === 'TEXTAREA' || t.isContentEditable) return true;
    return t.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'color', 'button'].includes(t.type);
  }

  window.addEventListener('keydown', (e) => {
    if (isTypingTarget(e.target)) return;
    if ($('dialog[open]')) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;

    if (e.code === 'Space' && !mod) {
      e.preventDefault();
      if (!spaceDown) { spaceDown = true; if (!drag) setCursor('grab'); }
      return;
    }

    if (mod) {
      if (k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (k === 'y') { e.preventDefault(); redo(); return; }
      if (k === 'a') { e.preventDefault(); setTool('selection'); S.editingGroup = null; setSelection(S.elements.map((el) => el.id)); return; }
      if (k === 'g') { e.preventDefault(); if (e.shiftKey) ungroupSelected(); else groupSelected(); return; }
      if (k === 'd') { e.preventDefault(); duplicateSelected(); return; }
      if (k === 's') { e.preventDefault(); openSaveDialog(); return; }
      if (k === 'o') { e.preventDefault(); openFilePicker(); return; }
      if (k === 'e' && e.shiftKey) { e.preventDefault(); openExport(); return; }
      if (k === '=' || k === '+') { e.preventDefault(); zoomStep(1); return; }
      if (k === '-') { e.preventDefault(); zoomStep(-1); return; }
      if (k === '0') { e.preventDefault(); zoomTo(1); return; }
      if (e.code === 'BracketRight') { e.preventDefault(); reorder(e.shiftKey ? 'front' : 'forward'); return; }
      if (e.code === 'BracketLeft') { e.preventDefault(); reorder(e.shiftKey ? 'back' : 'backward'); return; }
      return;
    }

    if (e.altKey && e.shiftKey && e.code === 'KeyD') { e.preventDefault(); toggleTheme(); return; }
    if (e.altKey && e.shiftKey && e.code === 'KeyR') { e.preventDefault(); rotateSelectedBy(-Math.PI / 2); return; }
    if (e.shiftKey && e.code === 'Digit1') { e.preventDefault(); fitToContent(); return; }
    if (e.altKey) return;

    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        if (S.selected.size) { e.preventDefault(); deleteSelected(); }
        return;
      case 'Escape':
        if (cpEyedrop) { setCpEyedrop(false); return; }
        if (picker.key) { closePicker(); return; }
        if (drag) cancelDrag();
        else if (menuOpen) closeMenu();
        else if (S.editingGroup) {
          // Surt del grup i el deixa seleccionat
          const g = S.editingGroup;
          S.editingGroup = null;
          setSelection(expandToUnits(groupMembers(g).map((el) => el.id)));
        } else { setSelection([]); setTool('selection'); }
        return;
      case 'Enter': {
        const sel = selectedEls();
        if (sel.length === 1 && sel[0].type === 'text') { e.preventDefault(); startEditText(sel[0], false); }
        return;
      }
      case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown': {
        if (!S.selected.size) return;
        e.preventDefault();
        // Pas triat al menú (o una casella si hi ha la quadrícula); amb Maj, 10 vegades més
        const base = S.grid ? GRID : S.nudge;
        const st = e.shiftKey ? base * 10 : base;
        const dx = e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0;
        const dy = e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0;
        nudge(dx, dy);
        return;
      }
      case '?':
        $('#help-dialog').showModal();
        return;
    }
    if (e.shiftKey && !drag && S.selected.size) {
      if (e.code === 'KeyH') { e.preventDefault(); flipSelected('h'); return; }
      if (e.code === 'KeyV') { e.preventDefault(); flipSelected('v'); return; }
      if (e.code === 'KeyR') { e.preventDefault(); rotateSelectedBy(Math.PI / 2); return; }
    }
    if (e.shiftKey || drag) return;
    if (k === 'q') { toggleLock(); return; }
    if (k === 'g') { toggleGrid(); return; }
    const tool = TOOL_KEYS[k];
    if (tool) setTool(tool);
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') { spaceDown = false; if (!drag) setCursor(baseCursor()); }
  });
  window.addEventListener('blur', () => { spaceDown = false; });

  /* =========================================================
   * Porta-retalls
   * ========================================================= */
  function clipboardPayload(els) {
    return JSON.stringify({ type: 'pissarra/clipboard', elements: serialize(els), files: usedFiles(els) });
  }
  document.addEventListener('copy', (e) => {
    if (isTypingTarget(document.activeElement) || editing) return;
    const sel = selectedEls();
    if (!sel.length) return;
    e.clipboardData.setData('text/plain', clipboardPayload(sel));
    e.preventDefault();
  });
  document.addEventListener('cut', (e) => {
    if (isTypingTarget(document.activeElement) || editing) return;
    const sel = selectedEls();
    if (!sel.length) return;
    e.clipboardData.setData('text/plain', clipboardPayload(sel));
    e.preventDefault();
    deleteSelected();
  });
  document.addEventListener('paste', (e) => {
    if (isTypingTarget(document.activeElement) || editing || $('dialog[open]')) return;
    const dt = e.clipboardData;
    if (!dt) return;
    const img = Array.from(dt.files || []).find((f) => f.type.indexOf('image/') === 0);
    if (img) { e.preventDefault(); insertImageFile(img, pastePoint()); return; }
    const txt = dt.getData('text/plain');
    if (txt) { e.preventDefault(); pasteText(txt); }
  });
  function pastePoint() {
    return pointerOverCanvas && lastWorldPointer ? lastWorldPointer.slice() : viewCenter();
  }
  function pasteText(txt) {
    let data = null;
    try { data = JSON.parse(txt); } catch (_) { /* text normal */ }
    if (data && data.type === 'pissarra/clipboard' && Array.isArray(data.elements)) { pasteElements(data.elements, data.files); return; }
    if (data && (data.type === 'excalidraw/clipboard' || data.type === 'excalidraw') && Array.isArray(data.elements)) {
      const r = fromExcalidraw(data);
      pasteElements(r.elements, r.files);
      return;
    }
    const [x, y] = pastePoint();
    const el = newElement('text', x, y, { text: txt.replace(/\r\n?/g, '\n').replace(/\s+$/, ''), textAlign: 'left' });
    measureTextEl(el);
    el.x -= el.w / 2;
    el.y -= el.h / 2;
    S.elements.push(el);
    setTool('selection');
    setSelection([el.id]);
    commit();
  }
  function pasteElements(list, fileMap) {
    Object.assign(files, sanitizeFiles(fileMap));
    const els = list.filter(isValidElement).map(normalizeElement);
    if (!els.length) return;
    S.editingGroup = null;
    remapGroups(els, false);
    const b = R.sceneBounds(els);
    const [px, py] = pastePoint();
    const dx = snapV(px - (b.x + b.w / 2)), dy = snapV(py - (b.y + b.h / 2));
    const idMap = new Map();
    for (const el of els) {
      const nid = uid();
      idMap.set(el.id, nid);
      el.id = nid;
      el.x += dx;
      el.y += dy;
    }
    remapBindings(els, idMap);
    S.elements.push(...els);
    setTool('selection');
    setSelection(els.map((e) => e.id));
    commit();
  }

  /* =========================================================
   * Imatges
   * ========================================================= */
  const fileImage = $('#file-image');
  function openImagePicker() {
    closeMenu();
    fileImage.value = '';
    fileImage.click();
  }
  fileImage.addEventListener('change', () => {
    const f = fileImage.files && fileImage.files[0];
    if (f) insertImageFile(f, null);
  });

  const readAsDataURL = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
  const loadImage = (src) => new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });

  async function insertImageFile(file, at) {
    try {
      let url = await readAsDataURL(file);
      const img = await loadImage(url);
      let w = img.naturalWidth || 320, h = img.naturalHeight || 240;
      const MAX = 1600;
      const keepAsIs = file.type === 'image/svg+xml' || file.type === 'image/gif';
      if (!keepAsIs && Math.max(w, h) > MAX) {
        const s = MAX / Math.max(w, h);
        const c = document.createElement('canvas');
        c.width = Math.round(w * s);
        c.height = Math.round(h * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        url = c.toDataURL(file.type === 'image/png' || file.type === 'image/webp' ? 'image/png' : 'image/jpeg', 0.9);
        w = c.width;
        h = c.height;
      }
      const fid = 'img_' + uid();
      files[fid] = url;
      const [cx, cy] = at || viewCenter();
      const s = Math.min(1, (W * 0.6) / S.view.zoom / w, (H * 0.6) / S.view.zoom / h);
      const ew = w * s, eh = h * s;
      const el = newElement('image', round2(cx - ew / 2), round2(cy - eh / 2), { w: ew, h: eh, fileId: fid });
      S.elements.push(el);
      setTool('selection');
      setSelection([el.id]);
      commit();
    } catch (err) {
      toast('No s\'ha pogut carregar la imatge');
    }
  }

  /* --- Arrossegar i deixar anar --- */
  app.addEventListener('dragover', (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
  app.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    const p = toWorld(...evPos(e));
    if (f.type.indexOf('image/') === 0) insertImageFile(f, p);
    else if (/\.(json|pissarra|excalidraw)$/i.test(f.name) || f.type === 'application/json') loadFromFile(f);
    else toast('Format de fitxer no compatible');
  });

  /* =========================================================
   * Fitxers: desar, obrir i importar d'Excalidraw
   * ========================================================= */
  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }

  function saveToFile() {
    closeMenu();
    if (editing) commitText();
    const data = {
      type: 'pissarra', version: 1, source: 'Pissarra',
      elements: serialize(S.elements), files: sceneFiles(),
      appState: { background: S.background, bgImage: S.bgImage },
    };
    download(new Blob([JSON.stringify(data)], { type: 'application/json' }), 'pissarra-' + stamp() + '.json');
    toast('Dibuix desat a un fitxer');
  }

  /** Només s'accepten imatges incrustades (data:image/…) dels fitxers i enllaços externs. */
  function sanitizeFiles(f) {
    const out = {};
    if (f && typeof f === 'object') {
      for (const k in f) {
        if (typeof f[k] === 'string' && /^data:image\/(png|jpeg|gif|webp|svg\+xml|bmp|avif);/i.test(f[k])) out[k] = f[k];
      }
    }
    return out;
  }

  /* =========================================================
   * Enllaç per compartir
   * El dibuix es comprimeix i va dins del mateix enllaç, després de
   * «#dibuix=». No passa per cap servidor: el fragment (#…) no s'envia.
   * ========================================================= */
  const SHARE_PREFIX = '#dibuix=';
  const SHARE_MAX = 2000000; // límit pràctic de llargada d'un URL als navegadors
  const SHARE_LONG = 8000; // a partir d'aquí, algunes aplicacions poden tallar l'enllaç

  function bytesToB64url(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlToBytes(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  async function pipeBytes(bytes, stream) {
    return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
  }
  /** Codifica l'escena: «1» (versió) + format de compressió (r, d o n) + «.» + dades en base64url. */
  async function encodeScene(obj) {
    const raw = new TextEncoder().encode(JSON.stringify(obj));
    if (window.CompressionStream) {
      for (const [tag, fmt] of [['r', 'deflate-raw'], ['d', 'deflate']]) {
        try { return '1' + tag + '.' + bytesToB64url(await pipeBytes(raw, new CompressionStream(fmt))); } catch (e) { /* prova el següent */ }
      }
    }
    return '1n.' + bytesToB64url(raw);
  }
  async function decodeScene(str) {
    const m = /^1([rdn])\.([A-Za-z0-9_-]+)$/.exec(str.trim());
    if (!m) throw new Error('format');
    let bytes = b64urlToBytes(m[2]);
    if (m[1] !== 'n') bytes = await pipeBytes(bytes, new DecompressionStream(m[1] === 'r' ? 'deflate-raw' : 'deflate'));
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  const fmtSize = (n) => (n < 1000 ? n + ' caràcters' : (n / 1000).toLocaleString('ca', { maximumFractionDigits: 1 }) + ' mil caràcters');

  const dlgSave = $('#save-dialog');
  const shareImages = $('#share-images');
  const shareCreate = $('#share-create');
  const shareUrl = $('#share-url');
  const shareCopy = $('#share-copy');
  const hasImages = () => !!S.bgImage || S.elements.some((e) => e.type === 'image' && files[e.fileId]);

  function shareInfo(msg, warn) {
    const p = $('#share-info');
    p.textContent = msg || '';
    p.hidden = !msg;
    p.classList.toggle('warn', !!warn);
  }
  function resetShare() {
    $('#share-result').hidden = true;
    shareCreate.hidden = false;
    shareUrl.value = '';
    shareInfo('');
  }
  function openSaveDialog() {
    closeMenu();
    if (editing) commitText();
    const imgs = hasImages();
    $('#share-images-row').hidden = !imgs;
    const imgSize = Object.values(sceneFiles()).reduce((a, s) => a + s.length, 0);
    shareImages.checked = imgs && imgSize < 150000;
    $('#share-local-note').hidden = location.protocol !== 'file:';
    $('#share-native').hidden = !navigator.share;
    resetShare();
    dlgSave.showModal();
  }
  shareImages.addEventListener('change', resetShare);
  $('#save-file-btn').addEventListener('click', () => { dlgSave.close(); saveToFile(); });

  shareCreate.addEventListener('click', async () => {
    if (!S.elements.length) { shareInfo('El llenç és buit: dibuixa alguna cosa abans de compartir-lo.', true); return; }
    shareCreate.disabled = true;
    shareCreate.textContent = 'Creant l\'enllaç…';
    try {
      const withImages = shareImages.checked;
      const code = await encodeScene({
        type: 'pissarra', version: 1,
        elements: serialize(S.elements),
        files: withImages ? sceneFiles() : {},
        appState: { background: S.background, bgImage: withImages ? S.bgImage : null },
      });
      const url = location.href.split('#')[0] + SHARE_PREFIX + code;
      if (url.length > SHARE_MAX) {
        shareInfo('El dibuix és massa gran per caber en un enllaç. ' +
          (withImages ? 'Prova-ho sense les imatges o desa\'l a un fitxer.' : 'Desa\'l a un fitxer i comparteix el fitxer.'), true);
        return;
      }
      shareUrl.value = url;
      $('#share-result').hidden = false;
      shareCreate.hidden = true;
      let msg = 'Llargada de l\'enllaç: ' + fmtSize(url.length) + '.';
      const long = url.length > SHARE_LONG;
      if (long) msg += ' És un enllaç llarg: algunes aplicacions de missatgeria el poden tallar. Si passa, comparteix el fitxer.';
      if (hasImages() && !withImages) msg += ' Les imatges no hi van incloses: les del dibuix es veuran com a requadres buits i no hi haurà imatge de fons.';
      shareInfo(msg, long);
      shareUrl.focus();
      shareUrl.select();
    } catch (err) {
      shareInfo('Aquest navegador no ha pogut crear l\'enllaç. Desa el dibuix a un fitxer.', true);
    } finally {
      shareCreate.disabled = false;
      shareCreate.textContent = 'Crea l\'enllaç';
    }
  });

  let copyTimer = 0;
  shareCopy.addEventListener('click', async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(shareUrl.value);
      ok = true;
    } catch (e) {
      shareUrl.focus();
      shareUrl.select();
      try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    }
    shareCopy.textContent = ok ? 'Copiat ✓' : 'Copia\'l amb Ctrl+C';
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => { shareCopy.textContent = 'Copia'; }, 2200);
  });
  $('#share-native').addEventListener('click', () => {
    if (navigator.share) navigator.share({ title: 'Pissarra', url: shareUrl.value }).catch(() => {});
  });

  /** Obre el dibuix que porta l'enllaç (si n'hi ha) i treu les dades de la barra d'adreces. */
  let openingShared = false;
  async function openSharedFromHash() {
    if (openingShared || location.hash.indexOf(SHARE_PREFIX) !== 0) return;
    openingShared = true;
    const code = location.hash.slice(SHARE_PREFIX.length);
    const clearHash = () => {
      // window.history: dins d'aquest fitxer, «history» és l'historial de desfer
      try { window.history.replaceState(null, '', location.href.split('#')[0]); } catch (e) { /* res */ }
    };
    try {
      const d = await decodeScene(code);
      if (!d || d.type !== 'pissarra' || !Array.isArray(d.elements)) throw new Error('format');
      const els = d.elements.filter(isValidElement).map(normalizeElement);
      const same = JSON.stringify(serialize(els)) === JSON.stringify(serialize(S.elements));
      if (S.elements.length && !same) {
        const ok = await confirmDialog('Obrir el dibuix compartit substituirà el que tens ara en aquest navegador. Ho podràs desfer amb Ctrl+Z.', 'Obre\'l');
        if (!ok) return;
      }
      if (editing) commitText();
      Object.assign(files, sanitizeFiles(d.files));
      S.elements = els;
      S.selected.clear();
      S.editingGroup = null;
      setBackground(validBg(d.appState && d.appState.background));
      setBgImage(d.appState && d.appState.bgImage);
      commit();
      fitToContent();
      toast('S\'ha obert el dibuix compartit');
    } catch (err) {
      toast('No s\'ha pogut obrir l\'enllaç: pot ser que estigui incomplet o que el navegador no sigui compatible.', 5000);
    } finally {
      clearHash();
      openingShared = false;
    }
  }
  window.addEventListener('hashchange', openSharedFromHash);

  const fileOpen = $('#file-open');
  function openFilePicker() {
    closeMenu();
    fileOpen.value = '';
    fileOpen.click();
  }
  fileOpen.addEventListener('change', () => {
    const f = fileOpen.files && fileOpen.files[0];
    if (f) loadFromFile(f);
  });

  async function loadFromFile(file) {
    try {
      const d = JSON.parse(await file.text());
      let res;
      if (d && d.type === 'pissarra') {
        res = {
          elements: d.elements || [], files: d.files || {},
          background: validBg(d.appState && d.appState.background),
          bgImage: d.appState && d.appState.bgImage,
        };
      }
      else if (d && d.type === 'excalidraw') res = fromExcalidraw(d);
      else throw new Error('format');
      if (editing) commitText();
      Object.assign(files, sanitizeFiles(res.files));
      S.elements = res.elements.filter(isValidElement).map(normalizeElement);
      S.selected.clear();
      setBackground(res.background || null);
      setBgImage(res.bgImage || null);
      commit();
      fitToContent();
      toast('S\'ha obert «' + file.name + '»');
    } catch (err) {
      toast('No s\'ha pogut obrir el fitxer: el format no es reconeix');
    }
  }

  /** Importació bàsica de dibuixos d'Excalidraw (sense grups, vincles ni marcs). */
  function fromExcalidraw(data) {
    const out = [];
    const fileMap = {};
    const srcFiles = data.files || {};
    const exIds = new Map(); // id de l'Excalidraw → id nou
    const pendingBinds = [];
    const color = (c, def) => (c === 'transparent' || /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c || '') ? c : def);
    const fontMap = { 1: 'hand', 2: 'normal', 3: 'code', 5: 'hand', 6: 'normal', 7: 'normal', 8: 'code' };
    for (const x of data.elements || []) {
      if (!x || x.isDeleted) continue;
      const base = {
        id: uid(), x: +x.x || 0, y: +x.y || 0, w: Math.abs(+x.width || 0), h: Math.abs(+x.height || 0),
        seed: (x.seed | 0) || randSeed(), version: 1,
        stroke: color(x.strokeColor, '#1e1e1e'),
        fill: color(x.backgroundColor, 'transparent'),
        fillStyle: ['hachure', 'cross-hatch', 'solid'].includes(x.fillStyle) ? x.fillStyle : 'hachure',
        strokeWidth: (x.strokeWidth || 2) <= 1 ? 1 : x.strokeWidth <= 2 ? 2 : 4,
        strokeStyle: ['solid', 'dashed', 'dotted'].includes(x.strokeStyle) ? x.strokeStyle : 'solid',
        roughness: clamp(Math.round(x.roughness == null ? 1 : x.roughness), 0, 2),
        opacity: x.opacity == null ? 100 : clamp(+x.opacity, 0, 100),
        roundness: x.roundness ? 'round' : 'sharp',
        angle: +x.angle || 0,
        groupIds: Array.isArray(x.groupIds) ? x.groupIds.map(String) : [],
      };
      if (x.id) exIds.set(x.id, base.id);
      if (x.startBinding && x.startBinding.elementId) pendingBinds.push([base, 'startBinding', x.startBinding.elementId]);
      if (x.endBinding && x.endBinding.elementId) pendingBinds.push([base, 'endBinding', x.endBinding.elementId]);
      switch (x.type) {
        case 'rectangle':
        case 'ellipse':
        case 'diamond':
          out.push(Object.assign(base, { type: x.type }));
          break;
        case 'line':
        case 'arrow': {
          const s = !!x.startArrowhead, e = !!x.endArrowhead;
          out.push(Object.assign(base, {
            type: x.type,
            points: (x.points || [[0, 0], [base.w, base.h]]).map((p) => [+p[0], +p[1]]),
            arrowheads: s && e ? 'both' : e ? 'end' : s ? 'start' : 'none',
          }));
          break;
        }
        case 'freedraw':
          out.push(Object.assign(base, { type: 'freedraw', points: (x.points || [[0, 0]]).map((p) => [+p[0], +p[1]]) }));
          break;
        case 'text':
          out.push(Object.assign(base, {
            type: 'text',
            text: String(x.originalText != null ? x.originalText : x.text || ''),
            fontSize: +x.fontSize || 20,
            fontFamily: fontMap[x.fontFamily] || 'hand',
            textAlign: ['left', 'center', 'right'].includes(x.textAlign) ? x.textAlign : 'left',
          }));
          break;
        case 'image': {
          const f = srcFiles[x.fileId];
          if (f && f.dataURL) {
            const fid = 'img_' + uid();
            fileMap[fid] = f.dataURL;
            const sc = Array.isArray(x.scale) ? x.scale : [1, 1];
            out.push(Object.assign(base, { type: 'image', fileId: fid, flipX: sc[0] < 0, flipY: sc[1] < 0 }));
          }
          break;
        }
      }
    }
    for (const [el, k, exId] of pendingBinds) {
      if (exIds.has(exId)) el[k] = { id: exIds.get(exId), fx: 0.5, fy: 0.5 };
    }
    // El blanc és el fons per defecte de l'Excalidraw: es manté el fons del tema
    const vb = validBg(data.appState && data.appState.viewBackgroundColor);
    return { elements: out, files: fileMap, background: vb && vb !== '#ffffff' ? vb : null };
  }

  /* =========================================================
   * Exportació d'imatges
   * ========================================================= */
  const dlgExport = $('#export-dialog');
  const expBg = $('#exp-bg');
  const expDark = $('#exp-dark');
  const expSel = $('#exp-sel');
  const expBgImg = $('#exp-bgimg');
  let expScale = 2;

  const exportEls = () => (expSel.checked && S.selected.size ? selectedEls() : S.elements);
  /** La imatge de fons s'exporta només si n'hi ha, si es vol i si s'exporta amb fons. */
  const exportBgImage = () => (S.bgImage && expBg.checked && expBgImg.checked ? S.bgImage : null);
  const exportOpts = (scale) => ({
    theme: expDark.checked ? 'dark' : 'light', bg: expBg.checked, bgColor: S.background,
    bgImage: exportBgImage(), scale, files,
  });
  /** Elements a carregar abans d'exportar (inclou la imatge de fons si s'exporta). */
  const exportPreload = (els) => {
    const bgi = exportBgImage();
    return R.preloadImages(bgi ? els.concat([{ type: 'image', fileId: bgi.fileId }]) : els, files);
  };
  function syncExportBgImg() {
    $('#exp-bgimg-row').hidden = !S.bgImage;
    expBgImg.disabled = !expBg.checked;
  }

  function openExport() {
    closeMenu();
    if (editing) commitText();
    if (!S.elements.length) { toast('El llenç és buit: no hi ha res per exportar'); return; }
    expDark.checked = S.theme === 'dark';
    expSel.disabled = !S.selected.size;
    expSel.checked = S.selected.size > 0;
    syncExportBgImg();
    dlgExport.showModal();
    updateExportPreview();
  }
  async function updateExportPreview() {
    const els = exportEls();
    await exportPreload(els);
    const src = R.renderToCanvas(els, exportOpts(1));
    const box = $('#export-preview-box');
    const pv = $('#export-preview');
    const maxW = box.clientWidth - 16, maxH = box.clientHeight - 16;
    const s = Math.min(1, maxW / src.width, maxH / src.height);
    const dpr = window.devicePixelRatio || 1;
    pv.width = Math.max(1, Math.round(src.width * s * dpr));
    pv.height = Math.max(1, Math.round(src.height * s * dpr));
    pv.style.width = Math.round(src.width * s) + 'px';
    pv.style.height = Math.round(src.height * s) + 'px';
    const c = pv.getContext('2d');
    c.clearRect(0, 0, pv.width, pv.height);
    c.drawImage(src, 0, 0, pv.width, pv.height);
  }
  expBg.addEventListener('change', syncExportBgImg);
  [expBg, expDark, expSel, expBgImg].forEach((i) => i.addEventListener('change', updateExportPreview));
  $('#exp-scale').addEventListener('click', (e) => {
    const b = e.target.closest('[data-scale]');
    if (!b) return;
    expScale = +b.dataset.scale;
    for (const x of $$('[data-scale]')) x.classList.toggle('active', x === b);
  });
  $('#exp-png').addEventListener('click', async () => {
    const els = exportEls();
    await exportPreload(els);
    R.renderToCanvas(els, exportOpts(expScale)).toBlob((blob) => {
      if (blob) download(blob, 'pissarra-' + stamp() + '.png');
    }, 'image/png');
  });
  $('#exp-svg').addEventListener('click', () => {
    const svg = R.toSVG(exportEls(), exportOpts(1));
    download(new Blob([svg], { type: 'image/svg+xml' }), 'pissarra-' + stamp() + '.svg');
  });
  $('#exp-copy').addEventListener('click', async () => {
    try {
      const els = exportEls();
      await exportPreload(els);
      const c = R.renderToCanvas(els, exportOpts(expScale));
      const blob = new Promise((res) => c.toBlob(res, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast('Imatge copiada al porta-retalls');
    } catch (err) {
      toast('El navegador no permet copiar imatges aquí. Fes servir «PNG».');
    }
  });

  /* =========================================================
   * Inici
   * ========================================================= */
  function init() {
    loadSaved();
    S.elements = S.elements.map(normalizeElement);
    applyTheme();
    resize();
    history.stack = [snapshot()];
    history.index = 0;
    setTool('selection');
    updateUI();

    if (window.ResizeObserver) new ResizeObserver(resize).observe(app);
    else window.addEventListener('resize', resize);

    // Quan la lletra "a mà" acaba de carregar, cal tornar a mesurar els textos
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load('20px "Caveat"'), document.fonts.ready])
        .catch(() => {})
        .then(() => {
          R.clearMetrics();
          for (const el of S.elements) if (el.type === 'text') measureTextEl(el);
          if (editing) positionEditor();
          requestRender();
        });
    }
    window.addEventListener('beforeunload', () => { clearTimeout(saveTimer); saveNow(); });
    openSharedFromHash();
    document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimeout(saveTimer); saveNow(); } });
  }

  // Petita API per depurar des de la consola
  window.Pissarra = {
    get state() { return S; },
    undo, redo, fitToContent, toSVG: (opts) => R.toSVG(S.elements, Object.assign({ files }, opts || {})),
    select: (ids) => { setTool('selection'); setSelection(ids); },
  };

  init();
})();
