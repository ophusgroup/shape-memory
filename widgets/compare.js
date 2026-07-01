// compare.js
// AnyWidget: precise comparison of doped NiTi compositions vs the 50:50
// reference. Overlays the load/unload curves (hover to identify a curve), and
// prints a metrics table: peak transformation stress, latent heat Q, hysteresis
// dissipation dW, and the elastocaloric figure of merit COP = Q / dW.
// Pure ESM, canvas 2D, shadow-DOM safe.
//
// Embed:
//   :::{anywidget} ./widgets/compare.js
//   { "index_url": "../widgets/data/compare_index.json" }
//   :::

function modelGet(model, key, fb) {
  if (model && typeof model.get === "function") {
    const v = model.get(key); if (v !== undefined && v !== null && v !== "") return v;
  }
  return fb;
}
const PALETTE = ["#111", "#1763d6", "#13a88a", "#d98a1f", "#a23bbd", "#e23a3a", "#5a6b7a"];
const EV_PER_A3_TO_GPA = 160.21766208;

function trapz(y, x) { let s = 0; for (let i = 1; i < x.length; i++) s += 0.5*(y[i]+y[i-1])*(x[i]-x[i-1]); return s; }

function metrics(curves, meta) {
  const peak = Math.max(...curves.stress_gpa);
  // prefer the precomputed values stored at generation time
  const cop = meta && meta.COP != null ? meta.COP : 0;
  const dT = meta && meta.dT_ad_K != null ? meta.dT_ad_K
    : (curves.temperature_k ? Math.max(...curves.temperature_k) - curves.temperature_k[0] : 0);
  const emax = meta && meta.eps_max_pct != null ? meta.eps_max_pct
    : (curves.strain ? Math.max(...curves.strain) * 100 : 0);
  return { peak, cop, dT, emax };
}

