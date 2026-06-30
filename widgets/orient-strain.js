// orient-strain.js
// AnyWidget: orientation dependence of the recoverable transformation strain.
// Draws the standard cubic stereographic triangle ([001]-[011]-[111]) shaded by
// the B2->B19' transformation strain available along each tensile direction.
// Drag the marker to read the direction and strain. Pure ESM, canvas 2D.
//
// The strain field is a smooth interpolation anchored to literature values at
// the triangle corners (illustrative, for teaching the anisotropy).
//
// Embed:
//   :::{anywidget} ./widgets/orient-strain.js
//   { "e001": 7.2, "e011": 1.5, "e111": 3.0 }
//   :::

function modelGet(model, key, fb) {
  if (model && typeof model.get === "function") {
    const v = model.get(key); if (v !== undefined && v !== null && v !== "") return v;
  }
  return fb;
}

// viridis-ish ramp
function ramp(t) {
  t = Math.max(0, Math.min(1, t));
  const s = [[0,[68,1,84]],[0.25,[59,82,139]],[0.5,[33,145,140]],[0.75,[94,201,98]],[1,[253,231,37]]];
  let a=s[0], b=s[4];
  for (let i=0;i<s.length-1;i++){ if(t>=s[i][0]&&t<=s[i+1][0]){a=s[i];b=s[i+1];break;} }
  const f=(t-a[0])/((b[0]-a[0])||1);
  return [a[1][0]+f*(b[1][0]-a[1][0]),a[1][1]+f*(b[1][1]-a[1][1]),a[1][2]+f*(b[1][2]-a[1][2])];
}

