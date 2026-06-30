// compare.js
// AnyWidget: overlay the load/unload response of doped NiTi compositions on the
// pure 50:50 reference. Reads a compare-index json that lists the reference and
// each doped dataset, fetches their curves, and plots them together.
// Pure ESM, canvas 2D, shadow-DOM safe.
//
// Embed:
//   :::{anywidget} ./widgets/compare.js
//   { "index_url": "../widgets/data/compare_index.json" }
//   :::

function modelGet(model, key, fallback) {
  if (model && typeof model.get === "function") {
    const v = model.get(key);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return fallback;
}

const PALETTE = ["#e23a3a", "#1763d6", "#13a88a", "#d98a1f", "#a23bbd", "#5a6b7a"];

async function render({ model, el }) {
  const uid = "cmp" + Math.random().toString(36).slice(2, 8);
  const indexUrl = modelGet(model, "index_url", "../widgets/data/compare_index.json");
  const base = indexUrl.slice(0, indexUrl.lastIndexOf("/") + 1);

  const style = document.createElement("style");
  style.textContent = `
    .${uid}-wrap{font-family:-apple-system,sans-serif;}
    .${uid}-panel{border-radius:10px;background:linear-gradient(160deg,#f4f6fa,#e9edf3);padding:10px;}
    .${uid}-cv{display:block;width:100%;height:380px;}
    .${uid}-ctrls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px;}
    .${uid}-sel{padding:6px 8px;border-radius:7px;border:1px solid #c5ccd6;background:#fff;font-size:13px;}
    .${uid}-leg{display:flex;gap:14px;flex-wrap:wrap;font-size:13px;margin-top:8px;}
    .${uid}-leg span{display:inline-flex;align-items:center;gap:6px;cursor:pointer;user-select:none;}
    .${uid}-sw{width:14px;height:14px;border-radius:3px;display:inline-block;
      border:1px solid rgba(127,135,150,.5);box-sizing:border-box;}
  `;
  el.appendChild(style);

  const wrap = document.createElement("div");
  wrap.className = `${uid}-wrap`;
  wrap.innerHTML = `
    <div class="${uid}-panel"><canvas class="${uid}-cv"></canvas></div>
    <div class="${uid}-ctrls">
      <label style="font-size:13px">show:
        <select class="${uid}-sel">
          <option value="stress_gpa">stress – strain</option>
          <option value="cum_heat_ev">cumulative heat</option>
          <option value="heat_flow_ev">heat flow / step</option>
          <option value="energy_per_atom">energy</option>
        </select>
      </label>
      <div class="${uid}-leg"></div>
    </div>`;
  el.appendChild(wrap);

  const canvas = wrap.querySelector(`.${uid}-cv`);
  const ctx = canvas.getContext("2d");
  const sel = wrap.querySelector(`.${uid}-sel`);
  const leg = wrap.querySelector(`.${uid}-leg`);

  let sets = [];
  try {
    const index = await (await fetch(indexUrl)).json();
    const entries = [index.reference, ...(index.doped || [])].filter(Boolean);
    sets = await Promise.all(entries.map(async (e, i) => {
      const meta = await (await fetch(base + e.json)).json();
      return {
        label: e.label || e.name,
        color: i === 0 ? "#222" : PALETTE[(i) % PALETTE.length],
        ref: i === 0,
        curves: meta.curves,
        visible: true,
      };
    }));
  } catch (err) {
    wrap.innerHTML = `<div style="padding:18px;color:#c0392b">Failed to load comparison data: <code>${err.message}</code>. Run <code>scripts/m4_doping.py</code> first.</div>`;
    return;
  }

  const UNITS = { stress_gpa: "GPa", cum_heat_ev: "eV", heat_flow_ev: "eV", energy_per_atom: "eV/atom" };
  const LABELS = { stress_gpa: "axial stress", cum_heat_ev: "cumulative heat", heat_flow_ev: "heat flow / step", energy_per_atom: "energy" };

  function draw() {
    const which = sel.value;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const padL = 66*dpr, padR = 16*dpr, padT = 16*dpr, padB = 44*dpr;
    const x0=padL, x1=W-padR, y0=H-padB, y1=padT;

    const vis = sets.filter(s => s.visible);
    let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
    for (const s of vis) {
      const xs = s.curves.strain, ys = s.curves[which];
      for (let i=0;i<xs.length;i++){ const x=xs[i]*100,y=ys[i];
        if(x<xmin)xmin=x; if(x>xmax)xmax=x; if(y<ymin)ymin=y; if(y>ymax)ymax=y; }
    }
    const pad=(ymax-ymin)*0.08||1; ymin-=pad; ymax+=pad;
    const sx=v=>x0+(v-xmin)/(xmax-xmin)*(x1-x0);
    const sy=v=>y0+(v-ymin)/(ymax-ymin)*(y1-y0);

    ctx.strokeStyle="rgba(0,0,0,.08)"; ctx.lineWidth=1*dpr;
    ctx.fillStyle="#33404f"; ctx.font=`${12*dpr}px -apple-system,sans-serif`;
    for(let g=0;g<=5;g++){ const yy=y1+(y0-y1)*g/5; ctx.beginPath();ctx.moveTo(x0,yy);ctx.lineTo(x1,yy);ctx.stroke();
      const val=ymax+(ymin-ymax)*g/5; ctx.textAlign="right";ctx.textBaseline="middle";
      ctx.fillText(val.toFixed(Math.abs(val)<1?2:1),x0-8*dpr,yy); }
    ctx.textAlign="center";ctx.textBaseline="top";
    for(let g=0;g<=5;g++){ const xx=x0+(x1-x0)*g/5; const val=xmin+(xmax-xmin)*g/5;
      ctx.fillText(val.toFixed(1),xx,y0+8*dpr); }
    ctx.font=`${13*dpr}px -apple-system,sans-serif`;
    ctx.fillText("strain (%)",(x0+x1)/2,H-16*dpr);
    ctx.save();ctx.translate(16*dpr,(y0+y1)/2);ctx.rotate(-Math.PI/2);
    ctx.fillText(`${LABELS[which]} (${UNITS[which]})`,0,0);ctx.restore();

    for (const s of vis) {
      const xs=s.curves.strain, ys=s.curves[which];
      ctx.strokeStyle=s.color; ctx.lineWidth=(s.ref?3.2:2.2)*dpr;
      ctx.setLineDash(s.ref?[]:[]); ctx.beginPath();
      for(let i=0;i<xs.length;i++){ const X=sx(xs[i]*100),Y=sy(ys[i]); i?ctx.lineTo(X,Y):ctx.moveTo(X,Y); }
      ctx.stroke();
    }
  }

  function buildLegend() {
    leg.innerHTML = "";
    sets.forEach((s) => {
      const span = document.createElement("span");
      span.innerHTML = `<i class="${uid}-sw" style="background:${s.color};opacity:${s.visible?1:0.25}"></i>${s.label}`;
      span.addEventListener("click", () => { s.visible = !s.visible; buildLegend(); draw(); });
      leg.appendChild(span);
    });
  }

  buildLegend(); draw();
  sel.addEventListener("change", draw);
  new ResizeObserver(draw).observe(canvas);
}

export default { render };
