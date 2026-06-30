// lattice-morph.js
// AnyWidget: the B2 -> B19' unit-cell mechanism, as a clear 2D schematic
// (projection down the monoclinic b axis). A row of cells morphs from the cubic
// B2 square lattice to the monoclinic B19' parallelogram: the lattice parameters
// change by only a few percent (the conventional B19' b,c axes map to B2 face
// diagonals, so the *atomic* strains are small), the angle beta opens to ~98 deg,
// and the atoms shuffle. Pure 2D canvas, no 3D, no rotation. Shadow-DOM safe.
//
// Embed:
//   :::{anywidget} ./widgets/lattice-morph.js
//   { "a_b2": 3.015, "a_m": 2.898, "beta_m": 97.78 }
//   :::

function modelGet(model, key, fb) {
  if (model && typeof model.get === "function") {
    const v = model.get(key); if (v !== undefined && v !== null && v !== "") return v;
  }
  return fb;
}

function render({ model, el }) {
  const uid = "lm" + Math.random().toString(36).slice(2, 8);
  const aB2 = +modelGet(model, "a_b2", 3.015);
  const aM  = +modelGet(model, "a_m", 2.898);     // B19' a (contracts ~4%)
  const betaM = +modelGet(model, "beta_m", 97.78); // monoclinic angle
  // perpendicular in-plane spacing changes only slightly (illustrative few-% strain)
  const hB2 = aB2, hM = aB2 * 1.03;

  const style = document.createElement("style");
  style.textContent = `
    .${uid}-wrap{font-family:'Inter',-apple-system,sans-serif;color:inherit;}
    .${uid}-row{display:flex;gap:14px;flex-wrap:wrap;align-items:stretch;}
    .${uid}-left{flex:2 1 360px;min-width:300px;border-radius:10px;
      background:#0e131b;position:relative;overflow:hidden;}
    .${uid}-cv{display:block;width:100%;height:320px;}
    .${uid}-right{flex:1 1 230px;min-width:210px;border-radius:10px;padding:14px 16px;
      background:var(--mystmd-surface,#f4f6fa);}
    .${uid}-phase{font-size:18px;font-weight:800;font-family:'Source Serif 4',serif;}
    .${uid}-sub{font-size:12px;opacity:.7;margin:2px 0 12px;}
    .${uid}-par{font-variant-numeric:tabular-nums;font-size:14px;line-height:1.95;}
    .${uid}-par b{display:inline-block;min-width:3.4em;}
    .${uid}-note{margin-top:12px;font-size:12.5px;line-height:1.5;opacity:.85;}
    .${uid}-ctrls{display:flex;gap:12px;align-items:center;margin-top:12px;padding:10px 12px;
      border-radius:10px;background:var(--mystmd-surface,#f4f6fa);}
    .${uid}-btn{border:none;border-radius:8px;padding:8px 16px;font-weight:600;cursor:pointer;background:#8c1515;color:#fff;}
    .${uid}-sld{flex:1;}
    .${uid}-leg{position:absolute;top:10px;left:12px;font-size:12px;color:#cfd8e6;}
    .${uid}-leg i{display:inline-block;width:10px;height:10px;border-radius:50%;margin:0 3px 0 9px;vertical-align:middle;}
  `;
  el.appendChild(style);
  const wrap = document.createElement("div"); wrap.className = `${uid}-wrap`;
  wrap.innerHTML = `
    <div class="${uid}-row">
      <div class="${uid}-left">
        <canvas class="${uid}-cv"></canvas>
        <div class="${uid}-leg"><i style="background:#9aa3ad"></i>Ni<i style="background:#e0a23a"></i>Ti</div>
      </div>
      <div class="${uid}-right">
        <div class="${uid}-phase"></div>
        <div class="${uid}-sub"></div>
        <div class="${uid}-par"></div>
        <div class="${uid}-note"></div>
      </div>
    </div>
    <div class="${uid}-ctrls">
      <button class="${uid}-btn">❚❚ Pause</button>
      <input type="range" class="${uid}-sld" min="0" max="1000" value="0"/>
    </div>`;
  el.appendChild(wrap);
  const canvas = wrap.querySelector(`.${uid}-cv`), ctx = canvas.getContext("2d");
  const btn = wrap.querySelector(`.${uid}-btn`), sld = wrap.querySelector(`.${uid}-sld`);
  const elPhase=wrap.querySelector(`.${uid}-phase`), elSub=wrap.querySelector(`.${uid}-sub`),
        elPar=wrap.querySelector(`.${uid}-par`), elNote=wrap.querySelector(`.${uid}-note`);

  const NX = 3, NY = 2;  // tile a few cells so the shear reads clearly
  const lerp = (p,q,t)=>p+t*(q-p);

  function draw(t) {
    const dpr = Math.min(2, window.devicePixelRatio||1);
    canvas.width = canvas.clientWidth*dpr; canvas.height = canvas.clientHeight*dpr;
    const W = canvas.width, H = canvas.height; ctx.clearRect(0,0,W,H);
    const a = lerp(aB2, aM, t), h = lerp(hB2, hM, t);
    const beta = lerp(90, betaM, t);
    const shear = h * Math.tan((beta-90)*Math.PI/180);   // horizontal offset of top edge
    const shuffle = 0.12 * a * t;                        // alternating Ti shuffle

    // fit the NX x NY block of cells (with shear) into the canvas
    const blockW = NX*a + Math.abs(shear), blockH = NY*h;
    const scale = Math.min((W*0.74)/blockW, (H*0.74)/blockH);
    const ox = (W - (NX*a*scale + shear*scale))/2 + (shear>0?0:0);
    const oy = H - (H - blockH*scale)/2;  // baseline near bottom
    const X = (cx,cy)=> ox + (cx + (cy/h)*shear)*scale;     // shear grows with height
    const Y = (cy)=> oy - cy*scale;

    // lattice lines (cell edges)
    ctx.strokeStyle = "rgba(150,170,200,.30)"; ctx.lineWidth = 1.2*dpr;
    for (let i=0;i<=NX;i++){ ctx.beginPath(); ctx.moveTo(X(i*a,0),Y(0)); ctx.lineTo(X(i*a,NY*h),Y(NY*h)); ctx.stroke(); }
    for (let j=0;j<=NY;j++){ ctx.beginPath(); ctx.moveTo(X(0,j*h),Y(j*h)); ctx.lineTo(X(NX*a,j*h),Y(j*h)); ctx.stroke(); }

    // atoms: Ni at cell corners, Ti at body centers (with shuffle)
    function atom(cx, cy, r, col){ const x=X(cx,cy), y=Y(cy);
      const g=ctx.createRadialGradient(x-r*0.3,y-r*0.3,r*0.2,x,y,r);
      g.addColorStop(0, col[1]); g.addColorStop(1, col[0]);
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,2*Math.PI); ctx.fill(); }
    const NI=["#7d8794","#c4ccd6"], TI=["#c98a1c","#f0c266"];
    const rNi=0.30*a*scale, rTi=0.40*a*scale;
    for (let i=0;i<=NX;i++) for (let j=0;j<=NY;j++) atom(i*a, j*h, rNi, NI);
    for (let i=0;i<NX;i++) for (let j=0;j<NY;j++){
      const sh = shuffle * (j%2===0?1:-1);
      atom(i*a + a/2 + sh, j*h + h/2, rTi, TI);
    }

    // info panel
    const martens = t>0.5; const col = martens ? "rgb(0,140,200)" : "rgb(176,30,30)";
    elPhase.textContent = martens ? "B19' martensite" : "B2 austenite";
    elPhase.style.color = col;
    elSub.textContent = martens ? "monoclinic, low symmetry" : "cubic (CsCl), high symmetry";
    elPar.innerHTML =
      `a = <b>${a.toFixed(2)} Å</b><br>` +
      `b<sub>⊥</sub> = <b>${h.toFixed(2)} Å</b><br>` +
      `β = <b>${beta.toFixed(1)}°</b>`;
    elNote.innerHTML = `The cell shears (β opens past 90°) and the atoms <b>shuffle</b>; ` +
      `lattice spacings change only a few percent. The conventional B19' b and c axes ` +
      `are longer because they map to B2 face diagonals, not edges.`;
  }

  let playing=true, raf=0, anchor=performance.now(), t=0;
  function frame(now){
    if(playing){ const ph=((now-anchor)/8000)%1; t = ph<0.5 ? ph*2 : (1-ph)*2; sld.value=String(Math.round(t*1000)); }
    draw(t); raf=requestAnimationFrame(frame);
  }
  raf=requestAnimationFrame(frame);
  new ResizeObserver(()=>draw(t)).observe(canvas);
  btn.addEventListener("click",()=>{ playing=!playing; if(playing) anchor=performance.now()-(t/2)*8000; btn.textContent=playing?"❚❚ Pause":"▶ Play"; });
  sld.addEventListener("input",()=>{ playing=false; btn.textContent="▶ Play"; t=+sld.value/1000; draw(t); });

  return ()=>{ if(raf) cancelAnimationFrame(raf); };
}

export default { render };
