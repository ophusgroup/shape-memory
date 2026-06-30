// elastocaloric.js
// AnyWidget: cyclic load/unload of a NiTi supercell computed with MACE-MP0.
//
//   left panel  : 3D atoms, colored by a per-atom order parameter
//                 (red = austenite / hot  ->  cyan = martensite),
//                 animated through the loading -> unloading cycle.
//   right panel : stress / energy / heat-flow vs strain, the loop tracing out
//                 in sync with the animation, with the current state marked.
//
// Data contract (produced by src/shapemem/export.py):
//   meta json: { n_frames, n_atoms, numbers[], cells[nf][9], bin{...},
//                op_range[2], curves{strain,stress_gpa,energy_per_atom,
//                heat_flow_ev,cum_heat_ev}, meta{...} }
//   bin: float32  positions[nf,na,3]  then  op[nf,na]
//
// Embed via MyST:
//   :::{anywidget} ./widgets/elastocaloric.js
//   { "data_url": "../widgets/data/niti_5050.bin",
//     "meta_url": "../widgets/data/niti_5050.json" }
//   :::
//
// Pure ESM. three.js is pulled from a CDN; everything else is dependency-free
// and shadow-DOM safe (all DOM scoped to `el`, CSS injected as a <style> child).

import * as THREE from "https://esm.sh/three@0.160.0";

// ------------------------------------------------------------------ helpers
function modelGet(model, key, fallback) {
  if (model && typeof model.get === "function") {
    const v = model.get(key);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return fallback;
}

// order-parameter colormap: 0 = austenite (hot red) -> 1 = martensite (cyan)
function opColor(t) {
  t = Math.max(0, Math.min(1, t));
  // red (0.92,0.16,0.12) -> pale (0.85,0.85,0.85) -> cyan (0.0,0.70,1.0)
  const stops = [
    [0.0, [0.95, 0.23, 0.13]],   // austenite, hot red
    [0.5, [0.66, 0.42, 0.52]],   // muted transition (not washed white)
    [1.0, [0.0, 0.72, 1.0]],     // martensite, cyan
  ];
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
  }
  const f = (t - a[0]) / (b[0] - a[0] || 1);
  return [
    a[1][0] + f * (b[1][0] - a[1][0]),
    a[1][1] + f * (b[1][1] - a[1][1]),
    a[1][2] + f * (b[1][2] - a[1][2]),
  ];
}

// element -> display radius (A, scaled) and a base hue for the "element" mode
const ELEM = {
  22: { sym: "Ti", r: 0.62 },  // Ti
  28: { sym: "Ni", r: 0.50 },  // Ni
  29: { sym: "Cu", r: 0.52 },
  72: { sym: "Hf", r: 0.66 },
  26: { sym: "Fe", r: 0.50 },
  46: { sym: "Pd", r: 0.58 },
};
function elemInfo(z) { return ELEM[z] || { sym: String(z), r: 0.55 }; }

async function loadData(dataUrl, metaUrl) {
  const [binRes, metaRes] = await Promise.all([fetch(dataUrl), fetch(metaUrl)]);
  if (!binRes.ok) throw new Error(`fetch ${dataUrl}: ${binRes.status}`);
  if (!metaRes.ok) throw new Error(`fetch ${metaUrl}: ${metaRes.status}`);
  const meta = await metaRes.json();
  const buf = await binRes.arrayBuffer();
  const all = new Float32Array(buf);
  const nf = meta.n_frames, na = meta.n_atoms;
  const posOff = meta.bin.positions.offset / 4;
  const opOff = meta.bin.op.offset / 4;
  const positions = all.subarray(posOff, posOff + nf * na * 3);
  const op = all.subarray(opOff, opOff + nf * na);
  return { meta, positions, op };
}

