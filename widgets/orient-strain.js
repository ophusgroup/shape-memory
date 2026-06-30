// orient-strain.js
// AnyWidget: orientation dependence of the recoverable transformation strain,
// computed from the MACE-MP0 relaxed B19' martensite (scripts/r8_orientation.py).
// Left: stereographic triangle shaded by eps_tr (drag; snaps to a low-index
// loading axis). Right: the martensite variant that forms for that loading axis,
// shown as a deformed B2 supercell (real atoms). three.js + canvas 2D, shadow-safe.
//
//   :::{anywidget} ./widgets/orient-strain.js
//   { "data_url": "../widgets/data/orientation.json" }
//   :::

import * as THREE from "https://esm.sh/three@0.160.0";

function modelGet(model, key, fb) {
  if (model && typeof model.get === "function") {
    const v = model.get(key); if (v !== undefined && v !== null && v !== "") return v;
  }
  return fb;
}
function ramp(t) {
  t = Math.max(0, Math.min(1, t));
  const s=[[0,[68,1,84]],[0.25,[59,82,139]],[0.5,[33,145,140]],[0.75,[94,201,98]],[1,[253,231,37]]];
  let a=s[0],b=s[4];
  for(let i=0;i<s.length-1;i++){ if(t>=s[i][0]&&t<=s[i+1][0]){a=s[i];b=s[i+1];break;} }
  const f=(t-a[0])/((b[0]-a[0])||1);
  return [a[1][0]+f*(b[1][0]-a[1][0]),a[1][1]+f*(b[1][1]-a[1][1]),a[1][2]+f*(b[1][2]-a[1][2])];
}
const mv = (M,v)=>[M[0][0]*v[0]+M[0][1]*v[1]+M[0][2]*v[2],
                   M[1][0]*v[0]+M[1][1]*v[1]+M[1][2]*v[2],
                   M[2][0]*v[0]+M[2][1]*v[1]+M[2][2]*v[2]];
const norm = v => Math.hypot(v[0],v[1],v[2]);