function render({ model, el }) {
  const uid = "os" + Math.random().toString(36).slice(2, 8);
  const E = { c001:+modelGet(model,"e001",7.2), c011:+modelGet(model,"e011",1.5), c111:+modelGet(model,"e111",3.0) };

  const style = document.createElement("style");
  style.textContent = `
    .${uid}-wrap{font-family:-apple-system,sans-serif;color:inherit;}
    .${uid}-panel{border-radius:10px;background:linear-gradient(160deg,#f4f6fa,#e9edf3);padding:14px;}
    .${uid}-cv{display:block;width:100%;max-width:520px;margin:0 auto;cursor:crosshair;}
    .${uid}-read{text-align:center;margin-top:8px;font-size:14px;font-variant-numeric:tabular-nums;}
    .${uid}-read b{font-weight:700;}
  `;
  el.appendChild(style);
  const wrap = document.createElement("div"); wrap.className = `${uid}-wrap`;
  wrap.innerHTML = `<div class="${uid}-panel"><canvas class="${uid}-cv"></canvas>
    <div class="${uid}-read"></div></div>`;
  el.appendChild(wrap);
  const canvas = wrap.querySelector(`.${uid}-cv`);
  const ctx = canvas.getContext("2d");
  const read = wrap.querySelector(`.${uid}-read`);

  // triangle vertices in stereographic coords
  const A = [0, 0];            // [001]
  const B = [0, 0.41421];      // [011]
  const C = [0.36603, 0.36603];// [111]
  const SMIN = Math.min(E.c001,E.c011,E.c111), SMAX = Math.max(E.c001,E.c011,E.c111);

  function bary(p) {
    const [x,y]=p, x1=A[0],y1=A[1],x2=B[0],y2=B[1],x3=C[0],y3=C[1];
    const det=(y2-y3)*(x1-x3)+(x3-x2)*(y1-y3);
    const w1=((y2-y3)*(x-x3)+(x3-x2)*(y-y3))/det;
    const w2=((y3-y1)*(x-x3)+(x1-x3)*(y-y3))/det;
    return [w1,w2,1-w1-w2];
  }
  const strainAt = (w) => w[0]*E.c001 + w[1]*E.c011 + w[2]*E.c111;

  function dirFromStereo(X, Y) {
    const d = 1 + X*X + Y*Y;
    let v = [2*X/d, 2*Y/d, (1-X*X-Y*Y)/d];
    // reduce to small integer indices for display
    const m = Math.max(Math.abs(v[0]),Math.abs(v[1]),Math.abs(v[2]));
    let best=[0,0,1], err=1e9;
    for (let h=0;h<=4;h++) for (let k=0;k<=4;k++) for (let l=0;l<=4;l++){
      if(!h&&!k&&!l) continue;
      const n=Math.hypot(h,k,l); const dot=(h*v[0]+k*v[1]+l*v[2])/n;
      const e=1-Math.abs(dot); if(e<err){err=e;best=[l,k,h];} // note ordering for display
    }
    return best;
  }

  let W=0, H=0, px=0, py=0; // current marker in stereo coords
  function layout(){ const cw=canvas.clientWidth||480; W=cw; H=Math.round(cw*0.62);
    const dpr=Math.min(2,window.devicePixelRatio||1); canvas.width=W*dpr; canvas.height=H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); }

  // map stereo coords -> canvas px
  const PAD=48, SX=()=>(W-2*PAD)/0.45, SY=()=>(H-2*PAD)/0.45;
  const toPx=(X,Y)=>[PAD + X*SX(), H-PAD - Y*SY()];
  const fromPx=(cx,cy)=>[(cx-PAD)/SX(), (H-PAD-cy)/SY()];

  function inside(w){ return w[0]>=-0.02&&w[1]>=-0.02&&w[2]>=-0.02; }

  function draw() {
    layout();
    ctx.clearRect(0,0,W,H);
    // shade triangle by strain (sample grid)
    const step=3;
    for(let cx=PAD;cx<W-PAD+step;cx+=step) for(let cy=PAD;cy<H-PAD+step;cy+=step){
      const [X,Y]=fromPx(cx,cy); const w=bary([X,Y]); if(!inside(w)) continue;
      const s=strainAt(w); const t=(s-SMIN)/((SMAX-SMIN)||1); const c=ramp(t);
      ctx.fillStyle=`rgb(${c[0]|0},${c[1]|0},${c[2]|0})`; ctx.fillRect(cx,cy,step,step);
    }
    // triangle outline
    const pa=toPx(...A), pb=toPx(...B), pc=toPx(...C);
    ctx.strokeStyle="#33404f"; ctx.lineWidth=1.5; ctx.beginPath();
    ctx.moveTo(...pa); ctx.lineTo(...pb); ctx.lineTo(...pc); ctx.closePath(); ctx.stroke();
    // corner labels
    ctx.fillStyle="#1a1a1a"; ctx.font="600 13px -apple-system,sans-serif";
    ctx.textAlign="right"; ctx.fillText("[001]", pa[0]-6, pa[1]+4);
    ctx.textAlign="right"; ctx.fillText("[011]", pb[0]-6, pb[1]+4);
    ctx.textAlign="left"; ctx.fillText("[111]", pc[0]+6, pc[1]+4);
    // marker
    const [mx,my]=toPx(px,py);
    ctx.fillStyle="#c0152f"; ctx.beginPath(); ctx.arc(mx,my,6,0,2*Math.PI); ctx.fill();
    ctx.strokeStyle="#fff"; ctx.lineWidth=2; ctx.stroke();
    // colorbar
    const bw=14, bx=W-PAD+18, by0=PAD, by1=H-PAD;
    for(let yy=by0;yy<by1;yy++){ const t=1-(yy-by0)/(by1-by0); const c=ramp(t);
      ctx.fillStyle=`rgb(${c[0]|0},${c[1]|0},${c[2]|0})`; ctx.fillRect(bx,yy,bw,1); }
    ctx.fillStyle="#33404f"; ctx.font="11px -apple-system,sans-serif"; ctx.textAlign="left";
    ctx.fillText(SMAX.toFixed(1)+"%", bx+bw+3, by0+8);
    ctx.fillText(SMIN.toFixed(1)+"%", bx+bw+3, by1);
    ctx.save(); ctx.translate(bx+bw+30,(by0+by1)/2); ctx.rotate(Math.PI/2);
    ctx.textAlign="center"; ctx.fillText("recoverable strain", 0,0); ctx.restore();
    // readout
    const w=bary([px,py]); const s=strainAt(w); const dir=dirFromStereo(px,py);
    read.innerHTML = `tensile axis <b>[${dir.join("")}]</b> &nbsp; recoverable strain <b>${s.toFixed(1)}%</b>`;
  }

  function setFromEvent(e){
    const r=canvas.getBoundingClientRect();
    const cx=(e.clientX-r.left), cy=(e.clientY-r.top);
    let [X,Y]=fromPx(cx,cy); let w=bary([X,Y]);
    // clamp into triangle
    w=[Math.max(0,w[0]),Math.max(0,w[1]),Math.max(0,w[2])];
    const sum=w[0]+w[1]+w[2]; w=[w[0]/sum,w[1]/sum,w[2]/sum];
    px=w[0]*A[0]+w[1]*B[0]+w[2]*C[0]; py=w[0]*A[1]+w[1]*B[1]+w[2]*C[1];
    draw();
  }
  let dragging=false;
  canvas.addEventListener("pointerdown", e=>{dragging=true; setFromEvent(e);});
  window.addEventListener("pointermove", e=>{ if(dragging) setFromEvent(e); });
  window.addEventListener("pointerup", ()=>{dragging=false;});

  // start near [001] (max strain)
  const w0=bary([0.02,0.02]); px=0.03; py=0.03;
  draw();
  new ResizeObserver(draw).observe(canvas);
}

export default { render };
