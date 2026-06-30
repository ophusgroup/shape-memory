// elastocaloric.js
// AnyWidget: cyclic load/unload of a NiTi supercell computed with MACE-MP0.
//
//   left panel  : the supercell, viewed straight down its projection axis
//                 (orthographic, pseudo-2D), atoms + coordination polyhedra
//                 colored by a per-atom order parameter
//                 (red = austenite / hot  ->  cyan = martensite),
//                 animated through the loading -> unloading cycle.
//   right panel : stress / energy / heat-flow / temperature vs strain, the loop
//                 tracing out in sync, with the current state marked.
//
// Data contract (src/shapemem/export.py):
//   meta json: { n_frames, n_atoms, numbers[], cells[nf][9], bin{...},
//                op_range[2], curves{strain,stress_gpa,energy_per_atom,
//                heat_flow_ev,cum_heat_ev[,temperature_k]}, meta{...} }
//   bin: float32  positions[nf,na,3]  then  op[nf,na]
//
// Pure ESM, three.js from CDN, shadow-DOM safe.

import * as THREE from "https://esm.sh/three@0.160.0";

// ------------------------------------------------------------------ helpers
function modelGet(model, key, fallback) {
  if (model && typeof model.get === "function") {
    const v = model.get(key);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return fallback;
}

function opColor(t) {
  t = Math.max(0, Math.min(1, t));
  const stops = [
    [0.0, [0.95, 0.23, 0.13]],   // austenite, hot red
    [0.5, [0.66, 0.42, 0.52]],   // muted transition
    [1.0, [0.0, 0.72, 1.0]],     // martensite, cyan
  ];
  let a = stops[0], b = stops[2];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
  }
  const f = (t - a[0]) / ((b[0] - a[0]) || 1);
  return [a[1][0] + f*(b[1][0]-a[1][0]), a[1][1] + f*(b[1][1]-a[1][1]), a[1][2] + f*(b[1][2]-a[1][2])];
}

// diverging colormap for twin variants: -1 = variant 2 (orange), 0 = boundary
// (pale), +1 = variant 1 (blue)
function variantColor(t) {
  t = Math.max(-1, Math.min(1, t));
  const v1 = [0.13, 0.45, 0.95], mid = [0.85, 0.85, 0.86], v2 = [0.95, 0.55, 0.10];
  if (t >= 0) { const f = t; return [mid[0]+f*(v1[0]-mid[0]), mid[1]+f*(v1[1]-mid[1]), mid[2]+f*(v1[2]-mid[2])]; }
  const f = -t; return [mid[0]+f*(v2[0]-mid[0]), mid[1]+f*(v2[1]-mid[1]), mid[2]+f*(v2[2]-mid[2])];
}

const ELEM = {
  22: { sym: "Ti", r: 0.72 }, 28: { sym: "Ni", r: 0.42 }, 29: { sym: "Cu", r: 0.44 },
  72: { sym: "Hf", r: 0.80 }, 26: { sym: "Fe", r: 0.42 }, 46: { sym: "Pd", r: 0.52 },
};
function elemInfo(z) { return ELEM[z] || { sym: String(z), r: 0.55 }; }

// 3x3 matrix helpers (row-major, cell rows are lattice vectors)
function inv3(m) {
  const [a,b,c,d,e,f,g,h,i] = m;
  const A=e*i-f*h, B=-(d*i-f*g), C=d*h-e*g;
  const det = a*A + b*B + c*C;
  const id = 1/det;
  return [A*id,(c*h-b*i)*id,(b*f-c*e)*id, B*id,(a*i-c*g)*id,(c*d-a*f)*id, C*id,(b*g-a*h)*id,(a*e-b*d)*id];
}
function vmul3(m, v) { // row-major m, v as [x,y,z], returns v·m (treat v as row)
  return [v[0]*m[0]+v[1]*m[3]+v[2]*m[6], v[0]*m[1]+v[1]*m[4]+v[2]*m[7], v[0]*m[2]+v[1]*m[5]+v[2]*m[8]];
}

