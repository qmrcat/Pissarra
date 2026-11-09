/*!
 * Pissarra — sketch.js
 * Generador de traços amb aspecte "fet a mà", sense dependències.
 *
 * Totes les funcions retornen cadenes de camí SVG (atribut "d"), de manera que
 * el mateix resultat es pot pintar al canvas (amb Path2D) o escriure en un SVG.
 * L'algorisme del segment rugós s'inspira en rough.js (llicència MIT).
 */
(function (global) {
  'use strict';

  /** Generador pseudoaleatori determinista (mulberry32): mateixa llavor → mateix dibuix. */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const r2 = (v) => Math.round(v * 100) / 100;
  const pt = (x, y) => r2(x) + ' ' + r2(y);

  /** Un sol traç rugós entre dos punts (corba de Bézier lleugerament corbada). */
  function roughSegment(x1, y1, x2, y2, roughness, rnd, overlay) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (roughness <= 0 || !rnd || len < 1) return 'M' + pt(x1, y1) + 'L' + pt(x2, y2);
    let gain = 1;
    if (len > 500) gain = 0.4;
    else if (len > 200) gain = -0.0016668 * len + 1.233334;
    let offset = 2.4;
    if (offset * offset * 100 > len * len) offset = len / 10;
    const half = offset / 2;
    const off = (x) => roughness * gain * (rnd() * 2 * x - x);
    const diverge = 0.2 + rnd() * 0.2;
    const mx = off((2.6 * (y2 - y1)) / 200);
    const my = off((2.6 * (x1 - x2)) / 200);
    const e = overlay ? half : offset;
    return (
      'M' + pt(x1 + off(e), y1 + off(e)) +
      'C' + pt(mx + x1 + (x2 - x1) * diverge + off(offset), my + y1 + (y2 - y1) * diverge + off(offset)) +
      ' ' + pt(mx + x1 + 2 * (x2 - x1) * diverge + off(offset), my + y1 + 2 * (y2 - y1) * diverge + off(offset)) +
      ' ' + pt(x2 + off(e), y2 + off(e))
    );
  }

  /** Línia recta "a mà": dues passades lleugerament diferents (o una si és discontínua). */
  function line(x1, y1, x2, y2, roughness, rnd, single) {
    if (roughness <= 0 || !rnd) return 'M' + pt(x1, y1) + 'L' + pt(x2, y2);
    let d = roughSegment(x1, y1, x2, y2, roughness, rnd, false);
    if (!single) d += roughSegment(x1, y1, x2, y2, roughness, rnd, true);
    return d;
  }

  function polygon(points, roughness, rnd, single) {
    if (roughness <= 0 || !rnd) return 'M' + points.map((p) => pt(p[0], p[1])).join('L') + 'Z';
    let d = '';
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      d += line(a[0], a[1], b[0], b[1], roughness, rnd, single);
    }
    return d;
  }

  /** Converteix una llista de punts en segments de Bézier cúbics (Catmull-Rom). */
  function bezierSegments(pts) {
    const segs = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || pts[i + 1];
      segs.push([
        p1,
        [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6],
        [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6],
        p2,
      ]);
    }
    return segs;
  }

  function smoothPath(pts) {
    if (!pts.length) return '';
    let d = 'M' + pt(pts[0][0], pts[0][1]);
    if (pts.length === 1) return d + 'L' + pt(pts[0][0] + 0.01, pts[0][1]);
    if (pts.length === 2) return d + 'L' + pt(pts[1][0], pts[1][1]);
    for (const s of bezierSegments(pts)) {
      d += 'C' + pt(s[1][0], s[1][1]) + ' ' + pt(s[2][0], s[2][1]) + ' ' + pt(s[3][0], s[3][1]);
    }
    return d;
  }

  /** Mostreja la corba suau que passa pels punts (per a proves de contacte i límits). */
  function sampleCurve(pts, steps) {
    if (pts.length < 3) return pts.map((p) => [p[0], p[1]]);
    const out = [[pts[0][0], pts[0][1]]];
    for (const [a, b, c, e] of bezierSegments(pts)) {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        out.push([
          u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * e[0],
          u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * e[1],
        ]);
      }
    }
    return out;
  }

  /** Línia o fletxa de 2 o més punts (corba suau quan n'hi ha més de 2). */
  function curve(pts, roughness, rnd, single) {
    if (pts.length === 2) return line(pts[0][0], pts[0][1], pts[1][0], pts[1][1], roughness, rnd, single);
    if (roughness <= 0 || !rnd || pts.length < 2) return smoothPath(pts);
    const j = roughness * 1.2;
    let d = '';
    const passes = single ? 1 : 2;
    for (let p = 0; p < passes; p++) {
      const k = p ? 0.6 : 1;
      d += smoothPath(pts.map((q) => [q[0] + (rnd() * 2 - 1) * j * k, q[1] + (rnd() * 2 - 1) * j * k]));
    }
    return d;
  }

  function ellipsePass(cx, cy, rx, ry, roughness, rnd, overlay) {
    const perim = Math.PI * 2 * Math.sqrt((rx * rx + ry * ry) / 2);
    const n = Math.max(8, Math.min(36, Math.round(perim / 18)));
    const step = (Math.PI * 2) / n;
    const amp = roughness * Math.min(3, 0.6 + Math.min(rx, ry) * 0.02);
    const f1 = rnd() * Math.PI * 2;
    const f2 = rnd() * Math.PI * 2;
    const start = rnd() * Math.PI * 2;
    const noise = (a) => amp * (0.6 * Math.sin(2 * a + f1) + 0.4 * Math.sin(3 * a + f2)) + (rnd() * 2 - 1) * amp * 0.2;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = start + i * step;
      const o = noise(a);
      pts.push([cx + (rx + o) * Math.cos(a), cy + (ry + o) * Math.sin(a)]);
    }
    // Petit solapament final, com quan es tanca un cercle a mà alçada
    const a = start + Math.PI * 2 + step * (overlay ? 0.2 + rnd() * 0.3 : 0.35 + rnd() * 0.4);
    const o = noise(a) * 1.4;
    pts.push([cx + (rx + o) * Math.cos(a), cy + (ry + o) * Math.sin(a)]);
    return smoothPath(pts);
  }

  function ellipse(cx, cy, rx, ry, roughness, rnd, single) {
    rx = Math.abs(rx);
    ry = Math.abs(ry);
    if (roughness <= 0 || !rnd) {
      return (
        'M' + pt(cx + rx, cy) +
        'A' + r2(rx) + ' ' + r2(ry) + ' 0 1 0 ' + pt(cx - rx, cy) +
        'A' + r2(rx) + ' ' + r2(ry) + ' 0 1 0 ' + pt(cx + rx, cy) + 'Z'
      );
    }
    let d = ellipsePass(cx, cy, rx, ry, roughness, rnd, false);
    if (!single) d += ellipsePass(cx, cy, rx, ry, roughness, rnd, true);
    return d;
  }

  /** Rectangle (amb cantonades arrodonides opcionals) amb origen a 0,0. */
  function roundedRect(w, h, rad, roughness, rnd, single) {
    rad = Math.max(0, Math.min(rad, w / 2, h / 2));
    if (rad <= 0.5) return polygon([[0, 0], [w, 0], [w, h], [0, h]], roughness, rnd, single);
    if (roughness <= 0 || !rnd) {
      return (
        'M' + pt(rad, 0) + 'L' + pt(w - rad, 0) + 'Q' + pt(w, 0) + ' ' + pt(w, rad) +
        'L' + pt(w, h - rad) + 'Q' + pt(w, h) + ' ' + pt(w - rad, h) +
        'L' + pt(rad, h) + 'Q' + pt(0, h) + ' ' + pt(0, h - rad) +
        'L' + pt(0, rad) + 'Q' + pt(0, 0) + ' ' + pt(rad, 0) + 'Z'
      );
    }
    let d = '';
    const passes = single ? 1 : 2;
    for (let p = 0; p < passes; p++) {
      const ov = p === 1;
      const k = ov ? 0.5 : 0.9;
      const o = () => (rnd() * 2 - 1) * roughness * k;
      const corner = (ax, ay, cx, cy, bx, by) =>
        'M' + pt(ax + o(), ay + o()) + 'Q' + pt(cx + o(), cy + o()) + ' ' + pt(bx + o(), by + o());
      d += roughSegment(rad, 0, w - rad, 0, roughness, rnd, ov);
      d += corner(w - rad, 0, w, 0, w, rad);
      d += roughSegment(w, rad, w, h - rad, roughness, rnd, ov);
      d += corner(w, h - rad, w, h, w - rad, h);
      d += roughSegment(w - rad, h, rad, h, roughness, rnd, ov);
      d += corner(rad, h, 0, h, 0, h - rad);
      d += roughSegment(0, h - rad, 0, rad, roughness, rnd, ov);
      d += corner(0, rad, 0, 0, rad, 0);
    }
    return d;
  }

  /** Línies paral·leles de ratllat que cobreixen la caixa 0,0–w,h (es retallen amb la forma). */
  function hachure(w, h, angleDeg, gap, roughness, rnd) {
    const a = (angleDeg * Math.PI) / 180;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const nx = -dy;
    const ny = dx;
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.hypot(w, h) / 2 + 2;
    if ((2 * R) / gap > 500) gap = (2 * R) / 500;
    let d = '';
    for (let o = -R + gap / 2; o < R; o += gap) {
      const px = cx + nx * o;
      const py = cy + ny * o;
      const half = Math.sqrt(Math.max(0, R * R - o * o));
      d += roughSegment(px - dx * half, py - dy * half, px + dx * half, py + dy * half, roughness, rnd, false);
    }
    return d;
  }

  function arrowhead(tip, from, size, roughness, rnd) {
    const a = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
    const sp = Math.PI / 7.5;
    const l = [tip[0] - size * Math.cos(a - sp), tip[1] - size * Math.sin(a - sp)];
    const r = [tip[0] - size * Math.cos(a + sp), tip[1] - size * Math.sin(a + sp)];
    const rough = roughness * 0.6;
    return line(l[0], l[1], tip[0], tip[1], rough, rnd, false) + line(r[0], r[1], tip[0], tip[1], rough, rnd, false);
  }

  /** Traç de llapis: corba quadràtica pels punts mitjos (suavitza el tremolor). */
  function freehand(pts) {
    if (pts.length < 3) return smoothPath(pts);
    let d = 'M' + pt(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += 'Q' + pt(pts[i][0], pts[i][1]) + ' ' + pt(mx, my);
    }
    const last = pts[pts.length - 1];
    return d + 'L' + pt(last[0], last[1]);
  }

  global.PissarraSketch = {
    rng, line, polygon, curve, smoothPath, sampleCurve, bezierSegments,
    ellipse, roundedRect, hachure, arrowhead, freehand,
  };
})(window);
