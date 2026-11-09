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

  const CURSORS = {
    nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize',
    n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
  };
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
    locked: false,
    theme: 'dark',
    grid: false,
    view: { x: 0, y: 0, zoom: 1 },
    style: {
      stroke: '#1e1e1e', fill: 'transparent', fillStyle: 'hachure', strokeWidth: 2,
      strokeStyle: 'solid', roughness: 1, opacity: 100, roundness: 'round',
      arrowheads: 'end', fontSize: 20, fontFamily: 'hand', textAlign: 'left',
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
      stroke: st.stroke, fill: st.fill, fillStyle: st.fillStyle, strokeWidth: st.strokeWidth,
      strokeStyle: st.strokeStyle, roughness: st.roughness, opacity: st.opacity, roundness: st.roundness,
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
      files: usedFiles(S.elements),
      app: { theme: S.theme, grid: S.grid, view: S.view, style: S.style, locked: S.locked },
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
      if (d.files && typeof d.files === 'object') Object.assign(files, d.files);
      const a = d.app || {};
      if (a.theme === 'light' || a.theme === 'dark') S.theme = a.theme;
      S.grid = !!a.grid;
      S.locked = !!a.locked;
      if (a.view && isFinite(a.view.x) && isFinite(a.view.y) && isFinite(a.view.zoom)) {
        S.view = { x: +a.view.x, y: +a.view.y, zoom: clamp(+a.view.zoom, MIN_ZOOM, MAX_ZOOM) };
      }
      if (a.style) for (const k in S.style) if (a.style[k] !== undefined) S.style[k] = a.style[k];
    } catch (e) {
      console.warn('Pissarra: no s\'ha pogut llegir el dibuix desat', e);
    }
  }

  /* =========================================================
   * Historial (desfés / refés)
   * ========================================================= */
  const history = { stack: [], index: -1 };
  const snapshot = () => JSON.stringify(S.elements, stripPrivate);

  function commit() {
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
    ctx.fillStyle = th.bg;
    ctx.fillRect(0, 0, W, H);
    if (S.grid) drawGrid(th);

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
      R.drawElement(ctx, el, S.theme, { files, faded: erasing.has(el.id), onImageLoad: requestRender });
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

  function screenBox(b, pad) {
    const [x, y] = toScreen(b.x, b.y);
    return { x: x - pad, y: y - pad, w: b.w * S.view.zoom + pad * 2, h: b.h * S.view.zoom + pad * 2 };
  }
  const selectionBounds = () => R.sceneBounds(selectedEls());
  function singleLinear() {
    if (S.selected.size !== 1) return null;
    const el = byId(S.selected.values().next().value);
    return el && LINEAR.has(el.type) ? el : null;
  }

  let lastPointerType = 'mouse';
  const touchy = () => lastPointerType !== 'mouse';

  function getHandles() {
    const sel = selectedEls();
    if (!sel.length || singleLinear()) return [];
    const r = screenBox(selectionBounds(), 6);
    const x1 = r.x, y1 = r.y, x2 = r.x + r.w, y2 = r.y + r.h;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const hs = [
      { id: 'nw', x: x1, y: y1 }, { id: 'ne', x: x2, y: y1 },
      { id: 'se', x: x2, y: y2 }, { id: 'sw', x: x1, y: y2 },
    ];
    const onlyCorners = sel.length === 1 && sel[0].type === 'text';
    if (!onlyCorners) {
      if (r.w > 44) hs.push({ id: 'n', x: mx, y: y1 }, { id: 's', x: mx, y: y2 });
      if (r.h > 44) hs.push({ id: 'w', x: x1, y: my }, { id: 'e', x: x2, y: my });
    }
    return hs;
  }
  function handleAt(sx, sy) {
    const r = touchy() ? 16 : 8;
    return getHandles().find((h) => Math.abs(h.x - sx) <= r && Math.abs(h.y - sy) <= r) || null;
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

  function drawOverlay(th) {
    const sel = selectedEls();
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = th.accent;
    const creating = drag && (drag.type === 'create' || drag.type === 'freedraw');
    if (sel.length && !creating) {
      if (sel.length > 1) {
        ctx.setLineDash([4, 4]);
        for (const el of sel) {
          const r = screenBox(R.getBounds(el), 3);
          ctx.strokeRect(Math.round(r.x) + 0.5, Math.round(r.y) + 0.5, Math.round(r.w), Math.round(r.h));
        }
        ctx.setLineDash([]);
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
        ctx.fillStyle = th.handleFill;
        for (const p of pts) {
          ctx.beginPath();
          ctx.arc(p[0], p[1], pr, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      } else {
        const r = screenBox(selectionBounds(), 6);
        ctx.strokeRect(Math.round(r.x) + 0.5, Math.round(r.y) + 0.5, Math.round(r.w), Math.round(r.h));
        if (!(drag && drag.type === 'move' && drag.moved)) {
          const hs = touchy() ? 12 : 9;
          ctx.fillStyle = th.handleFill;
          ctx.lineWidth = 1.5;
          for (const h of getHandles()) {
            roundRect(h.x - hs / 2, h.y - hs / 2, hs, hs, 2.5);
            ctx.fill();
            ctx.stroke();
          }
        }
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
    const b = R.getBounds(el);
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
    const sel = selectedEls();
    if (sel.length < 2) return;
    const b = selectionBounds();
    for (const el of sel) {
      const e = R.getBounds(el);
      let dx = 0, dy = 0;
      if (mode === 'left') dx = b.x - e.x;
      else if (mode === 'center') dx = b.x + b.w / 2 - (e.x + e.w / 2);
      else if (mode === 'right') dx = b.x + b.w - (e.x + e.w);
      else if (mode === 'top') dy = b.y - e.y;
      else if (mode === 'middle') dy = b.y + b.h / 2 - (e.y + e.h / 2);
      else if (mode === 'bottom') dy = b.y + b.h - (e.y + e.h);
      el.x += dx;
      el.y += dy;
    }
    commit();
  }

  function nudge(dx, dy) {
    if (!S.selected.size) return;
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
  canvas.addEventListener('pointerleave', () => { pointerOverCanvas = false; });
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
      case 'text': {
        const hit = hitTest(wx, wy);
        if (hit && hit.type === 'text') startEditText(hit, false);
        else createTextAt(wx, wy);
        drag = { type: 'focus' };
        break;
      }
      default:
        if (CREATE_TOOLS.has(S.tool)) startCreate(S.tool, wx, wy);
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
        const orig = { x: lin.x, y: lin.y, points: lin.points.map((p) => p.slice()) };
        let index = h.index;
        if (h.mid) {
          const a = lin.points[index], b = lin.points[index + 1];
          lin.points.splice(index + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
          index += 1;
          bump(lin);
        }
        drag = { type: 'point', el: lin, index, orig };
        return;
      }
    }
    const handle = handleAt(sx, sy);
    if (handle) { startResize(handle.id); return; }

    const hit = hitTest(wx, wy);
    if (isDouble) {
      if (hit && hit.type === 'text') { startEditText(hit, false); drag = { type: 'focus' }; return; }
      // Doble clic sobre una forma (o al seu interior, encara que no tingui fons): text centrat
      const shape = hit && SHAPES.has(hit.type) ? hit
        : !hit ? S.elements.slice().reverse().find((el) => SHAPES.has(el.type) && inBox(wx, wy, el, 0)) : null;
      if (shape) {
        const b = R.getBounds(shape);
        createTextAt(b.x + b.w / 2, b.y + b.h / 2, 'center');
        drag = { type: 'focus' };
        return;
      }
      if (!hit || hit.type !== 'image') { createTextAt(wx, wy); drag = { type: 'focus' }; return; }
    }
    if (e.shiftKey) {
      if (hit) {
        const s = new Set(S.selected);
        if (s.has(hit.id)) s.delete(hit.id); else s.add(hit.id);
        setSelection(Array.from(s));
        if (S.selected.has(hit.id)) startMove(wx, wy, e.altKey);
      } else {
        drag = { type: 'marquee', x0: wx, y0: wy, x1: wx, y1: wy, base: Array.from(S.selected) };
      }
      return;
    }
    if (hit) {
      if (!S.selected.has(hit.id)) setSelection([hit.id]);
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
      case 'move': moveSelection(wx, wy); break;
      case 'resize': moveResize(wx, wy, e.shiftKey); break;
      case 'point': movePoint(wx, wy, e.shiftKey); break;
      case 'marquee': drag.x1 = wx; drag.y1 = wy; updateMarquee(); break;
      case 'erase': eraseAlong(wx, wy); break;
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
      case 'point': normalizeLinear(d.el); commit(); break;
      case 'erase': finishErase(); break;
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
    } else if (d.type === 'resize') {
      for (const [id, o] of d.origs) {
        const i = S.elements.findIndex((e) => e.id === id);
        if (i >= 0) S.elements[i] = o;
      }
    } else if (d.type === 'point') {
      Object.assign(d.el, d.orig);
      bump(d.el);
    } else if (d.type === 'erase') erasing.clear();
    updateUI();
    requestRender();
  }

  function updateHoverCursor(sx, sy, wx, wy) {
    if (spaceDown || S.tool === 'hand') return setCursor('grab');
    if (S.tool !== 'selection') return setCursor(baseCursor());
    const lin = singleLinear();
    if (lin && linearHandleAt(lin, sx, sy)) return setCursor('pointer');
    const h = handleAt(sx, sy);
    if (h) return setCursor(CURSORS[h.id]);
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
  function startCreate(type, wx, wy) {
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
      el.points[1] = [round2(dx), round2(dy)];
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
      if (drag.alt) {
        // Alt + arrossegar: duplica i mou la còpia
        const sel = selectedEls();
        const clones = sel.map((el) => { const c = cloneEl(el); c.id = uid(); c.seed = randSeed(); return c; });
        drag.prevSel = sel.map((el) => el.id);
        drag.dupIds = clones.map((c) => c.id);
        S.elements.push(...clones);
        S.selected = new Set(drag.dupIds);
        drag.origs = new Map(clones.map((c) => [c.id, { x: c.x, y: c.y }]));
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
    };
  }

  function moveResize(wx, wy, shift) {
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
    const keep = drag.single === 'text' ? true : drag.single === 'image' ? !shift : shift;
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

  /* --- Punts de línies i fletxes --- */
  function movePoint(wx, wy, shift) {
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
  }

  /* --- Selecció per àrea --- */
  function updateMarquee() {
    const x = Math.min(drag.x0, drag.x1), y = Math.min(drag.y0, drag.y1);
    const w = Math.abs(drag.x1 - drag.x0), h = Math.abs(drag.y1 - drag.y0);
    const ids = S.elements.filter((el) => {
      const b = R.getBounds(el);
      return b.x >= x && b.y >= y && b.x + b.w <= x + w && b.y + b.h <= y + h;
    }).map((el) => el.id);
    setSelection(drag.base.concat(ids));
  }

  /* --- Goma --- */
  function eraseAt(wx, wy) {
    const tol = (touchy() ? 12 : 6) / S.view.zoom;
    for (const el of S.elements) {
      if (!erasing.has(el.id) && hitElement(el, wx, wy, tol)) erasing.add(el.id);
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

  function createTextAt(wx, wy, align) {
    const fs = S.style.fontSize;
    const el = newElement('text', wx, wy - (fs * LH) / 2, {
      text: '', fontSize: fs, fontFamily: S.style.fontFamily,
      textAlign: align || S.style.textAlign, w: 0, h: fs * LH,
    });
    S.elements.push(el);
    startEditText(el, true);
  }

  function startEditText(el, isNew) {
    if (editing) commitText();
    S.selected = new Set();
    updateProps();
    editing = { el, isNew, anchor: el.x + el.w * alignFactor(el.textAlign) };
    el._editing = true;
    ta.value = el.text || '';
    ta.hidden = false;
    positionEditor();
    ta.focus({ preventScroll: true });
    const n = ta.value.length;
    ta.setSelectionRange(n, n);
    requestRender();
  }

  function positionEditor() {
    if (!editing) return;
    const el = editing.el;
    const z = S.view.zoom;
    const m = R.measureText(ta.value, el.fontSize, el.fontFamily);
    el.w = m.w;
    el.h = m.h;
    el.x = editing.anchor - m.w * alignFactor(el.textAlign);
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
    const f = alignFactor(el.textAlign);
    const anchor = el.x + el.w * f;
    if (el.text !== text) { el.text = text; bump(el); }
    measureTextEl(el);
    el.x = anchor - el.w * f;
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
    S.tool = t;
    if (t !== 'selection') setSelection([]);
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
  function toggleTheme() {
    S.theme = S.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    saveSoon();
  }

  function applyTheme() {
    document.documentElement.dataset.theme = S.theme;
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', R.THEMES[S.theme].bg);
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

  function currentValue(key) {
    const target = editing ? [editing.el] : selectedEls();
    const el = target.find((e) => appliesTo(key, e.type));
    return el ? el[key] : S.style[key];
  }

  function updateProps() {
    const types = contextTypes();
    const sel = selectedEls();
    const any = (key) => Array.from(types).some((t) => appliesTo(key, t));
    const show = types.size > 0;
    propsEl.classList.toggle('visible', show);
    const tgl = $('#props-toggle');
    tgl.hidden = !show;
    tgl.setAttribute('aria-expanded', String(show && propsEl.classList.contains('open')));

    for (const sec of $$('[data-prop]', propsEl)) {
      const key = sec.dataset.prop;
      let vis;
      if (key === 'layers' || key === 'actions') vis = sel.length > 0;
      else if (key === 'align') vis = sel.length > 1;
      else if (key === 'fillStyle') vis = any('fillStyle') && currentValue('fill') !== 'transparent';
      else vis = any(key);
      sec.hidden = !vis;
    }

    for (const group of $$('[data-key]', propsEl)) {
      const key = group.dataset.key;
      const v = currentValue(key);
      if (group.tagName === 'INPUT') {
        if (group.type === 'range') {
          group.value = v;
          $('#opacity-out').textContent = v;
        } else if (group.type === 'color' && /^#[0-9a-f]{6}$/i.test(v)) {
          group.value = v;
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
  }

  function setProp(key, value, doCommit) {
    if (doCommit === undefined) doCommit = true;
    if (key !== 'arrowheads' || !singleLineSelected()) S.style[key] = value;
    const targets = editing ? [editing.el] : selectedEls();
    for (const el of targets) {
      if (!appliesTo(key, el.type)) continue;
      el[key] = value;
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
    updateProps();
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
    if (t.type === 'color' && t.dataset.key) setProp(t.dataset.key, t.value, false);
    else if (t.type === 'range') setProp('opacity', +t.value, false);
  });
  propsEl.addEventListener('change', (e) => {
    const t = e.target;
    if ((t.type === 'color' || t.type === 'range') && !editing) commit();
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
    if (menuOpen && !menu.contains(e.target) && !menuBtn.contains(e.target)) closeMenu();
  }, true);

  /* --- Accions (botons amb data-action) --- */
  function runAction(a) {
    switch (a) {
      case 'open': openFilePicker(); break;
      case 'save': saveToFile(); break;
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
    t: 'text', 8: 'text', 9: 'image', e: 'eraser', 0: 'eraser',
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
      if (k === 'a') { e.preventDefault(); setTool('selection'); setSelection(S.elements.map((el) => el.id)); return; }
      if (k === 'd') { e.preventDefault(); duplicateSelected(); return; }
      if (k === 's') { e.preventDefault(); saveToFile(); return; }
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
    if (e.shiftKey && e.code === 'Digit1') { e.preventDefault(); fitToContent(); return; }
    if (e.altKey) return;

    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        if (S.selected.size) { e.preventDefault(); deleteSelected(); }
        return;
      case 'Escape':
        if (drag) cancelDrag();
        else if (menuOpen) closeMenu();
        else { setSelection([]); setTool('selection'); }
        return;
      case 'Enter': {
        const sel = selectedEls();
        if (sel.length === 1 && sel[0].type === 'text') { e.preventDefault(); startEditText(sel[0], false); }
        return;
      }
      case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown': {
        if (!S.selected.size) return;
        e.preventDefault();
        const st = S.grid ? GRID : e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0;
        const dy = e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0;
        nudge(dx, dy);
        return;
      }
      case '?':
        $('#help-dialog').showModal();
        return;
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
    Object.assign(files, fileMap || {});
    const els = list.filter(isValidElement).map(normalizeElement);
    if (!els.length) return;
    const b = R.sceneBounds(els);
    const [px, py] = pastePoint();
    const dx = snapV(px - (b.x + b.w / 2)), dy = snapV(py - (b.y + b.h / 2));
    for (const el of els) { el.id = uid(); el.x += dx; el.y += dy; }
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
      elements: serialize(S.elements), files: usedFiles(S.elements),
    };
    download(new Blob([JSON.stringify(data)], { type: 'application/json' }), 'pissarra-' + stamp() + '.json');
    toast('Dibuix desat a un fitxer');
  }

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
      if (d && d.type === 'pissarra') res = { elements: d.elements || [], files: d.files || {} };
      else if (d && d.type === 'excalidraw') res = fromExcalidraw(d);
      else throw new Error('format');
      if (editing) commitText();
      Object.assign(files, res.files || {});
      S.elements = res.elements.filter(isValidElement).map(normalizeElement);
      S.selected.clear();
      commit();
      fitToContent();
      toast(res.rotated
        ? 'Fitxer obert. Alguns elements tenien rotació i s\'han importat sense girar.'
        : 'S\'ha obert «' + file.name + '»', res.rotated ? 4500 : 2600);
    } catch (err) {
      toast('No s\'ha pogut obrir el fitxer: el format no es reconeix');
    }
  }

  /** Importació bàsica de dibuixos d'Excalidraw (sense rotació, grups ni vincles). */
  function fromExcalidraw(data) {
    const out = [];
    const fileMap = {};
    let rotated = false;
    const srcFiles = data.files || {};
    const color = (c, def) => (c === 'transparent' || /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c || '') ? c : def);
    const fontMap = { 1: 'hand', 2: 'normal', 3: 'code', 5: 'hand', 6: 'normal', 7: 'normal', 8: 'code' };
    for (const x of data.elements || []) {
      if (!x || x.isDeleted) continue;
      if (x.angle) rotated = true;
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
      };
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
            out.push(Object.assign(base, { type: 'image', fileId: fid }));
          }
          break;
        }
      }
    }
    return { elements: out, files: fileMap, rotated };
  }

  /* =========================================================
   * Exportació d'imatges
   * ========================================================= */
  const dlgExport = $('#export-dialog');
  const expBg = $('#exp-bg');
  const expDark = $('#exp-dark');
  const expSel = $('#exp-sel');
  let expScale = 2;

  const exportEls = () => (expSel.checked && S.selected.size ? selectedEls() : S.elements);
  const exportOpts = (scale) => ({ theme: expDark.checked ? 'dark' : 'light', bg: expBg.checked, scale, files });

  function openExport() {
    closeMenu();
    if (editing) commitText();
    if (!S.elements.length) { toast('El llenç és buit: no hi ha res per exportar'); return; }
    expDark.checked = S.theme === 'dark';
    expSel.disabled = !S.selected.size;
    expSel.checked = S.selected.size > 0;
    dlgExport.showModal();
    updateExportPreview();
  }
  async function updateExportPreview() {
    const els = exportEls();
    await R.preloadImages(els, files);
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
  [expBg, expDark, expSel].forEach((i) => i.addEventListener('change', updateExportPreview));
  $('#exp-scale').addEventListener('click', (e) => {
    const b = e.target.closest('[data-scale]');
    if (!b) return;
    expScale = +b.dataset.scale;
    for (const x of $$('[data-scale]')) x.classList.toggle('active', x === b);
  });
  $('#exp-png').addEventListener('click', async () => {
    const els = exportEls();
    await R.preloadImages(els, files);
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
      await R.preloadImages(els, files);
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
    document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimeout(saveTimer); saveNow(); } });
  }

  // Petita API per depurar des de la consola
  window.Pissarra = {
    get state() { return S; },
    undo, redo, fitToContent, toSVG: (opts) => R.toSVG(S.elements, Object.assign({ files }, opts || {})),
  };

  init();
})();
