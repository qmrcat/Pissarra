/*!
 * Pissarra — renderer.js
 * Converteix els elements en traços i els pinta al canvas o els exporta a SVG/PNG.
 */
(function (global) {
  'use strict';

  const SK = global.PissarraSketch;
  const LH = 1.25; // interlineat del text

  const FONTS = {
    hand: '"Caveat", "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive',
    normal: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    code: 'ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  };

  const THEMES = {
    dark: {
      bg: '#121316', grid: 'rgba(255,255,255,0.045)', gridMajor: 'rgba(255,255,255,0.09)',
      accent: '#a8a5ff', handleFill: '#121316', placeholder: 'rgba(255,255,255,0.06)', muted: '#6e6e7c',
    },
    light: {
      bg: '#ffffff', grid: 'rgba(17,17,26,0.05)', gridMajor: 'rgba(17,17,26,0.1)',
      accent: '#6965db', handleFill: '#ffffff', placeholder: 'rgba(0,0,0,0.05)', muted: '#9a9aa6',
    },
  };

  /* ---------------- Colors i tema ----------------
   * Els colors es desen sempre en la seva versió per a tema clar. En tema fosc
   * s'inverteix la lluminositat (mantenint el to), com fa l'Excalidraw.        */
  function hexToRgba(c) {
    let h = String(c).trim().replace('#', '');
    if (h.length === 3 || h.length === 4) h = h.split('').map((x) => x + x).join('');
    if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(h)) return null;
    return [
      parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16),
      h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    ];
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function hslToRgb(h, s, l) {
    if (s === 0) return [l * 255, l * 255, l * 255];
    const hue = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [hue(p, q, h + 1 / 3) * 255, hue(p, q, h) * 255, hue(p, q, h - 1 / 3) * 255];
  }
  const hex2 = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');

  const colorCache = new Map();
  function themeColor(c, theme) {
    if (theme !== 'dark' || !c || c === 'transparent') return c;
    let v = colorCache.get(c);
    if (v) return v;
    const rgba = hexToRgba(c);
    if (!rgba) return c;
    const [h, s, l] = rgbToHsl(rgba[0], rgba[1], rgba[2]);
    const nl = Math.max(0, Math.min(1, 0.94 - 0.82 * l));
    const [r, g, b] = hslToRgb(h, s * 0.92, nl);
    v = '#' + hex2(r) + hex2(g) + hex2(b) + (rgba[3] < 1 ? hex2(rgba[3] * 255) : '');
    colorCache.set(c, v);
    return v;
  }

  /* ---------------- Text ---------------- */
  const mctx = document.createElement('canvas').getContext('2d');
  const fontString = (size, family) => size + 'px ' + (FONTS[family] || FONTS.hand);
  const metricsCache = new Map();

  function fontRatios(family) {
    let m = metricsCache.get(family);
    if (m) return m;
    mctx.font = fontString(100, family);
    const tm = mctx.measureText('Hg');
    let a = tm.fontBoundingBoxAscent;
    let d = tm.fontBoundingBoxDescent;
    if (!(a > 0) || !(d >= 0)) { a = 80; d = 20; }
    m = { a: a / 100, d: d / 100 };
    metricsCache.set(family, m);
    return m;
  }
  /** Distància de la part superior d'una línia fins a la línia base (coincideix amb el CSS). */
  function baselineOffset(fs, family) {
    const m = fontRatios(family);
    return (fs * LH - (m.a + m.d) * fs) / 2 + m.a * fs;
  }
  function measureText(text, fontSize, family) {
    mctx.font = fontString(fontSize, family);
    const lines = String(text).split('\n');
    let w = 0;
    for (const l of lines) w = Math.max(w, mctx.measureText(l).width);
    return { w: Math.ceil(w), h: lines.length * fontSize * LH, lines };
  }
  function clearMetrics() { metricsCache.clear(); }

  /* ---------------- Geometria i memòria cau ---------------- */
  const LINEAR = { line: 1, arrow: 1 };

  function cacheFor(el) {
    let c = el._c;
    if (!c || c.v !== el.version) c = el._c = { v: el.version };
    return c;
  }
  function linearSamples(el) {
    const c = cacheFor(el);
    if (!c.samples) c.samples = SK.sampleCurve(el.points, 12);
    return c.samples;
  }
  function pointsBox(pts) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const p of pts) {
      if (p[0] < x1) x1 = p[0];
      if (p[1] < y1) y1 = p[1];
      if (p[0] > x2) x2 = p[0];
      if (p[1] > y2) y2 = p[1];
    }
    if (x1 === Infinity) return { x: 0, y: 0, w: 0, h: 0 };
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }
  function localBounds(el) {
    if (LINEAR[el.type] || el.type === 'freedraw') {
      const c = cacheFor(el);
      if (!c.lb) c.lb = pointsBox(el.type === 'freedraw' ? el.points : linearSamples(el));
      return c.lb;
    }
    return { x: 0, y: 0, w: el.w || 0, h: el.h || 0 };
  }
  /** Caixa de l'element sense tenir en compte el gir. */
  function rawBounds(el) {
    const b = localBounds(el);
    return { x: el.x + b.x, y: el.y + b.y, w: b.w, h: b.h };
  }
  /** Centre de l'element (és el punt al voltant del qual gira). */
  function elCenter(el) {
    const b = rawBounds(el);
    return [b.x + b.w / 2, b.y + b.h / 2];
  }
  /** Caixa alineada amb els eixos que conté l'element, ja girat. */
  function getBounds(el) {
    const b = rawBounds(el);
    const a = el.angle || 0;
    if (!a) return b;
    const c = Math.abs(Math.cos(a));
    const s = Math.abs(Math.sin(a));
    const w = b.w * c + b.h * s;
    const h = b.w * s + b.h * c;
    return { x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - h / 2, w, h };
  }
  function sceneBounds(els) {
    if (!els.length) return { x: 0, y: 0, w: 0, h: 0 };
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const el of els) {
      const b = getBounds(el);
      x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y);
      x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h);
    }
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }

  /* ---------------- Construcció dels traços ---------------- */
  function strokeDash(style, sw) {
    if (style === 'dashed') return [8 + sw * 2, 6 + sw * 2];
    if (style === 'dotted') return [1.5, 4 + sw * 2.5];
    return null;
  }
  function freedrawWidth(sw) { return sw <= 1 ? 2 : sw <= 2 ? 3.2 : 5.5; }

  function effRoughness(el) {
    const r = el.roughness || 0;
    if (!r) return 0;
    const s = Math.min(Math.abs(el.w), Math.abs(el.h));
    return r * Math.max(0.3, Math.min(1, s / 60));
  }

  function headSize(a, b, sw) {
    const len = Math.hypot(a[0] - b[0], a[1] - b[1]);
    return Math.min(12 + sw * 3, Math.max(4, len * 0.5));
  }

  function buildOps(el) {
    const rnd = SK.rng(el.seed || 1);
    const sw = el.strokeWidth || 1;
    const dash = strokeDash(el.strokeStyle, sw);
    const single = !!dash;
    const ops = [];
    switch (el.type) {
      case 'rectangle':
      case 'ellipse':
      case 'diamond': {
        const w = el.w, h = el.h, r = effRoughness(el);
        let clean, rough;
        if (el.type === 'rectangle') {
          const rad = el.roundness === 'round' ? Math.min(32, Math.min(w, h) * 0.25) : 0;
          clean = SK.roundedRect(w, h, rad, 0);
          rough = SK.roundedRect(w, h, rad, r, rnd, single);
        } else if (el.type === 'diamond') {
          const pts = [[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]];
          clean = SK.polygon(pts, 0);
          rough = SK.polygon(pts, r, rnd, single);
        } else {
          clean = SK.ellipse(w / 2, h / 2, w / 2, h / 2, 0);
          rough = SK.ellipse(w / 2, h / 2, w / 2, h / 2, r, rnd, single);
        }
        if (el.fill && el.fill !== 'transparent') {
          if (el.fillStyle === 'solid') {
            ops.push({ t: 'fill', d: clean });
          } else {
            const gap = Math.max(6, sw * 5);
            const hr = Math.min(r, 1);
            let d = SK.hachure(w, h, -41, gap, hr, rnd);
            if (el.fillStyle === 'cross-hatch') d += SK.hachure(w, h, 49, gap, hr, rnd);
            ops.push({ t: 'hachure', clip: clean, d, width: Math.max(1, sw * 0.5) });
          }
        }
        ops.push({ t: 'stroke', d: rough, clean, width: sw, dash });
        break;
      }
      case 'line':
      case 'arrow': {
        const pts = el.points;
        const r = el.roughness || 0;
        ops.push({ t: 'stroke', d: SK.curve(pts, r, rnd, single), width: sw, dash });
        const heads = el.arrowheads || 'none';
        if (pts.length >= 2 && heads !== 'none') {
          let d = '';
          const n = pts.length;
          if (heads === 'end' || heads === 'both') d += SK.arrowhead(pts[n - 1], pts[n - 2], headSize(pts[n - 1], pts[n - 2], sw), r, rnd);
          if (heads === 'start' || heads === 'both') d += SK.arrowhead(pts[0], pts[1], headSize(pts[0], pts[1], sw), r, rnd);
          if (d) ops.push({ t: 'stroke', d, width: sw, dash: null });
        }
        break;
      }
      case 'freedraw':
        ops.push({ t: 'stroke', d: SK.freehand(el.points), width: freedrawWidth(sw), dash: null });
        break;
      case 'text':
        ops.push({ t: 'text' });
        break;
      case 'image':
        ops.push({ t: 'image' });
        break;
    }
    return ops;
  }

  function getOps(el) {
    const c = cacheFor(el);
    if (!c.ops) c.ops = buildOps(el);
    return c.ops;
  }

  /* ---------------- Imatges ---------------- */
  const imgCache = new Map();
  function getImg(id, files, onload) {
    const src = files && files[id];
    if (!src) return null;
    let e = imgCache.get(id);
    if (!e || e.src !== src) {
      const img = new Image();
      e = { img, src, ok: false, bad: false };
      img.addEventListener('load', () => { e.ok = true; if (onload) onload(); });
      img.addEventListener('error', () => { e.bad = true; });
      img.src = src;
      imgCache.set(id, e);
    }
    return e;
  }
  function preloadImages(els, files) {
    return Promise.all(
      els.filter((el) => el.type === 'image').map((el) => new Promise((res) => {
        const e = getImg(el.fileId, files);
        if (!e || e.ok || e.bad) return res();
        e.img.addEventListener('load', () => res(), { once: true });
        e.img.addEventListener('error', () => res(), { once: true });
      }))
    );
  }

  /* ---------------- Pintat al canvas ---------------- */
  function p2d(op, key) {
    const k = '_' + key;
    return op[k] || (op[k] = new Path2D(op[key]));
  }

  function drawText(ctx, el, color) {
    const lines = String(el.text || '').split('\n');
    const fs = el.fontSize;
    const lh = fs * LH;
    const f = el.textAlign === 'center' ? 0.5 : el.textAlign === 'right' ? 1 : 0;
    ctx.font = fontString(fs, el.fontFamily);
    ctx.fillStyle = color;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = el.textAlign || 'left';
    const bo = baselineOffset(fs, el.fontFamily);
    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], el.w * f, i * lh + bo);
  }

  function drawImage(ctx, el, theme, opts) {
    const e = getImg(el.fileId, opts.files, opts.onImageLoad);
    if (e && e.ok) {
      if (el.flipX || el.flipY) {
        ctx.save();
        ctx.translate(el.flipX ? el.w : 0, el.flipY ? el.h : 0);
        ctx.scale(el.flipX ? -1 : 1, el.flipY ? -1 : 1);
        ctx.drawImage(e.img, 0, 0, el.w, el.h);
        ctx.restore();
      } else {
        ctx.drawImage(e.img, 0, 0, el.w, el.h);
      }
      return;
    }
    const th = THEMES[theme];
    ctx.fillStyle = th.placeholder;
    ctx.fillRect(0, 0, el.w, el.h);
    ctx.strokeStyle = th.muted;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(0, 0, el.w, el.h);
    ctx.setLineDash([]);
  }

  function drawElement(ctx, el, theme, opts) {
    opts = opts || {};
    const ops = getOps(el);
    ctx.save();
    const a = el.angle || 0;
    if (a) {
      // Gir al voltant del centre de l'element
      const lb = localBounds(el);
      const cx = lb.x + lb.w / 2;
      const cy = lb.y + lb.h / 2;
      ctx.translate(el.x + cx, el.y + cy);
      ctx.rotate(a);
      ctx.translate(-cx, -cy);
    } else {
      ctx.translate(el.x, el.y);
    }
    ctx.globalAlpha = ((el.opacity == null ? 100 : el.opacity) / 100) * (opts.faded ? 0.25 : 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const stroke = themeColor(el.stroke, theme);
    const fill = themeColor(el.fill, theme);
    for (const op of ops) {
      switch (op.t) {
        case 'fill':
          ctx.fillStyle = fill;
          ctx.fill(p2d(op, 'd'));
          break;
        case 'hachure':
          ctx.save();
          ctx.clip(p2d(op, 'clip'));
          ctx.strokeStyle = fill;
          ctx.lineWidth = op.width;
          ctx.setLineDash([]);
          ctx.stroke(p2d(op, 'd'));
          ctx.restore();
          break;
        case 'stroke':
          if (stroke === 'transparent') {
            // Forma sense traç ni fons: a l'editor es mostra una vora tènue per poder-la trobar
            if (opts.ghost && op.clean && (!el.fill || el.fill === 'transparent')) {
              const z = opts.zoom || 1;
              ctx.save();
              ctx.globalAlpha *= 0.7;
              ctx.strokeStyle = THEMES[theme].muted;
              ctx.lineWidth = 1 / z;
              ctx.setLineDash([5 / z, 5 / z]);
              ctx.stroke(p2d(op, 'clean'));
              ctx.restore();
            }
            break;
          }
          ctx.strokeStyle = stroke;
          ctx.lineWidth = op.width;
          ctx.setLineDash(op.dash || []);
          ctx.stroke(p2d(op, 'd'));
          break;
        case 'text':
          drawText(ctx, el, stroke);
          break;
        case 'image':
          drawImage(ctx, el, theme, opts);
          break;
      }
    }
    ctx.restore();
  }

  /* ---------------- Exportació ---------------- */
  function exportFrame(els, pad) {
    const b = sceneBounds(els);
    let extra = 0;
    for (const el of els) extra = Math.max(extra, (el.strokeWidth || 1) * 2);
    pad += extra;
    return { b, pad, w: Math.ceil(b.w + pad * 2), h: Math.ceil(b.h + pad * 2) };
  }

  function renderToCanvas(els, opts) {
    const theme = opts.theme || 'light';
    const { b, pad, w, h } = exportFrame(els, opts.pad == null ? 20 : opts.pad);
    let s = opts.scale || 1;
    const MAXD = 16000;
    if (w * s > MAXD) s = MAXD / w;
    if (h * s > MAXD) s = Math.min(s, MAXD / h);
    if (w * h * s * s > 1.2e8) s = Math.sqrt(1.2e8 / (w * h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * s));
    c.height = Math.max(1, Math.ceil(h * s));
    const x = c.getContext('2d');
    x.scale(s, s);
    if (opts.bg) {
      x.fillStyle = THEMES[theme].bg;
      x.fillRect(0, 0, w, h);
    }
    x.translate(pad - b.x, pad - b.y);
    for (const el of els) drawElement(x, el, theme, { files: opts.files });
    return c;
  }

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const n2 = (v) => Math.round(v * 100) / 100;

  function svgTransform(el, ox, oy) {
    let t = 'translate(' + n2(el.x + ox) + ' ' + n2(el.y + oy) + ')';
    if (el.angle) {
      const lb = localBounds(el);
      t += ' rotate(' + n2((el.angle * 180) / Math.PI) + ' ' + n2(lb.x + lb.w / 2) + ' ' + n2(lb.y + lb.h / 2) + ')';
    }
    return t;
  }

  function toSVG(els, opts) {
    const theme = opts.theme || 'light';
    const files = opts.files || {};
    const { b, pad, w, h } = exportFrame(els, opts.pad == null ? 20 : opts.pad);
    const ox = pad - b.x, oy = pad - b.y;
    let body = '';
    let clipN = 0;
    let usesHand = false;
    for (const el of els) {
      const stroke = themeColor(el.stroke, theme);
      const fill = themeColor(el.fill, theme);
      const op100 = el.opacity == null ? 100 : el.opacity;
      let g = '<g transform="' + svgTransform(el, ox, oy) + '"' + (op100 < 100 ? ' opacity="' + op100 / 100 + '"' : '') + '>';
      for (const op of getOps(el)) {
        if (op.t === 'fill') {
          g += '<path d="' + op.d + '" fill="' + fill + '" stroke="none"/>';
        } else if (op.t === 'stroke') {
          if (stroke === 'transparent') continue;
          g += '<path d="' + op.d + '" fill="none" stroke="' + stroke + '" stroke-width="' + op.width +
            '" stroke-linecap="round" stroke-linejoin="round"' + (op.dash ? ' stroke-dasharray="' + op.dash.join(' ') + '"' : '') + '/>';
        } else if (op.t === 'hachure') {
          const id = 'pc' + clipN++;
          g += '<clipPath id="' + id + '"><path d="' + op.clip + '"/></clipPath>' +
            '<path d="' + op.d + '" clip-path="url(#' + id + ')" fill="none" stroke="' + fill + '" stroke-width="' + op.width + '" stroke-linecap="round"/>';
        } else if (op.t === 'text') {
          if (el.fontFamily === 'hand' || !FONTS[el.fontFamily]) usesHand = true;
          const lines = String(el.text || '').split('\n');
          const fs = el.fontSize, lh = fs * LH;
          const f = el.textAlign === 'center' ? 0.5 : el.textAlign === 'right' ? 1 : 0;
          const anchor = f === 0.5 ? 'middle' : f === 1 ? 'end' : 'start';
          const bo = baselineOffset(fs, el.fontFamily);
          lines.forEach((ln, i) => {
            g += '<text x="' + n2(el.w * f) + '" y="' + n2(i * lh + bo) + '" font-family="' + esc(FONTS[el.fontFamily] || FONTS.hand) +
              '" font-size="' + fs + '" fill="' + stroke + '" text-anchor="' + anchor + '" xml:space="preserve">' + esc(ln) + '</text>';
          });
        } else if (op.t === 'image') {
          const src = files[el.fileId];
          const flip = el.flipX || el.flipY
            ? ' transform="matrix(' + (el.flipX ? -1 : 1) + ' 0 0 ' + (el.flipY ? -1 : 1) + ' ' + (el.flipX ? n2(el.w) : 0) + ' ' + (el.flipY ? n2(el.h) : 0) + ')"'
            : '';
          if (src) g += '<image href="' + esc(src) + '" x="0" y="0" width="' + n2(el.w) + '" height="' + n2(el.h) + '" preserveAspectRatio="none"' + flip + '/>';
        }
      }
      body += g + '</g>';
    }
    const style = usesHand
      ? '<style>@import url("https://fonts.googleapis.com/css2?family=Caveat:wght@400..700&amp;display=swap");</style>'
      : '';
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<!-- Creat amb Pissarra -->' + style +
      (opts.bg ? '<rect width="100%" height="100%" fill="' + THEMES[theme].bg + '"/>' : '') +
      body + '</svg>'
    );
  }

  global.PissarraRender = {
    LH, FONTS, THEMES,
    themeColor, measureText, clearMetrics, baselineOffset,
    getOps, getBounds, rawBounds, elCenter, sceneBounds, linearSamples, freedrawWidth,
    drawElement, preloadImages, renderToCanvas, toSVG,
  };
})(window);