async function render({ model, el }) {
  const uid = "cmp" + Math.random().toString(36).slice(2, 8);
  const indexUrl = modelGet(model, "index_url", "../widgets/data/compare_index.json");
  const base = indexUrl.slice(0, indexUrl.lastIndexOf("/") + 1);

  const style = document.createElement("style");
  style.textContent = `
    .${uid}-wrap{font-family:-apple-system,sans-serif;color:inherit;}
    .${uid}-row{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start;}
    .${uid}-left{flex:2 1 380px;min-width:300px;}
    .${uid}-right{flex:1 1 260px;min-width:240px;}
    .${uid}-panel{border-radius:10px;background:linear-gradient(160deg,#f4f6fa,#e9edf3);padding:10px;position:relative;}
    .${uid}-cv{display:block;width:100%;height:360px;}
    .${uid}-tip{position:absolute;pointer-events:none;background:#11161d;color:#fff;font-size:12px;
      padding:5px 8px;border-radius:6px;opacity:0;transition:opacity .1s;white-space:nowrap;z-index:5;}
    .${uid}-ctrls{margin-top:8px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
    .${uid}-sel{padding:6px 8px;border-radius:7px;border:1px solid #c5ccd6;background:#fff;font-size:13px;}
    table.${uid}-t{border-collapse:collapse;width:100%;font-size:12.5px;font-variant-numeric:tabular-nums;}
    table.${uid}-t th,table.${uid}-t td{padding:5px 6px;border-bottom:1px solid var(--mystmd-border,#d8dee6);text-align:right;}
    table.${uid}-t th:first-child,table.${uid}-t td:first-child{text-align:left;}
    table.${uid}-t th{font-weight:700;}
    .${uid}-sw{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:5px;vertical-align:middle;border:1px solid rgba(127,135,150,.5);}
    .${uid}-cap{font-size:11.5px;opacity:.7;margin-top:6px;line-height:1.4;}
  `;
  el.appendChild(style);
  const wrap = document.createElement("div"); wrap.className = `${uid}-wrap`;
  wrap.innerHTML = `
    <div class="${uid}-row">
      <div class="${uid}-left">
        <div class="${uid}-panel"><canvas class="${uid}-cv"></canvas><div class="${uid}-tip"></div></div>
        <div class="${uid}-ctrls">
          <label style="font-size:13px">curve:
            <select class="${uid}-sel">
              <option value="stress_gpa">stress – strain</option>
              <option value="temperature_k">temperature</option>
              <option value="cum_heat_ev">cumulative heat</option>
              <option value="energy_per_atom">energy</option>
            </select></label>
          <span style="font-size:12px;opacity:.7">hover a curve to identify it</span>
        </div>
      </div>
      <div class="${uid}-right">
        <div class="${uid}-tblwrap"></div>
        <div class="${uid}-cap"></div>
      </div>
    </div>`;
  el.appendChild(wrap);
  const canvas = wrap.querySelector(`.${uid}-cv`), ctx = canvas.getContext("2d");
  const sel = wrap.querySelector(`.${uid}-sel`), tip = wrap.querySelector(`.${uid}-tip`);
  const tblwrap = wrap.querySelector(`.${uid}-tblwrap`), cap = wrap.querySelector(`.${uid}-cap`);

  let sets = [];
  try {
    const index = await (await fetch(indexUrl)).json();
    const entries = [index.reference, ...(index.doped||[])].filter(Boolean);
    sets = await Promise.all(entries.map(async (e,i)=>{
      const meta = await (await fetch(base+e.json)).json();
      return { label: e.label||e.name, composition: e.composition||e.label||e.name,
               color: PALETTE[i%PALETTE.length], ref: i===0, curves: meta.curves,
               meta: meta.meta||{}, m: metrics(meta.curves, meta.meta||{}), hot:false };
    }));
  } catch(err) {
    wrap.innerHTML = `<div style="padding:18px;color:#c0392b">Failed to load comparison data: <code>${err.message}</code>. Run <code>scripts/m4_doping.py</code>.</div>`;
    return;
  }

  const UNIT = {stress_gpa:"GPa", temperature_k:"K", cum_heat_ev:"eV", energy_per_atom:"eV/atom"};
  const LABEL = {stress_gpa:"axial stress", temperature_k:"temperature", cum_heat_ev:"cumulative heat", energy_per_atom:"energy"};

  let geom = null;
  function draw() {
    const which = sel.value;
    const dpr = Math.min(2,window.devicePixelRatio||1);
    canvas.width=canvas.clientWidth*dpr; canvas.height=canvas.clientHeight*dpr;
    const W=canvas.width,H=canvas.height; ctx.clearRect(0,0,W,H);
    const padL=64*dpr,padR=14*dpr,padT=14*dpr,padB=42*dpr, x0=padL,x1=W-padR,y0=H-padB,y1=padT;
    const vis = sets.filter(s=>s.curves[which]);
    if (!vis.length){ ctx.fillStyle="#888"; ctx.font=`${14*dpr}px sans-serif`; ctx.textAlign="center";
      ctx.fillText("no "+LABEL[which]+" data for these runs", W/2, H/2); return; }
    let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
    for(const s of vis){ const xs=s.curves.strain, ys=s.curves[which];
      for(let i=0;i<xs.length;i++){ const x=xs[i]*100,y=ys[i];
        if(x<xmin)xmin=x; if(x>xmax)xmax=x; if(y<ymin)ymin=y; if(y>ymax)ymax=y; } }
    const pad=(ymax-ymin)*0.08||1; ymin-=pad; ymax+=pad;
    const sx=v=>x0+(v-xmin)/(xmax-xmin)*(x1-x0), sy=v=>y0+(v-ymin)/(ymax-ymin)*(y1-y0);
    ctx.strokeStyle="rgba(0,0,0,.08)"; ctx.lineWidth=1*dpr; ctx.fillStyle="#33404f"; ctx.font=`${12*dpr}px sans-serif`;
    for(let g=0;g<=5;g++){ const yy=y1+(y0-y1)*g/5; ctx.beginPath();ctx.moveTo(x0,yy);ctx.lineTo(x1,yy);ctx.stroke();
      const val=ymax+(ymin-ymax)*g/5; ctx.textAlign="right";ctx.textBaseline="middle"; ctx.fillText(val.toFixed(Math.abs(val)<1?2:Math.abs(val)<100?1:0),x0-8*dpr,yy); }
    ctx.textAlign="center";ctx.textBaseline="top";
    for(let g=0;g<=5;g++){ const xx=x0+(x1-x0)*g/5; ctx.fillText((xmin+(xmax-xmin)*g/5).toFixed(1),xx,y0+8*dpr); }
    ctx.font=`${13*dpr}px sans-serif`; ctx.fillText("strain (%)",(x0+x1)/2,H-16*dpr);
    ctx.save();ctx.translate(16*dpr,(y0+y1)/2);ctx.rotate(-Math.PI/2);ctx.fillText(`${LABEL[which]} (${UNIT[which]})`,0,0);ctx.restore();
    geom = {which,sx,sy,x0,x1,y0,y1,dpr,vis};
    for(const s of vis){ const xs=s.curves.strain, ys=s.curves[which];
      ctx.strokeStyle=s.color; ctx.lineWidth=(s.hot?4:(s.ref?3.0:2.0))*dpr; ctx.globalAlpha=s.hot||!sets.some(z=>z.hot)?1:0.35;
      ctx.beginPath(); for(let i=0;i<xs.length;i++){ const X=sx(xs[i]*100),Y=sy(ys[i]); i?ctx.lineTo(X,Y):ctx.moveTo(X,Y); } ctx.stroke(); }
    ctx.globalAlpha=1;
  }

  canvas.addEventListener("mousemove", (e)=>{
    if(!geom) return; const r=canvas.getBoundingClientRect();
    const mx=(e.clientX-r.left)*geom.dpr, my=(e.clientY-r.top)*geom.dpr;
    let best=null, bd=14*geom.dpr;
    for(const s of geom.vis){ const xs=s.curves.strain, ys=s.curves[geom.which];
      for(let i=0;i<xs.length;i++){ const X=geom.sx(xs[i]*100),Y=geom.sy(ys[i]); const d=Math.hypot(X-mx,Y-my);
        if(d<bd){bd=d;best=s;} } }
    sets.forEach(s=>s.hot=(s===best)); draw();
    if(best){ tip.style.opacity="1"; tip.style.left=(e.clientX-r.left+12)+"px"; tip.style.top=(e.clientY-r.top+8)+"px";
      tip.innerHTML=`${best.composition}`; }
    else tip.style.opacity="0";
  });
  canvas.addEventListener("mouseleave", ()=>{ sets.forEach(s=>s.hot=false); tip.style.opacity="0"; draw(); });

  function buildTable() {
    const rows = sets.map(s=>`<tr>
      <td><span class="${uid}-sw" style="background:${s.color}"></span>${s.composition}</td>
      <td>${s.m.peak.toFixed(2)}</td>
      <td>${s.m.emax?s.m.emax.toFixed(1):"–"}</td>
      <td>${s.m.cop.toFixed(1)}</td></tr>`).join("");
    tblwrap.innerHTML = `<table class="${uid}-t">
      <tr><th>texture</th><th>σ_pk<br>(GPa)</th><th>stroke<br>ε (%)</th><th>COP</th></tr>${rows}</table>`;
    cap.innerHTML = `σ_pk = peak transformation stress. stroke = max recoverable strain. `+
      `COP = Q/ΔW (latent heat / hysteresis area), the elastocaloric figure of merit. `+
      `ΔT_ad ≈ 46 K is the same for every texture (set by the latent heat). `+
      `Constructed polycrystal model; absolute values are demo-scale.`;
  }

  buildTable(); draw();
  sel.addEventListener("change", ()=>{ sets.forEach(s=>s.hot=false); draw(); });
  new ResizeObserver(draw).observe(canvas);
}

export default { render };