async function loadData(dataUrl, metaUrl) {
  const [binRes, metaRes] = await Promise.all([fetch(dataUrl), fetch(metaUrl)]);
  if (!binRes.ok) throw new Error(`fetch ${dataUrl}: ${binRes.status}`);
  if (!metaRes.ok) throw new Error(`fetch ${metaUrl}: ${metaRes.status}`);
  const meta = await metaRes.json();
  const buf = await binRes.arrayBuffer();
  const all = new Float32Array(buf);
  const nf = meta.n_frames, na = meta.n_atoms;
  const positions = all.subarray(meta.bin.positions.offset/4, meta.bin.positions.offset/4 + nf*na*3);
  const op = all.subarray(meta.bin.op.offset/4, meta.bin.op.offset/4 + nf*na);
  return { meta, positions, op };
}

// cube-face corner order (corners indexed by sign bits sx + 2*sy + 4*sz)
const CUBE_FACES = [[0,2,6,4],[1,3,7,5],[0,1,5,4],[2,3,7,6],[0,1,3,2],[4,5,7,6]];

// ------------------------------------------------------------------ styles
function injectCSS(el, uid) {
  const css = `
  .${uid}-wrap{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    color:inherit;width:100%;box-sizing:border-box;}
  .${uid}-row{display:flex;gap:14px;flex-wrap:wrap;align-items:stretch;}
  .${uid}-panel{flex:1 1 340px;min-width:300px;border-radius:10px;overflow:hidden;
    background:linear-gradient(160deg,#0c1118,#161d28);position:relative;}
  .${uid}-panel.light{background:linear-gradient(160deg,#f4f6fa,#e9edf3);}
  .${uid}-canvas{display:block;width:100%;height:380px;cursor:grab;}
  .${uid}-canvas:active{cursor:grabbing;}
  .${uid}-plot{display:block;width:100%;height:380px;}
  /* wide layout: atoms span the full width on top, plot below */
  .${uid}-wrap.wide .${uid}-row{flex-direction:column;flex-wrap:nowrap;}
  .${uid}-wrap.wide .${uid}-panel{flex:0 0 auto;width:100%;min-width:0;}
  .${uid}-wrap.wide .${uid}-canvas{height:600px;}
  .${uid}-wrap.wide .${uid}-plot{height:300px;}
  .${uid}-ctrls{display:flex;gap:12px;align-items:center;flex-wrap:wrap;
    margin-top:12px;padding:10px 12px;border-radius:10px;
    background:var(--mystmd-surface,#f4f6fa);}
  .${uid}-btn{appearance:none;border:none;border-radius:8px;padding:8px 16px;
    font-size:14px;font-weight:600;cursor:pointer;background:#8c1515;color:#fff;
    min-width:104px;text-align:center;box-sizing:border-box;}
  .${uid}-btn:hover{background:#6f1010;}
  .${uid}-elleg{position:absolute;top:10px;left:12px;display:flex;align-items:center;
    gap:5px;font-size:11px;color:#cfd8e6;}
  .${uid}-elleg i{display:inline-block;border-radius:50%;background:#9aa3ad;}
  .${uid}-slider{flex:1 1 150px;min-width:110px;}
  .${uid}-sel{padding:6px 8px;border-radius:7px;border:1px solid #c5ccd6;
    background:#fff;font-size:13px;color:#1a1a1a;}
  .${uid}-chk{display:inline-flex;align-items:center;gap:5px;font-size:13px;cursor:pointer;}
  .${uid}-tag{position:absolute;top:10px;left:12px;font-size:12px;font-weight:600;
    color:#cfd8e6;background:rgba(0,0,0,.32);padding:3px 9px;border-radius:20px;}
  .${uid}-fom{position:absolute;bottom:46px;right:12px;font-size:12px;color:#33404f;
    background:rgba(255,255,255,.7);padding:4px 9px;border-radius:8px;text-align:right;
    line-height:1.35;font-variant-numeric:tabular-nums;}
  .${uid}-fom b{font-weight:700;}
  .${uid}-read{display:flex;gap:14px;font-variant-numeric:tabular-nums;font-size:13px;}
  .${uid}-read b{font-weight:700;}
  .${uid}-legend{position:absolute;bottom:10px;left:12px;right:12px;height:10px;
    border-radius:6px;background:linear-gradient(90deg,rgb(242,59,33),rgb(168,107,133),rgb(0,184,255));}
  .${uid}-legtxt{position:absolute;bottom:22px;left:12px;right:12px;
    display:flex;justify-content:space-between;font-size:11px;color:#cfd8e6;}
  `;
  const s = document.createElement("style"); s.textContent = css; el.appendChild(s);
}

