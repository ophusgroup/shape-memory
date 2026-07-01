"""R13: texture controls the elastocaloric figure of merit.

Three polycrystals with the same grains but different texture (orientation
distribution):
  * <001> texture  -- grains aligned to a low-strain, high-stress direction
  * random texture -- orientations spread over the full range
  * <111> texture  -- grains aligned to a high-strain, low-stress direction

Each is driven through a superelastic stress cycle (the polycrystal mean-field
model of scripts/r12). We report the aggregate loop, the stroke (max recoverable
strain), the latent heat Q, the hysteresis work dW, and COP = Q/dW. The point:
the latent heat (and so dT_ad) is texture-independent, but the stroke and the
efficiency are not -- a <001> texture is the most efficient (smallest loop),
a <111> texture gives the biggest stroke at lower COP. This is the texture
design lever for elastocaloric NiTi.

Writes compare_texture_index.json + one json per texture for widgets/compare.js.
"""
import json
from pathlib import Path
import numpy as np

OUT = Path(__file__).resolve().parent.parent / "public" / "widgets" / "data"
EVA3_GPA = 160.21766208
L_LAT = 0.0355          # eV/atom
E_MOD = 110.0           # GPa
W = 0.30; HYST = 0.45   # GPa
NA = 800                # representative atom count (for absolute energies)
V0 = NA * 13.5          # ~ang^3, demo scale
kB = 8.617333e-5
rng = np.random.default_rng(7)

def eps_from_theta(theta):
    return 0.04 + 0.07 * np.cos(theta) ** 2     # 4-11%

TEXTURES = {
    "random":  dict(label="Random texture",            theta=rng.uniform(-1.3, 1.3, 60)),
    "t001":    dict(label="⟨001⟩ texture (efficient)",  theta=rng.normal(1.20, 0.12, 60)),  # small eps_tr
    "t111":    dict(label="⟨111⟩ texture (high stroke)", theta=rng.normal(0.00, 0.12, 60)),  # large eps_tr
}

def run(theta):
    eps_tr = eps_from_theta(theta)
    sig_f = 0.085 / eps_tr
    sig_r = sig_f - HYST
    w_g = np.ones_like(eps_tr) / len(eps_tr)
    sig_max = sig_f.max() + W + 0.4
    sched = np.concatenate([np.linspace(0, sig_max, 60), np.linspace(sig_max, 0, 60)[1:]])
    load = np.concatenate([np.ones(60, bool), np.zeros(59, bool)])
    strain, stress, frac, energy = [], [], [], []
    for sig, ld in zip(sched, load):
        thr = sig_f if ld else sig_r
        phi = np.clip((sig - thr) / W, 0, 1)
        F = float((w_g * phi).sum())
        strain.append(sig / E_MOD + float((w_g * eps_tr * phi).sum()))
        stress.append(float(sig)); frac.append(F); energy.append(-7.189 - L_LAT * F)
    strain = np.array(strain); stress = np.array(stress); frac = np.array(frac)
    dF = np.diff(frac, prepend=frac[0]); heat = L_LAT * NA * dF; cum = np.cumsum(heat)
    temp = 300.0 + (12.0 / 35.5) * cum / (NA * 3 * kB)   # ΔT_ad calibrated to measured latent heat
    # hysteresis work = area enclosed by the loop (eV); Q = latent of transformed fraction
    dW = abs(np.trapezoid(stress / EVA3_GPA, strain)) * V0
    Q = L_LAT * NA * frac.max()
    return dict(strain=strain.tolist(), stress_gpa=stress.tolist(),
                temperature_k=temp.tolist(), cum_heat_ev=cum.tolist(),
                energy_per_atom=energy), dict(
                COP=round(Q / dW, 1), dT_ad_K=round(float(temp.max() - 300), 0),
                eps_max_pct=round(float(strain.max() * 100), 1),
                dW_eV=round(dW, 2), Q_eV=round(Q, 2))

entries = {}
for key, cfg in TEXTURES.items():
    curves, meta = run(cfg["theta"])
    (OUT / f"texture_{key}.json").write_text(json.dumps({
        "name": key, "curves": curves, "meta": {**meta, "label": cfg["label"]}}))
    entries[key] = dict(label=cfg["label"], composition=cfg["label"], json=f"texture_{key}.json")
    print(f"{cfg['label']:30s} COP={meta['COP']:4.1f}  stroke={meta['eps_max_pct']:.1f}%  "
          f"dT={meta['dT_ad_K']:.0f}K  sig_pk={max(curves['stress_gpa']):.2f}")

index = {"reference": entries["random"], "doped": [entries["t001"], entries["t111"]]}
(OUT / "compare_texture_index.json").write_text(json.dumps(index))
print("wrote compare_texture_index.json")