// ------------------------------------------------------------------ styles
function injectCSS(el, uid) {
  const css = `
  .${uid}-wrap{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    color:inherit;width:100%;box-sizing:border-box;}
  .${uid}-row{display:flex;gap:14px;flex-wrap:wrap;align-items:stretch;}
  .${uid}-panel{flex:1 1 320px;min-width:300px;border-radius:10px;overflow:hidden;
    background:linear-gradient(160deg,#0c1118,#161d28);position:relative;}
  .${uid}-panel.light{background:linear-gradient(160deg,#f4f6fa,#e9edf3);}
  .${uid}-canvas{display:block;width:100%;height:360px;cursor:grab;}
  .${uid}-canvas:active{cursor:grabbing;}
  .${uid}-plot{display:block;width:100%;height:360px;}
  .${uid}-ctrls{display:flex;gap:12px;align-items:center;flex-wrap:wrap;
    margin-top:12px;padding:10px 12px;border-radius:10px;
    background:var(--mystmd-surface,#f4f6fa);}
  .${uid}-btn{appearance:none;border:none;border-radius:8px;padding:8px 16px;
    font-size:14px;font-weight:600;cursor:pointer;background:#1763d6;color:#fff;}
  .${uid}-btn:hover{background:#1257bd;}
  .${uid}-slider{flex:1 1 160px;min-width:120px;}
  .${uid}-sel{padding:6px 8px;border-radius:7px;border:1px solid #c5ccd6;
    background:#fff;font-size:13px;color:#1a1a1a;}
  .${uid}-tag{position:absolute;top:10px;left:12px;font-size:12px;font-weight:600;
    letter-spacing:.02em;color:#cfd8e6;background:rgba(0,0,0,.32);
    padding:3px 9px;border-radius:20px;backdrop-filter:blur(2px);}
  .${uid}-read{display:flex;gap:16px;font-variant-numeric:tabular-nums;font-size:13px;}
  .${uid}-read b{font-weight:700;}
  .${uid}-legend{position:absolute;bottom:10px;left:12px;right:12px;height:10px;
    border-radius:6px;background:linear-gradient(90deg,
      rgb(237,46,31),rgb(219,214,209),rgb(0,179,255));}
  .${uid}-legtxt{position:absolute;bottom:22px;left:12px;right:12px;
    display:flex;justify-content:space-between;font-size:11px;color:#cfd8e6;}
  `;
  const s = document.createElement("style");
  s.textContent = css;
  el.appendChild(s);
}