// ------------------------------------------------------------------ 3D view
function makeScene(canvas, meta, positions, opMax, kind) {
  const colFn = kind === "twin" ? variantColor : opColor;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, -2000, 2000);
  camera.position.set(0, 0, 100);
  const group = new THREE.Group();
  scene.add(group);

  scene.add(new THREE.AmbientLight(0xffffff, 0.62));
  const key = new THREE.DirectionalLight(0xffffff, 0.85); key.position.set(3, 5, 9); scene.add(key);
  const rim = new THREE.DirectionalLight(0x88bbff, 0.45); rim.position.set(-5, -3, 4); scene.add(rim);

  const na = meta.n_atoms;
  const radii = meta.numbers.map((z) => elemInfo(z).r);

  // --- atom spheres
  const sphereGeo = new THREE.SphereGeometry(1, 18, 14);
  const sphMat = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.18 });
  const mesh = new THREE.InstancedMesh(sphereGeo, sphMat, na);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(na*3), 3);
  mesh.frustumCulled = false;  // instance bounding sphere goes stale as we animate
  group.add(mesh);
  const dummy = new THREE.Object3D();

  // --- coordination polyhedra (cube of 8 unlike neighbors around each Ti)
  const cell0 = meta.cells[0], inv0 = inv3(cell0);
  const p0 = (i) => [positions[i*3], positions[i*3+1], positions[i*3+2]];
  // corners[k] = 8 entries {j, off:[3]}: nearest unlike-neighbor IMAGES, one per
  // sign octant. Using periodic images (not just unique atoms) means a 1-cell-
  // thick (pseudo-2D) cell still forms a full 8-corner cube.
  const centers = [], corners = [];
  const CENTER_Z = 22, NBR_Z = 28;
  const OFFS = [];
  for (let a=-1;a<=1;a++) for (let b=-1;b<=1;b++) for (let c=-1;c<=1;c++) OFFS.push([a,b,c]);
  const cellRows = [[cell0[0],cell0[1],cell0[2]],[cell0[3],cell0[4],cell0[5]],[cell0[6],cell0[7],cell0[8]]];
  // Pick a sparse, evenly spaced set of Ti centers FIRST, then search corners only
  // for those (keeps setup O(MAXP*na), fast even for thousands of atoms).
  const MAXP = 9;
  const allCenters = [];
  for (let i = 0; i < na; i++) if (meta.numbers[i] === CENTER_Z) allCenters.push(i);
  const chosen = [];
  if (allCenters.length) {
    const stride = Math.max(1, Math.floor(allCenters.length / MAXP));
    for (let k = 0; k < allCenters.length && chosen.length < MAXP; k += stride) chosen.push(allCenters[k]);
  }
  for (const i of chosen) {
    const ci = p0(i); const cand = [];
    for (let j = 0; j < na; j++) {
      if (meta.numbers[j] !== NBR_Z) continue;
      const pj = p0(j);
      for (const off of OFFS) {
        const d = [
          pj[0] + off[0]*cellRows[0][0] + off[1]*cellRows[1][0] + off[2]*cellRows[2][0] - ci[0],
          pj[1] + off[0]*cellRows[0][1] + off[1]*cellRows[1][1] + off[2]*cellRows[2][1] - ci[1],
          pj[2] + off[0]*cellRows[0][2] + off[1]*cellRows[1][2] + off[2]*cellRows[2][2] - ci[2],
        ];
        const r2 = d[0]*d[0]+d[1]*d[1]+d[2]*d[2];
        if (r2 < 12.0) cand.push([r2, j, off, d]);  // ~3.46 A cutoff
      }
    }
    cand.sort((a,b)=>a[0]-b[0]);
    const slot = new Array(8).fill(null);
    for (const [r2, j, off, d] of cand) {
      const b = (d[0]<0?0:1) + (d[1]<0?0:2) + (d[2]<0?0:4);
      if (slot[b] === null) slot[b] = { j, off };
    }
    if (slot.includes(null)) continue;
    centers.push(i); corners.push(slot);
  }
  const nPoly = centers.length;
  const vertsPerPoly = 6 * 6; // 6 faces * 2 tris * 3 verts
  const polyPos = new Float32Array(nPoly * vertsPerPoly * 3);
  const polyCol = new Float32Array(nPoly * vertsPerPoly * 3);
  const polyGeo = new THREE.BufferGeometry();
  polyGeo.setAttribute("position", new THREE.BufferAttribute(polyPos, 3));
  polyGeo.setAttribute("color", new THREE.BufferAttribute(polyCol, 3));
  const polyMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true,
    opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
  const polyMesh = new THREE.Mesh(polyGeo, polyMat);
  polyMesh.frustumCulled = false;
  group.add(polyMesh);

  // --- cell box
  const boxMat = new THREE.LineBasicMaterial({ color: 0x5f7799, transparent: true, opacity: 0.45 });
  let boxLines = null;

  let center = new THREE.Vector3(), extent = 10;
  function frameCamera(cell) {
    const a = new THREE.Vector3(cell[0],cell[1],cell[2]);
    const b = new THREE.Vector3(cell[3],cell[4],cell[5]);
    const c = new THREE.Vector3(cell[6],cell[7],cell[8]);
    center = a.clone().add(b).add(c).multiplyScalar(0.5);
    extent = Math.max(a.length(), b.length()) * 0.78; // in-plane half-size for ortho fit (zoomed out a bit)
  }
  function setFrustum(aspect, zoom) {
    const r = extent / zoom;
    camera.left = -r*aspect; camera.right = r*aspect; camera.top = r; camera.bottom = -r;
    camera.updateProjectionMatrix();
  }

  function setBox(cell) {
    if (boxLines) { group.remove(boxLines); boxLines.geometry.dispose(); }
    const a=[cell[0],cell[1],cell[2]], b=[cell[3],cell[4],cell[5]], c=[cell[6],cell[7],cell[8]], O=[0,0,0];
    const ad=(p,q)=>[p[0]+q[0],p[1]+q[1],p[2]+q[2]];
    const v=[O,a,b,c,ad(a,b),ad(a,c),ad(b,c),ad(ad(a,b),c)];
    const E=[[0,1],[0,2],[0,3],[1,4],[1,5],[2,4],[2,6],[3,5],[3,6],[4,7],[5,7],[6,7]];
    const mk=(p)=>new THREE.Vector3(p[0]-center.x,p[1]-center.y,p[2]-center.z);
    const pts=[]; for(const [i,j] of E) pts.push(mk(v[i]), mk(v[j]));
    boxLines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), boxMat);
    group.add(boxLines);
  }

  let showPoly = true, sphereScale = 0.85;
  // interpolate between frames fa and fb by blend bl in [0,1] for smooth motion
  function update(fa, fb, bl, colorMode) {
    const bA=fa*na*3, bB=fb*na*3, oA=fa*na, oB=fb*na;
    const px=(i)=>(positions[bA+i*3]+bl*(positions[bB+i*3]-positions[bA+i*3]))-center.x;
    const py=(i)=>(positions[bA+i*3+1]+bl*(positions[bB+i*3+1]-positions[bA+i*3+1]))-center.y;
    const pz=(i)=>(positions[bA+i*3+2]+bl*(positions[bB+i*3+2]-positions[bA+i*3+2]))-center.z;
    const opv=(i)=>opArr[oA+i]+bl*(opArr[oB+i]-opArr[oA+i]);
    // spheres
    for (let i=0;i<na;i++){
      dummy.position.set(px(i),py(i),pz(i));
      const r = radii[i]*sphereScale; dummy.scale.set(r,r,r); dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      let col = colorMode==="element"
        ? (meta.numbers[i]===28 ? [0.55,0.60,0.66] : [0.86,0.62,0.30])
        : colFn(opv(i)/(opMax||1));
      mesh.setColorAt(i, new THREE.Color(col[0],col[1],col[2]));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // polyhedra (interpolated cell for min-image). Wrapped so a bad cell can
    // never blank the atoms; degenerate polyhedra are simply skipped.
    if (showPoly && nPoly) {
      try {
        const cA=meta.cells[fa], cB=meta.cells[fb];
        const cell = cA.map((v,idx)=>v+bl*(cB[idx]-v));  // 9, row-major
        const pf = (i)=>[px(i),py(i),pz(i)];
        let w = 0;
        for (let k=0;k<nPoly;k++){
          const c = colorMode==="element" ? [0.45,0.6,0.85] : colFn(opv(centers[k])/(opMax||1));
          const cv = [];  // 8 corner positions = neighbor image positions
          for (let s=0;s<8;s++){
            const { j, off } = corners[k][s];
            const pj = pf(j);
            cv.push([
              pj[0] + off[0]*cell[0] + off[1]*cell[3] + off[2]*cell[6],
              pj[1] + off[0]*cell[1] + off[1]*cell[4] + off[2]*cell[7],
              pj[2] + off[0]*cell[2] + off[1]*cell[5] + off[2]*cell[8],
            ]);
          }
          for (const f of CUBE_FACES){
            for (const t of [[f[0],f[1],f[2]],[f[0],f[2],f[3]]]){ for (const vi of t){
              polyPos[w]=cv[vi][0]; polyPos[w+1]=cv[vi][1]; polyPos[w+2]=cv[vi][2];
              polyCol[w]=c[0]; polyCol[w+1]=c[1]; polyCol[w+2]=c[2]; w+=3;
            }}
          }
        }
        polyGeo.attributes.position.needsUpdate = true;
        polyGeo.attributes.color.needsUpdate = true;
        polyGeo.setDrawRange(0, nPoly*vertsPerPoly);
      } catch (e) { polyGeo.setDrawRange(0, 0); }
    } else {
      polyGeo.setDrawRange(0, 0);
    }
  }
  let opArr = null;
  function setOp(a){ opArr = a; }

  // orbit: default flat (top-down). drag to tilt, wheel to zoom.
  let rotX = 0, rotY = 0, autoRot = false, dragging=false, lx=0, ly=0, zoom=1;
  canvas.addEventListener("pointerdown", e=>{dragging=true; lx=e.clientX; ly=e.clientY;});
  window.addEventListener("pointerup", ()=>{dragging=false;});
  window.addEventListener("pointermove", e=>{ if(!dragging) return;
    rotY+=(e.clientX-lx)*0.01; rotX+=(e.clientY-ly)*0.01; rotX=Math.max(-1.5,Math.min(1.5,rotX));
    lx=e.clientX; ly=e.clientY; });
  canvas.addEventListener("wheel", e=>{e.preventDefault(); zoom*=e.deltaY>0?0.93:1.07; zoom=Math.max(0.4,Math.min(3,zoom)); resize();}, {passive:false});

  function resize(){ const w=canvas.clientWidth,h=canvas.clientHeight; if(!w||!h) return;
    renderer.setSize(w,h,false); setFrustum(w/h, zoom); }

  function draw(){ if(autoRot) rotY+=0.004; group.rotation.x=rotX; group.rotation.y=rotY; renderer.render(scene,camera); }

  return { renderer, frameCamera, setBox, update, setOp, resize, draw,
    setShowPoly:(v)=>{showPoly=v; sphereScale = v?0.85:1.15;},
    resetView:()=>{rotX=0;rotY=0;zoom=1;resize();} };
}