async function render({ model, el }) {
  const uid = "os" + Math.random().toString(36).slice(2, 8);
  const url = modelGet(model, "data_url", "../widgets/data/orientation.json");
  let D;
  try { D = await (await fetch(url)).json(); }
  catch (e) { el.innerHTML = `<div style="padding:18px;color:#c0392b">Failed to load orientation data: <code>${e.message}</code></div>`; return; }

  const style = document.createElement("style");
  style.textContent = `
    .${uid}-wrap{font-family:'Inter',-apple-system,sans-serif;color:inherit;}
    .${uid}-row{display:flex;gap:14px;flex-wrap:wrap;align-items:stretch;}
    .${uid}-tri{flex:1 1 320px;min-width:280px;border-radius:10px;
      background:linear-gradient(160deg,#f4f6fa,#e9edf3);padding:12px;}
    .${uid}-ttl{font-size:12px;font-weight:600;opacity:.78;margin:0 0 4px 4px;}
    .${uid}-cv{display:block;width:100%;cursor:crosshair;}
    .${uid}-at{flex:1 1 280px;min-width:260px;border-radius:10px;position:relative;
      background:linear-gradient(160deg,#0c1118,#161d28);overflow:hidden;}
    .${uid}-3d{display:block;width:100%;height:300px;cursor:grab;}
    .${uid}-3d:active{cursor:grabbing;}
    .${uid}-tag{position:absolute;top:10px;left:12px;font-size:12px;color:#cfd8e6;}
    .${uid}-tag b{color:#fff;}
    .${uid}-elleg{position:absolute;bottom:10px;left:12px;display:flex;align-items:center;gap:5px;font-size:11px;color:#cfd8e6;}
    .${uid}-elleg i{display:inline-block;border-radius:50%;background:#9aa3ad;}
    .${uid}-side{margin-top:10px;display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start;}
    table.${uid}-t{border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums;}
    table.${uid}-t th,table.${uid}-t td{padding:4px 9px;border-bottom:1px solid var(--mystmd-border,#d8dee6);text-align:right;}
    table.${uid}-t th:first-child,table.${uid}-t td:first-child{text-align:left;}
    .${uid}-cap{font-size:11.5px;opacity:.72;line-height:1.45;flex:1 1 240px;min-width:220px;}
  `;
  el.appendChild(style);
  const wrap = document.createElement("div"); wrap.className = `${uid}-wrap`;
  wrap.innerHTML = `<div class="${uid}-row">
      <div class="${uid}-tri"><div class="${uid}-ttl">Recoverable transformation strain ε_tr (%)</div><canvas class="${uid}-cv"></canvas></div>
      <div class="${uid}-at">
        <canvas class="${uid}-3d"></canvas>
        <div class="${uid}-tag"></div>
        <div class="${uid}-elleg"><i style="width:13px;height:13px"></i>Ti<i style="width:8px;height:8px"></i>Ni</div>
      </div>
    </div>
    <div class="${uid}-side"><div class="${uid}-tblwrap"></div><div class="${uid}-cap"></div></div>`;
  el.appendChild(wrap);
  const canvas = wrap.querySelector(`.${uid}-cv`), ctx = canvas.getContext("2d");
  const cv3d = wrap.querySelector(`.${uid}-3d`), tag = wrap.querySelector(`.${uid}-tag`);
  const tbl = wrap.querySelector(`.${uid}-tblwrap`), cap = wrap.querySelector(`.${uid}-cap`);

  const A = D.tri.A001, B = D.tri.B011, C = D.tri.C111;
  const NG = D.ngrid, XM = D.xmax, emin = D.emin, emax = D.emax;

  function gridAt(X, Y){ const i=Math.round(X/XM*(NG-1)), j=Math.round(Y/XM*(NG-1));
    if(i<0||i>=NG||j<0||j>=NG) return null; return D.grid[j][i]; }
  function dirFromStereo(X, Y){ const d=1+X*X+Y*Y; return [2*X/d, 2*Y/d, (1-X*X-Y*Y)/d]; }
  // nearest low-index direction (fundamental zone h<=k<=l), returns {hkl, unit, stereo}
  function snap(X, Y){
    let v = dirFromStereo(X, Y); const n=norm(v); v=v.map(c=>c/n);
    const s = [...v].sort((a,b)=>a-b);              // ascending -> [h,k,l]
    let best=[0,0,1], err=1e9;
    for(let h=0;h<=4;h++)for(let k=h;k<=4;k++)for(let l=k;l<=4;l++){
      if(!l) continue; const m=Math.hypot(h,k,l); const dot=(h*s[0]+k*s[1]+l*s[2])/m;
      const e=1-dot; if(e<err){err=e;best=[h,k,l];}
    }
    const m=Math.hypot(...best); const unit=best.map(c=>c/m);   // (h,k,l)=(x,y,z), x<=y<=z
    const st=[unit[0]/(1+unit[2]), unit[1]/(1+unit[2])];
    return {hkl:[best[2],best[1],best[0]], unit, stereo:st};   // display as [l k h] descending
  }
  function epsForUnit(u){ return Math.max(...D.variants.map(Uv => norm(mv(Uv,u))-1)); }
  function bestVariant(u){ let bi=0,bv=-1; D.variants.forEach((Uv,i)=>{const s=norm(mv(Uv,u)); if(s>bv){bv=s;bi=i;}}); return D.variants[bi]; }

  // ---------- stereographic triangle (smooth, clipped) ----------
  const PAD=46;
  function geom(){ const W=canvas.clientWidth, H=Math.round(canvas.clientWidth*0.62);
    const sx=(W-2*PAD)/0.45, sy=(H-2*PAD)/0.45;
    return {W,H,sx,sy,toPx:(X,Y)=>[PAD+X*sx,H-PAD-Y*sy], fromPx:(cx,cy)=>[(cx-PAD)/sx,(H-PAD-cy)/sy]}; }
  let marker = snap(0.02, 0.02);
  function drawTri(){
    const dpr=Math.min(2,devicePixelRatio||1);
    canvas.width=canvas.clientWidth*dpr; canvas.height=Math.round(canvas.clientWidth*0.62)*dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const g=geom(); ctx.clearRect(0,0,g.W,g.H);
    const pa=g.toPx(...A),pb=g.toPx(...B),pc=g.toPx(...C);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(...pa); ctx.lineTo(...pb); ctx.lineTo(...pc); ctx.closePath(); ctx.clip();
    const step=2;
    for(let cx=PAD;cx<g.W-PAD+step;cx+=step) for(let cy=g.H-PAD;cy>PAD-step;cy-=step){
      const [X,Y]=g.fromPx(cx,cy); const e=gridAt(X,Y);
      const ee = e==null ? gridAt(Math.max(0,Math.min(XM,X)),Math.max(0,Math.min(XM,Y))) : e;
      if(ee==null) continue; const c=ramp((ee-emin)/((emax-emin)||1));
      ctx.fillStyle=`rgb(${c[0]|0},${c[1]|0},${c[2]|0})`; ctx.fillRect(cx,cy-step,step+1,step+1);
    }
    ctx.restore();
    ctx.strokeStyle="#33404f"; ctx.lineWidth=1.6; ctx.beginPath();
    ctx.moveTo(...pa); ctx.lineTo(...pb); ctx.lineTo(...pc); ctx.closePath(); ctx.stroke();
    ctx.fillStyle="#1a1a1a"; ctx.font="600 13px sans-serif";
    ctx.textAlign="right"; ctx.fillText("[001]",pa[0]-6,pa[1]+4); ctx.fillText("[011]",pb[0]-6,pb[1]+4);
    ctx.textAlign="left"; ctx.fillText("[111]",pc[0]+6,pc[1]+4);
    const [mx,my]=g.toPx(...marker.stereo);
    ctx.fillStyle="#c0152f"; ctx.beginPath(); ctx.arc(mx,my,6,0,2*Math.PI); ctx.fill();
    ctx.strokeStyle="#fff"; ctx.lineWidth=2; ctx.stroke();
    // colorbar
    const bx=g.W-PAD-6, by0=PAD, by1=g.H-PAD;
    for(let yy=by0;yy<by1;yy++){ const t=1-(yy-by0)/(by1-by0); const c=ramp(t);
      ctx.fillStyle=`rgb(${c[0]|0},${c[1]|0},${c[2]|0})`; ctx.fillRect(bx,yy,11,1); }
    ctx.strokeStyle="#aab"; ctx.lineWidth=0.6; ctx.strokeRect(bx,by0,11,by1-by0);
    ctx.fillStyle="#33404f"; ctx.font="11px sans-serif"; ctx.textAlign="left";
    ctx.fillText(emax.toFixed(0)+"%",bx+14,by0+8); ctx.fillText(emin.toFixed(0)+"%",bx+14,by1);
  }

  // ---------- 3D martensite-variant view ----------
  // The loading axis is ALWAYS drawn vertical (red tension arrows); the crystal
  // is rotated so the selected direction points up. Fixed orthographic view.
  function rotmat(a, b){ // rotation taking unit a -> unit b
    const c=a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
    if(c>0.9999) return [[1,0,0],[0,1,0],[0,0,1]];
    if(c<-0.9999) return [[1,0,0],[0,-1,0],[0,0,-1]];
    const v=[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
    const K=[[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]]; const f=1/(1+c);
    const KK=[[0,0,0],[0,0,0],[0,0,0]];
    for(let i=0;i<3;i++)for(let j=0;j<3;j++){let s=0;for(let k=0;k<3;k++)s+=K[i][k]*K[k][j];KK[i][j]=s;}
    return [0,1,2].map(i=>[0,1,2].map(j=>(i===j?1:0)+K[i][j]+KK[i][j]*f));
  }
  const renderer=new THREE.WebGLRenderer({canvas:cv3d,antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));
  const scene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,-500,500);
  camera.position.set(0,0,100); camera.up.set(0,1,0); camera.lookAt(0,0,0);
  const group=new THREE.Group(); group.rotation.y=0.42; scene.add(group); // fixed azimuth (vertical stays vertical)
  scene.add(new THREE.AmbientLight(0xffffff,0.7));
  const k1=new THREE.DirectionalLight(0xffffff,0.8); k1.position.set(3,5,9); scene.add(k1);
  const k2=new THREE.DirectionalLight(0x88bbff,0.4); k2.position.set(-5,-2,4); scene.add(k2);
  const a0=D.a0, N=3, base=[];
  for(let i=0;i<N;i++)for(let j=0;j<N;j++)for(let k=0;k<N;k++){ base.push({p:[i,j,k],ni:true}); base.push({p:[i+0.5,j+0.5,k+0.5],ni:false}); }
  const nAt=base.length;
  const geoS=new THREE.SphereGeometry(1,18,14);
  const matS=new THREE.MeshStandardMaterial({roughness:0.42,metalness:0.18});
  const mesh=new THREE.InstancedMesh(geoS,matS,nAt); mesh.frustumCulled=false;
  mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(nAt*3),3); group.add(mesh);
  const dummy=new THREE.Object3D();
  const NI=new THREE.Color(0.6,0.64,0.7), TI=new THREE.Color(0.88,0.64,0.2);
  let boxLines=null, arrows=[], radius=N*a0;

  function updateVariant(U, n){
    const R=rotmat([n[0],n[1],n[2]],[0,1,0]);
    const place=(p)=>{ const c=mv(U,[p[0]*a0,p[1]*a0,p[2]*a0]); return mv(R,c); };
    const q=base.map(b=>place(b.p));
    const m=[0,1,2].map(d=>q.reduce((s,x)=>s+x[d],0)/q.length);
    let rmax=0; for(const x of q){ const d=Math.hypot(x[0]-m[0],x[1]-m[1],x[2]-m[2]); if(d>rmax)rmax=d; }
    radius=rmax+1.6;
    for(let i=0;i<nAt;i++){ dummy.position.set(q[i][0]-m[0],q[i][1]-m[1],q[i][2]-m[2]);
      const r=base[i].ni?0.42:0.72; dummy.scale.set(r,r,r); dummy.updateMatrix(); mesh.setMatrixAt(i,dummy.matrix);
      mesh.setColorAt(i, base[i].ni?NI:TI); }
    mesh.instanceMatrix.needsUpdate=true; if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true;
    // cell box
    if(boxLines){group.remove(boxLines);boxLines.geometry.dispose();}
    const corn=[[0,0,0],[N,0,0],[0,N,0],[0,0,N],[N,N,0],[N,0,N],[0,N,N],[N,N,N]]
      .map(c=>{const d=place(c);return new THREE.Vector3(d[0]-m[0],d[1]-m[1],d[2]-m[2]);});
    const Eg=[[0,1],[0,2],[0,3],[1,4],[1,5],[2,4],[2,6],[3,5],[3,6],[4,7],[5,7],[6,7]];
    const pts=[]; for(const [i,j] of Eg) pts.push(corn[i],corn[j]);
    boxLines=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({color:0x6f86a6,transparent:true,opacity:0.45}));
    group.add(boxLines);
    // vertical tension arrows (loading axis)
    arrows.forEach(a=>group.remove(a)); arrows=[];
    const ay=rmax+0.6, dir=new THREE.Vector3(0,1,0), len=rmax*0.5, col=0xc0152f;
    const up=new THREE.ArrowHelper(dir,new THREE.Vector3(0,ay,0),len,col,len*0.45,len*0.32);
    const dn=new THREE.ArrowHelper(dir.clone().negate(),new THREE.Vector3(0,-ay,0),len,col,len*0.45,len*0.32);
    arrows=[up,dn]; group.add(up); group.add(dn);
    fitCamera();
  }
  function fitCamera(){ const w=cv3d.clientWidth,h=cv3d.clientHeight||1; const asp=w/h; const r=radius*1.25;
    camera.top=r; camera.bottom=-r; camera.left=-r*asp; camera.right=r*asp; camera.updateProjectionMatrix(); }
  function resize3d(){ const w=cv3d.clientWidth,h=cv3d.clientHeight; if(!w||!h)return; renderer.setSize(w,h,false); fitCamera(); }
  function loop(){ renderer.render(scene,camera); requestAnimationFrame(loop); }

  function buildTable(){
    const rows=Object.entries(D.specials).map(([k,v])=>`<tr><td>${k}</td><td>${v.toFixed(1)}%</td><td>${(D.specials["[001]"]/v).toFixed(2)}</td></tr>`).join("");
    tbl.innerHTML=`<table class="${uid}-t"><tr><th>axis</th><th>ε_tr</th><th>COP (rel.)</th></tr>${rows}</table>`;
    cap.innerHTML=`The triangle is colored by the recoverable transformation strain ε_tr for tensile loading along each axis, `+
      `computed from the MACE-MP0 relaxed B19'. The right panel shows the martensite variant that forms for the selected axis `+
      `(a B2 cell deformed into that variant). ΔT_ad (≈${D.dT_ad_K} K, MACE) is orientation-independent; the COP scales as 1/ε_tr.`;
  }

  function select(){
    const u=marker.unit; const e=epsForUnit(u)*100;
    tag.innerHTML=`load <b>[${marker.hkl.join("")}]</b> (vertical) · ε_tr <b>${e.toFixed(1)}%</b> · martensite variant`;
    updateVariant(bestVariant(u), u); drawTri();
  }
  canvas.addEventListener("pointerdown",pick); canvas.addEventListener("pointermove",e=>{ if(e.buttons) pick(e); });
  function pick(e){ const r=canvas.getBoundingClientRect(); const g=geom(); const [X,Y]=g.fromPx(e.clientX-r.left,e.clientY-r.top);
    if(gridAt(Math.max(0,Math.min(XM,X)),Math.max(0,Math.min(XM,Y)))!=null){ marker=snap(X,Y); select(); } }

  buildTable(); resize3d(); drawTri(); select(); loop();
  new ResizeObserver(()=>{drawTri();resize3d();}).observe(canvas);
}
export default { render };