// ------------------------------------------------------------------ 3D view
function makeScene(canvas, meta, opRangeMax) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
  const group = new THREE.Group();
  scene.add(group);

  // lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(4, 6, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x88bbff, 0.5); rim.position.set(-6, -2, -4);
  scene.add(rim);

  const na = meta.n_atoms;
  const sphereGeo = new THREE.SphereGeometry(1, 20, 16);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.18 });
  const mesh = new THREE.InstancedMesh(sphereGeo, mat, na);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(na * 3), 3);
  group.add(mesh);

  const radii = meta.numbers.map((z) => elemInfo(z).r);

  // cell box (wireframe) — built from the first frame's cell each update
  const boxMat = new THREE.LineBasicMaterial({ color: 0x5f7799, transparent: true, opacity: 0.5 });
  let boxLines = null;

  const dummy = new THREE.Object3D();

  function setBox(cell) {
    if (boxLines) { group.remove(boxLines); boxLines.geometry.dispose(); }
    const a = [cell[0], cell[1], cell[2]];
    const b = [cell[3], cell[4], cell[5]];
    const c = [cell[6], cell[7], cell[8]];
    const O = [0, 0, 0];
    const add = (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
    const v = [O, a, b, c, add(a, b), add(a, c), add(b, c), add(add(a, b), c)];
    const E = [[0,1],[0,2],[0,3],[1,4],[1,5],[2,4],[2,6],[3,5],[3,6],[4,7],[5,7],[6,7]];
    const pts = [];
    const mk = (p) => new THREE.Vector3(p[0] - center.x, p[1] - center.y, p[2] - center.z);
    for (const [i, j] of E) { pts.push(mk(v[i]), mk(v[j])); }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    boxLines = new THREE.LineSegments(g, boxMat);
    group.add(boxLines);
  }

  let center = new THREE.Vector3();
  let fitDist = 30;
  function frameCamera(cell) {
    const a = new THREE.Vector3(cell[0], cell[1], cell[2]);
    const b = new THREE.Vector3(cell[3], cell[4], cell[5]);
    const c = new THREE.Vector3(cell[6], cell[7], cell[8]);
    center = a.clone().add(b).add(c).multiplyScalar(0.5);
    const ext = Math.max(a.length(), b.length(), c.length());
    // atoms and box are drawn relative to `center`, so the camera looks at the
    // origin straight down the projection (third / "beam") axis.
    fitDist = ext * 1.7;
    camera.position.set(0, 0, fitDist);
    camera.lookAt(0, 0, 0);
  }

  function update(positions, op, cell, frame, colorMode) {
    const na = meta.n_atoms;
    const base = frame * na * 3;
    const opBase = frame * na;
    for (let i = 0; i < na; i++) {
      const x = positions[base + i * 3] - center.x,
            y = positions[base + i * 3 + 1] - center.y,
            z = positions[base + i * 3 + 2] - center.z;
      dummy.position.set(x, y, z);
      const r = radii[i] * 1.08;
      dummy.scale.set(r, r, r);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      let col;
      if (colorMode === "element") {
        col = meta.numbers[i] === 28 ? [0.55, 0.60, 0.66] : [0.86, 0.62, 0.30];
      } else {
        col = opColor(op[opBase + i] / (opRangeMax || 1));
      }
      mesh.setColorAt(i, new THREE.Color(col[0], col[1], col[2]));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  // hand-rolled orbit (avoids OrbitControls addon import)
  let rotX = 0, rotY = 0, autoRot = true;
  let dragging = false, lx = 0, ly = 0;
  canvas.addEventListener("pointerdown", (e) => { dragging = true; autoRot = false; lx = e.clientX; ly = e.clientY; });
  window.addEventListener("pointerup", () => { dragging = false; });
  window.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    rotY += (e.clientX - lx) * 0.01; rotX += (e.clientY - ly) * 0.01;
    rotX = Math.max(-1.4, Math.min(1.4, rotX));
    lx = e.clientX; ly = e.clientY;
  });
  let zoom = 1;
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); zoom *= e.deltaY > 0 ? 1.07 : 0.93; zoom = Math.max(0.4, Math.min(3, zoom)); }, { passive: false });

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  function draw() {
    if (autoRot) rotY += 0.0045;
    group.rotation.x = rotX;
    group.rotation.y = rotY;
    camera.position.set(0, 0, fitDist * zoom);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }

  return { renderer, scene, camera, group, setBox, frameCamera, update, resize, draw,
    setAuto: (v) => { autoRot = v; }, getZoom: () => zoom,
  };
}