// ------------------------------------------------------------------ 2D plot
function makePlot(canvas, curves, isTwin) {
  const ctx = canvas.getContext("2d");
  const series = {
    stress: { y: curves.stress_gpa, label: isTwin ? "shear stress" : "axial stress", unit: "GPa", color: "#e23a3a" },
    energy: { y: curves.energy_per_atom, label: "energy", unit: "eV/atom", color: "#1763d6" },
    heat: { y: curves.heat_flow_ev, label: "heat flow / step", unit: "eV", color: "#13a88a" },
    cumheat: { y: curves.cum_heat_ev, label: "cumulative heat", unit: "eV", color: "#a23bbd" },
  };
  if (curves.temperature_k) series.temp = { y: curves.temperature_k, label: "temperature", unit: "K", color: "#e8821f" };
  const strain = curves.strain.map((s)=>s*100);

  function draw(which, frame, dark) {
    const s = series[which] || series.stress;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = canvas.clientWidth*dpr; canvas.height = canvas.clientHeight*dpr;
    const W=canvas.width, H=canvas.height; ctx.clearRect(0,0,W,H);
    const padL=64*dpr,padR=16*dpr,padT=22*dpr,padB=42*dpr;
    const x0=padL,x1=W-padR,y0=H-padB,y1=padT;
    const xmin=Math.min(...strain),xmax=Math.max(...strain);
    let ymin=Math.min(...s.y),ymax=Math.max(...s.y); const pad=(ymax-ymin)*0.08||1; ymin-=pad; ymax+=pad;
    const sx=v=>x0+(v-xmin)/(xmax-xmin)*(x1-x0), sy=v=>y0+(v-ymin)/(ymax-ymin)*(y1-y0);
    const fg=dark?"#cfd8e6":"#33404f", grid=dark?"rgba(255,255,255,.08)":"rgba(0,0,0,.07)";
    ctx.strokeStyle=grid; ctx.lineWidth=1*dpr; ctx.font=`${12*dpr}px -apple-system,sans-serif`; ctx.fillStyle=fg;
    for(let g=0;g<=5;g++){ const yy=y1+(y0-y1)*g/5; ctx.beginPath();ctx.moveTo(x0,yy);ctx.lineTo(x1,yy);ctx.stroke();
      const val=ymax+(ymin-ymax)*g/5; ctx.textAlign="right";ctx.textBaseline="middle";
      ctx.fillText(val.toFixed(Math.abs(val)<1?2:1),x0-8*dpr,yy); }
    ctx.textAlign="center";ctx.textBaseline="top";
    for(let g=0;g<=5;g++){ const xx=x0+(x1-x0)*g/5; ctx.fillText((xmin+(xmax-xmin)*g/5).toFixed(1),xx,y0+8*dpr); }
    ctx.font=`${13*dpr}px -apple-system,sans-serif`; ctx.textAlign="center";
    ctx.fillText(isTwin ? "shear strain (%)" : "strain (%)",(x0+x1)/2,H-16*dpr);
    ctx.save();ctx.translate(16*dpr,(y0+y1)/2);ctx.rotate(-Math.PI/2);ctx.fillText(`${s.label} (${s.unit})`,0,0);ctx.restore();
    ctx.strokeStyle=dark?"rgba(255,255,255,.22)":"rgba(0,0,0,.18)"; ctx.lineWidth=1.5*dpr; ctx.beginPath();
    for(let i=0;i<strain.length;i++){ const X=sx(strain[i]),Y=sy(s.y[i]); i?ctx.lineTo(X,Y):ctx.moveTo(X,Y); } ctx.stroke();
    const fa=Math.floor(frame), bl=frame-fa, fb=Math.min(fa+1,strain.length-1);
    ctx.strokeStyle=s.color; ctx.lineWidth=2.6*dpr; ctx.beginPath();
    for(let i=0;i<=fa;i++){ const X=sx(strain[i]),Y=sy(s.y[i]); i?ctx.lineTo(X,Y):ctx.moveTo(X,Y); }
    const mxv=strain[fa]+bl*(strain[fb]-strain[fa]), myv=s.y[fa]+bl*(s.y[fb]-s.y[fa]);
    if (fa>0||bl>0) ctx.lineTo(sx(mxv),sy(myv));
    ctx.stroke();
    const cx=sx(mxv),cy=sy(myv); ctx.fillStyle=s.color;
    ctx.beginPath();ctx.arc(cx,cy,5.5*dpr,0,2*Math.PI);ctx.fill();
    ctx.strokeStyle=dark?"#0c1118":"#fff";ctx.lineWidth=2*dpr;ctx.stroke();
  }
  return { draw, hasTemp: !!series.temp };
}

