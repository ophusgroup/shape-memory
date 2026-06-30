// lattice-morph.js
// AnyWidget: the unit-cell mechanism of the NiTi transformation.
// Morphs a small B2 (cubic austenite) supercell into B19' (monoclinic
// martensite) by a deformation gradient plus an alternating shuffle, with a
// slider / play control. Atoms are colored red (austenite) -> cyan (martensite)
// by the morph fraction. Pure ESM, three.js from CDN, shadow-DOM safe.
//
// Embed:
//   :::{anywidget} ./widgets/lattice-morph.js
//   { "a_b2": 3.015, "a_m": 2.898, "b_m": 4.108, "c_m": 4.646, "beta_m": 97.78 }
//   :::

import * as THREE from "https://esm.sh/three@0.160.0";

function modelGet(model, key, fallback) {
  if (model && typeof model.get === "function") {
    const v = model.get(key);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return fallback;
}
function opColor(t) {
  t = Math.max(0, Math.min(1, t));
  const s = [[0.0,[0.95,0.23,0.13]],[0.5,[0.66,0.42,0.52]],[1.0,[0.0,0.72,1.0]]];
  let a=s[0], b=s[2];
  for (let i=0;i<s.length-1;i++){ if(t>=s[i][0]&&t<=s[i+1][0]){a=s[i];b=s[i+1];break;} }
  const f=(t-a[0])/((b[0]-a[0])||1);
  return [a[1][0]+f*(b[1][0]-a[1][0]),a[1][1]+f*(b[1][1]-a[1][1]),a[1][2]+f*(b[1][2]-a[1][2])];
}

function render({ model, el }) {
  const uid = "lm" + Math.random().toString(36).slice(2, 8);
  const aB2 = +modelGet(model, "a_b2", 3.015);
  const aM = +modelGet(model, "a_m", 2.898);
  const bM = +modelGet(model, "b_m", 4.108);
  const cM = +modelGet(model, "c_m", 4.646);
  const betaM = +modelGet(model, "beta_m", 97.78) * Math.PI / 180;

  // styles
  const style = document.createElement("style");
  style.textContent = `
    .${uid}-wrap{font-family:-apple-system,sans-serif;}
    .${uid}-panel{border-radius:10px;overflow:hidden;position:relative;
      background:linear-gradient(160deg,#0c1118,#161d28);}
    .${uid}-cv{display:block;width:100%;height:340px;cursor:grab;}
    .${uid}-cv:active{cursor:grabbing;}
    .${uid}-tag{position:absolute;top:10px;left:12px;font-size:12px;font-weight:600;
      color:#cfd8e6;background:rgba(0,0,0,.32);padding:3px 9px;border-radius:20px;}
    .${uid}-phase{position:absolute;top:10px;right:12px;font-size:13px;font-weight:700;
      padding:3px 11px;border-radius:20px;}
    .${uid}-ctrls{display:flex;gap:12px;align-items:center;margin-top:10px;
      padding:10px 12px;border-radius:10px;background:var(--mystmd-surface,#f4f6fa);}
    .${uid}-btn{border:none;border-radius:8px;padding:8px 16px;font-weight:600;
      cursor:pointer;background:#1763d6;color:#fff;}
    .${uid}-sld{flex:1;}
  `;
  el.appendChild(style);

  const wrap = document.createElement("div");
  wrap.className = `${uid}-wrap`;
  wrap.innerHTML = `
    <div class="${uid}-panel">
      <canvas class="${uid}-cv"></canvas>
      <div class="${uid}-tag">B2 austenite &rarr; B19' martensite</div>
      <div class="${uid}-phase"></div>
    </div>
    <div class="${uid}-ctrls">
      <button class="${uid}-btn">❚❚ Pause</button>
      <input type="range" class="${uid}-sld" min="0" max="1000" value="0"/>
    </div>`;
  el.appendChild(wrap);

  const canvas = wrap.querySelector(`.${uid}-cv`);
  const btn = wrap.querySelector(`.${uid}-btn`);
  const sld = wrap.querySelector(`.${uid}-sld`);
  const phase = wrap.querySelector(`.${uid}-phase`);

  // build a B2 supercell (Na x Nb x Nc), Ni at corners, Ti at body centers
  const Na = 3, Nb = 3, Nc = 2;
  const ref = [];      // {frac:[u,v,w], z(number)}
  for (let i = 0; i < Na; i++) for (let j = 0; j < Nb; j++) for (let k = 0; k < Nc; k++) {
    ref.push({ f: [i, j, k], ni: true });
    ref.push({ f: [i + 0.5, j + 0.5, k + 0.5], ni: false });
  }
  const L = [Na * aB2, Nb * aB2, Nc * aB2];

  // deformation gradient cubic -> monoclinic (unique axis b)
  const sx = aM / aB2, sy = bM / aB2, sz = cM / aB2;
  const Fm = [
    [sx, 0, sz * Math.cos(betaM)],
    [0, sy, 0],
    [0, 0, sz * Math.sin(betaM)],
  ];
  const I3 = [[1,0,0],[0,1,0],[0,0,1]];
  const lerpM = (t) => I3.map((r, a) => r.map((_, b) => I3[a][b] + t * (Fm[a][b] - I3[a][b])));

  // three.js scene
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
  const group = new THREE.Group(); scene.add(group);
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(4,6,8); scene.add(key);
  const rim = new THREE.DirectionalLight(0x88bbff, 0.5); rim.position.set(-6,-2,-4); scene.add(rim);

  const n = ref.length;
  const geo = new THREE.SphereGeometry(1, 20, 16);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.18 });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n*3), 3);
  group.add(mesh);
  const dummy = new THREE.Object3D();
  const center = new THREE.Vector3(L[0]/2, L[1]/2, L[2]/2);
  const fitDist = Math.max(...L) * 1.7;

  function apply(t) {
    const M = lerpM(t);
    // shuffle amplitude (fractional in x), alternating by (002) plane, peaks mid-morph then settles
    const shuf = 0.12 * t;
    const col = opColor(t);
    for (let i = 0; i < n; i++) {
      const f = ref[i].f;
      const sh = shuf * Math.sin(Math.PI * f[2]) * (ref[i].ni ? 1 : -1);
      const uf = f[0] * aB2 + sh * aB2, vf = f[1] * aB2, wf = f[2] * aB2;
      // cart = M . (uf,vf,wf)
      const x = M[0][0]*uf + M[0][1]*vf + M[0][2]*wf;
      const y = M[1][0]*uf + M[1][1]*vf + M[1][2]*wf;
      const z = M[2][0]*uf + M[2][1]*vf + M[2][2]*wf;
      dummy.position.set(x - center.x, y - center.y, z - center.z);
      const r = (ref[i].ni ? 0.5 : 0.62) * 1.08;
      dummy.scale.set(r, r, r); dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, new THREE.Color(col[0], col[1], col[2]));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    phase.textContent = t < 0.5 ? "austenite" : "martensite";
    phase.style.background = `rgb(${col.map(c=>Math.round(c*255)).join(",")})`;
    phase.style.color = t > 0.55 ? "#04222e" : "#2a0606";
  }

  // orbit
  let rotX = 0.35, rotY = 0.6, autoRot = true, dragging = false, lx=0, ly=0, zoom=1;
  canvas.addEventListener("pointerdown", e=>{dragging=true;autoRot=false;lx=e.clientX;ly=e.clientY;});
  window.addEventListener("pointerup", ()=>{dragging=false;});
  window.addEventListener("pointermove", e=>{ if(!dragging)return;
    rotY+=(e.clientX-lx)*0.01; rotX+=(e.clientY-ly)*0.01; rotX=Math.max(-1.4,Math.min(1.4,rotX));
    lx=e.clientX; ly=e.clientY; });
  canvas.addEventListener("wheel", e=>{e.preventDefault();zoom*=e.deltaY>0?1.07:0.93;zoom=Math.max(0.5,Math.min(2.5,zoom));},{passive:false});

  function resize(){ const w=canvas.clientWidth,h=canvas.clientHeight; if(!w||!h)return;
    renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }

  let playing = true, t = 0, dir = 1, raf = 0;
  function loop() {
    if (playing) {
      t += dir * 0.006;
      if (t >= 1) { t = 1; dir = -1; } else if (t <= 0) { t = 0; dir = 1; }
      sld.value = String(Math.round(t * 1000));
      apply(t);
    }
    if (autoRot) rotY += 0.0035;
    group.rotation.x = rotX; group.rotation.y = rotY;
    camera.position.set(0, 0, fitDist * zoom); camera.lookAt(0,0,0);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  resize(); apply(0); loop();
  new ResizeObserver(resize).observe(canvas);

  btn.addEventListener("click", ()=>{ playing=!playing; btn.textContent = playing?"❚❚ Pause":"▶ Play"; });
  sld.addEventListener("input", ()=>{ playing=false; btn.textContent="▶ Play"; t=+sld.value/1000; apply(t); });

  return () => { if (raf) cancelAnimationFrame(raf); };
}

export default { render };