// ------------------------------------------------------------------ 2D plot
function makePlot(canvas, curves) {
  const ctx = canvas.getContext("2d");
  const series = {
    stress: { y: curves.stress_gpa, label: "axial stress", unit: "GPa", color: "#e23a3a" },
    energy: { y: curves.energy_per_atom, label: "energy", unit: "eV/atom", color: "#1763d6" },
    heat: { y: curves.heat_flow_ev, label: "heat flow / step", unit: "eV", color: "#13a88a" },
    cumheat: { y: curves.cum_heat_ev, label: "cumulative heat", unit: "eV", color: "#a23bbd" },
  };
  const strain = curves.strain.map((s) => s * 100);

  function draw(which, frame, dark) {
    const s = series[which];
    const w = canvas.width, h = canvas.height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== canvas.clientWidth * dpr) {
      canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr;
    }
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const padL = 64 * dpr, padR = 16 * dpr, padT = 22 * dpr, padB = 42 * dpr;
    const x0 = padL, x1 = W - padR, y0 = H - padB, y1 = padT;
    const xmin = Math.min(...strain), xmax = Math.max(...strain);
    let ymin = Math.min(...s.y), ymax = Math.max(...s.y);
    const pad = (ymax - ymin) * 0.08 || 1; ymin -= pad; ymax += pad;
    const sx = (v) => x0 + (v - xmin) / (xmax - xmin) * (x1 - x0);
    const sy = (v) => y0 + (v - ymin) / (ymax - ymin) * (y1 - y0);

    const fg = dark ? "#cfd8e6" : "#33404f";
    const grid = dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.07)";

    // axes + grid
    ctx.strokeStyle = grid; ctx.lineWidth = 1 * dpr;
    ctx.font = `${12 * dpr}px -apple-system,sans-serif`; ctx.fillStyle = fg;
    for (let g = 0; g <= 5; g++) {
      const yy = y1 + (y0 - y1) * g / 5;
      ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke();
      const val = ymax + (ymin - ymax) * g / 5;
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillText(val.toFixed(Math.abs(val) < 1 ? 2 : 1), x0 - 8 * dpr, yy);
    }
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (let g = 0; g <= 5; g++) {
      const xx = x0 + (x1 - x0) * g / 5;
      const val = xmin + (xmax - xmin) * g / 5;
      ctx.fillText(val.toFixed(1), xx, y0 + 8 * dpr);
    }
    // axis labels
    ctx.fillStyle = fg; ctx.font = `${13 * dpr}px -apple-system,sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("strain (%)", (x0 + x1) / 2, H - 16 * dpr);
    ctx.save(); ctx.translate(16 * dpr, (y0 + y1) / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${s.label} (${s.unit})`, 0, 0); ctx.restore();

    // full path (faint)
    ctx.strokeStyle = dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.18)";
    ctx.lineWidth = 1.5 * dpr; ctx.beginPath();
    for (let i = 0; i < strain.length; i++) {
      const X = sx(strain[i]), Y = sy(s.y[i]);
      i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
    }
    ctx.stroke();

    // traversed path (bold, up to current frame)
    ctx.strokeStyle = s.color; ctx.lineWidth = 2.6 * dpr; ctx.beginPath();
    for (let i = 0; i <= frame; i++) {
      const X = sx(strain[i]), Y = sy(s.y[i]);
      i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
    }
    ctx.stroke();

    // current marker
    const cx = sx(strain[frame]), cy = sy(s.y[frame]);
    ctx.fillStyle = s.color;
    ctx.beginPath(); ctx.arc(cx, cy, 5.5 * dpr, 0, 2 * Math.PI); ctx.fill();
    ctx.strokeStyle = dark ? "#0c1118" : "#fff"; ctx.lineWidth = 2 * dpr; ctx.stroke();
  }
  return { draw, series };
}

// ------------------------------------------------------------------ optional reference overlay
function drawReference(plotCtx) { /* reserved for results page overlay variant */ }