// ------------------------------------------------------------------ main
function render({ model, el }) {
  const uid = "ec" + Math.random().toString(36).slice(2, 8);
  injectCSS(el, uid);
  const dataUrl = modelGet(model, "data_url", "widgets/data/niti_5050.bin");
  const metaUrl = modelGet(model, "meta_url", "widgets/data/niti_5050.json");
  const wide = modelGet(model, "layout", "") === "wide";
  const polyDefault = modelGet(model, "poly_default", true);

  const wrap = document.createElement("div"); wrap.className = `${uid}-wrap${wide ? " wide" : ""}`;
  wrap.innerHTML = `
    <div class="${uid}-row">
      <div class="${uid}-panel">
        <canvas class="${uid}-canvas"></canvas>
        <div class="${uid}-elleg"><i style="width:13px;height:13px"></i>Ti<i style="width:8px;height:8px"></i>Ni</div>
        <div class="${uid}-legtxt"><span>austenite</span><span>martensite</span></div>
        <div class="${uid}-legend"></div>
      </div>
      <div class="${uid}-panel light">
        <canvas class="${uid}-plot"></canvas>
        <div class="${uid}-fom"></div>
      </div>
    </div>
    <div class="${uid}-ctrls">
      <button class="${uid}-btn">❚❚ Pause</button>
      <input type="range" class="${uid}-slider" min="0" max="1" value="0" step="1"/>
      <label style="font-size:13px">plot:
        <select class="${uid}-sel sel-plot"></select></label>
      <label style="font-size:13px">color:
        <select class="${uid}-sel sel-col">
          <option value="op">order parameter</option>
          <option value="element">element</option>
        </select></label>
      <label class="${uid}-chk"><input type="checkbox" class="chk-poly" ${polyDefault ? "checked" : ""}/>polyhedra</label>
      <div class="${uid}-read"></div>
    </div>`;
  el.appendChild(wrap);

  const $ = (s)=>wrap.querySelector(s);
  const canvas3d=$(`.${uid}-canvas`), canvas2d=$(`.${uid}-plot`), btn=$(`.${uid}-btn`),
        slider=$(`.${uid}-slider`), selPlot=$(`.sel-plot`), selCol=$(`.sel-col`),
        chkPoly=$(`.chk-poly`), read=$(`.${uid}-read`);

  const state = { frame:0, playing:true, which:"stress", colorMode:"op", raf:0 };

  loadData(dataUrl, metaUrl).then(({ meta, positions, op }) => {
    const nf = meta.n_frames; slider.max = String(nf-1);
    const kind = (meta.meta && meta.meta.kind) || "";
    const isTwin = kind === "twin";
    const opMax = isTwin ? 1.0
      : ((meta.op_range && Math.max(Math.abs(meta.op_range[0]), Math.abs(meta.op_range[1]))) || 0.2);

    // twin: only the shear stress-strain is meaningful; otherwise full menu
    const opts = isTwin
      ? [["stress","shear stress – strain"]]
      : [["stress","stress – strain"],["energy","energy"],["heat","heat flow"],["cumheat","cumulative heat"]]
        .concat(meta.curves.temperature_k ? [["temp","temperature"]] : []);
    selPlot.innerHTML = opts.map(([v,l])=>`<option value="${v}">${l}</option>`).join("");

    if (isTwin) {
      // relabel the colormap legend and the colorbar gradient for variants
      const lt = wrap.querySelector(`.${uid}-legtxt`); if (lt) lt.innerHTML = "<span>variant 2</span><span>variant 1</span>";
      const lg = wrap.querySelector(`.${uid}-legend`); if (lg) lg.style.background = "linear-gradient(90deg,rgb(242,140,26),rgb(217,217,219),rgb(33,115,242))";
    }

    const scene = makeScene(canvas3d, meta, positions, opMax, kind);
    const plot = makePlot(canvas2d, meta.curves, isTwin);
    scene.setOp(op);
    scene.setShowPoly(chkPoly.checked);
    scene.frameCamera(meta.cells[0]); scene.resize();

    // figure-of-merit badge (when the dataset carries the metrics)
    const fomEl = wrap.querySelector(`.${uid}-fom`); const m = meta.meta || {};
    if (m.COP || m.eps_tr) {
      let h = "";
      if (m.COP) h += `COP = Q/ΔW = <b>${m.COP.toFixed(1)}</b><br>`;
      if (m.eps_tr) h += `ε<sub>tr</sub> = <b>${(m.eps_tr*100).toFixed(1)}%</b>`;
      fomEl.innerHTML = h;
    } else { fomEl.style.display = "none"; }

    const lerp = (a,b,t)=>a+t*(b-a);
    // render a continuous (float) frame index with interpolation between frames
    function applyFrame(tf) {
      if (!isFinite(tf)) tf = 0;
      let fl = Math.floor(tf);
      const fa = ((fl % nf) + nf) % nf, fb = (fa + 1) % nf, bl = tf - fl;
      const cA = meta.cells[fa], cB = meta.cells[fb];
      if (!cA || !cB) return;
      const cell = cA.map((v,i)=>lerp(v,cB[i],bl));
      scene.update(fa, fb, bl, state.colorMode);
      scene.setBox(cell);
      plot.draw(state.which, tf, false);
      const c = meta.curves;
      const E = lerp(c.strain[fa], c.strain[fb], bl)*100;
      const S = lerp(c.stress_gpa[fa], c.stress_gpa[fb], bl);
      let html = `<span>${isTwin?"γ":"ε"} <b>${E.toFixed(2)}%</b></span><span>σ <b>${S.toFixed(2)} GPa</b></span>`;
      if (isTwin) { /* shear demo: no thermal readout */ }
      else if (c.temperature_k) html += `<span>T <b>${lerp(c.temperature_k[fa],c.temperature_k[fb],bl).toFixed(0)} K</b></span>`;
      else html += `<span>Q <b>${lerp(c.cum_heat_ev[fa],c.cum_heat_ev[fb],bl).toFixed(3)} eV</b></span>`;
      read.innerHTML = html; slider.value = String(Math.round(tf));
    }
    // time-based playback: one full load+unload cycle every LOOP_MS (slow + smooth)
    const LOOP_MS = 9000;
    let anchorMs = performance.now(), anchorTf = 0;
    function loop(now){
      try {
        if (state.playing) { state.tf = (anchorTf + (now-anchorMs)/LOOP_MS*nf) % nf; applyFrame(state.tf); }
        scene.draw();
      } catch (e) { if(!window.__loopErr){window.__loopErr=String(e&&e.stack||e);} }
      state.raf = requestAnimationFrame(loop);
    }
    state.tf = 0; applyFrame(0); state.raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(()=>{ scene.resize(); plot.draw(state.which,state.tf,false); });
    ro.observe(canvas3d); ro.observe(canvas2d);

    function resume(){ anchorMs = performance.now(); anchorTf = state.tf; }
    btn.addEventListener("click", ()=>{ state.playing=!state.playing; if(state.playing) resume(); btn.textContent=state.playing?"❚❚ Pause":"▶ Play"; });
    slider.addEventListener("input", ()=>{ state.playing=false; btn.textContent="▶ Play"; state.tf=+slider.value; applyFrame(state.tf); });
    selPlot.addEventListener("change", ()=>{ state.which=selPlot.value; plot.draw(state.which,state.tf,false); });
    selCol.addEventListener("change", ()=>{ state.colorMode=selCol.value; applyFrame(state.tf); });
    chkPoly.addEventListener("change", ()=>{ scene.setShowPoly(chkPoly.checked); applyFrame(state.tf); });
  }).catch((err)=>{
    wrap.innerHTML = `<div style="padding:18px;color:#c0392b;font-size:14px">Failed to load widget data:<br><code>${err.message}</code></div>`;
  });

  return () => { if (state.raf) cancelAnimationFrame(state.raf); };
}

export default { render };