// ------------------------------------------------------------------ main
function render({ model, el }) {
  const uid = "ec" + Math.random().toString(36).slice(2, 8);
  injectCSS(el, uid);
  const dataUrl = modelGet(model, "data_url", "../widgets/data/niti_5050.bin");
  const metaUrl = modelGet(model, "meta_url", "../widgets/data/niti_5050.json");
  const dark = (model && modelGet(model, "theme", "")) === "dark";

  const wrap = document.createElement("div"); wrap.className = `${uid}-wrap`;
  wrap.innerHTML = `
    <div class="${uid}-row">
      <div class="${uid}-panel">
        <canvas class="${uid}-canvas"></canvas>
        <div class="${uid}-tag">supercell · view down projection axis</div>
        <div class="${uid}-legtxt"><span>austenite (hot)</span><span>martensite</span></div>
        <div class="${uid}-legend"></div>
      </div>
      <div class="${uid}-panel light">
        <canvas class="${uid}-plot"></canvas>
        <div class="${uid}-tag" style="color:#33404f;background:rgba(255,255,255,.5)">load → unload cycle</div>
      </div>
    </div>
    <div class="${uid}-ctrls">
      <button class="${uid}-btn">❚❚ Pause</button>
      <input type="range" class="${uid}-slider" min="0" max="1" value="0" step="1"/>
      <label style="font-size:13px">plot:
        <select class="${uid}-sel">
          <option value="stress">stress – strain</option>
          <option value="energy">energy</option>
          <option value="heat">heat flow</option>
          <option value="cumheat">cumulative heat</option>
        </select>
      </label>
      <label style="font-size:13px">color:
        <select class="${uid}-sel2">
          <option value="op">order parameter</option>
          <option value="element">element</option>
        </select>
      </label>
      <div class="${uid}-read"></div>
    </div>`;
  el.appendChild(wrap);

  const canvas3d = wrap.querySelector(`.${uid}-canvas`);
  const canvas2d = wrap.querySelector(`.${uid}-plot`);
  const btn = wrap.querySelector(`.${uid}-btn`);
  const slider = wrap.querySelector(`.${uid}-slider`);
  const sel = wrap.querySelector(`.${uid}-sel`);
  const sel2 = wrap.querySelector(`.${uid}-sel2`);
  const read = wrap.querySelector(`.${uid}-read`);

  let state = { frame: 0, playing: true, which: "stress", colorMode: "op", data: null, scene: null, plot: null, raf: 0 };

  loadData(dataUrl, metaUrl).then(({ meta, positions, op }) => {
    const nf = meta.n_frames;
    slider.max = String(nf - 1);
    const opMax = (meta.op_range && meta.op_range[1]) || 0.2;
    const scene = makeScene(canvas3d, meta, opMax);
    const plot = makePlot(canvas2d, meta.curves);
    state.data = { meta, positions, op };
    state.scene = scene; state.plot = plot;

    const cell0 = meta.cells[0];
    scene.frameCamera(cell0);
    scene.resize();

    function applyFrame(f) {
      const cell = meta.cells[f];
      scene.update(positions, op, cell, f, state.colorMode);
      scene.setBox(cell);
      plot.draw(state.which, f, dark);
      const c = meta.curves;
      read.innerHTML =
        `<span>ε <b>${(c.strain[f] * 100).toFixed(2)}%</b></span>` +
        `<span>σ <b>${c.stress_gpa[f].toFixed(2)} GPa</b></span>` +
        `<span>Q <b>${c.cum_heat_ev[f].toFixed(3)} eV</b></span>`;
      slider.value = String(f);
    }

    function loop() {
      if (state.playing) {
        state.frame = (state.frame + 1) % nf;
        applyFrame(state.frame);
      }
      scene.draw();
      state.raf = requestAnimationFrame(loop);
    }
    applyFrame(0);
    loop();

    const ro = new ResizeObserver(() => { scene.resize(); plot.draw(state.which, state.frame, dark); });
    ro.observe(canvas3d); ro.observe(canvas2d);

    btn.addEventListener("click", () => {
      state.playing = !state.playing;
      btn.textContent = state.playing ? "❚❚ Pause" : "▶ Play";
    });
    slider.addEventListener("input", () => {
      state.playing = false; btn.textContent = "▶ Play";
      state.frame = parseInt(slider.value, 10); applyFrame(state.frame);
    });
    sel.addEventListener("change", () => { state.which = sel.value; plot.draw(state.which, state.frame, dark); });
    sel2.addEventListener("change", () => { state.colorMode = sel2.value; applyFrame(state.frame); });
  }).catch((err) => {
    wrap.innerHTML = `<div style="padding:18px;color:#c0392b;font-size:14px">
      Failed to load widget data:<br><code>${err.message}</code></div>`;
  });

  return () => { if (state.raf) cancelAnimationFrame(state.raf); };
}

export default { render };
