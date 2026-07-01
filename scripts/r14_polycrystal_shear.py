"""R14: polycrystal elastocaloric SHEAR cycle (twinning).

Same 36-grain polycrystal as the strain cycle, but driven through a pure-shear
load instead of a tensile one. Under shear each grain transforms to TWINNED
martensite: alternating lamellae of the two shear variants (a coherent twin
structure) accommodate the imposed shear, so the microstructure fills with
fine twin bands that grow as the grains transform and vanish on unloading.

It reuses the MACE-MP0-relaxed austenite microstructure written by
scripts/r12_polycrystal.py (frame 0 of niti_polycrystal_big), so no new
relaxation is needed. The cycle itself is the same constructed mean-field model:
grains transform in order of their resolved (shear) transformation strain,
thresholds follow tau ~ Q/gamma_tr with a fixed hysteresis, and the latent heat
is released grain by grain. Atoms are colored by the signed twin variant.

Exports niti_polycrystal_shear (kind="shear").
"""
import json
from pathlib import Path
import numpy as np
from ase import Atoms
from ase.optimize import FIRE
from mace.calculators import mace_mp
from shapemem.aqs import LoopResult
from shapemem.export import export

OUT = Path(__file__).resolve().parent.parent / "public" / "widgets" / "data"
A0 = 3.0
L_LAT = 0.0355          # latent heat eV/atom
G_SHEAR = 60.0          # effective shear modulus GPa
W = 0.30; HYST = 0.35   # transformation window / hysteresis GPa
TWINAMP = 0.20 * A0     # twin-lamella shuffle amplitude
BANDW = 2.0 * A0        # twin-lamella width
kB = 8.617333e-5

# --- load the MACE-relaxed austenite base (frame 0 of the big strain dataset) ---
meta = json.loads((OUT / "niti_polycrystal_big.json").read_text())
na = meta["n_atoms"]; NG = meta["meta"]["n_grains"]
L = meta["cells"][0][0]
num = np.array(meta["numbers"])
buf = np.fromfile(OUT / "niti_polycrystal_big.bin", dtype="<f4")
base = buf[: na * 3].reshape(na, 3).astype(float)     # relaxed austenite positions

# reproduce grain seeds/orientations (same rng draws + order as r12 build_base)
rng = np.random.default_rng(11)
seeds = rng.uniform(0, L, (NG, 2))
theta = rng.uniform(-np.pi / 4, np.pi / 4, NG)
_phase = rng.uniform(0, A0, (NG, 2))
# assign each relaxed atom to its grain by periodic (minimum-image) Voronoi
d = base[:, None, :2] - seeds[None, :, :]
d -= L * np.round(d / L)
gid = (d ** 2).sum(2).argmin(1)
w_g = np.array([(gid == g).mean() for g in range(NG)])
dvec = np.column_stack([np.cos(theta), np.sin(theta)])     # grain lattice / shear direction
pvec = np.column_stack([-np.sin(theta), np.cos(theta)])    # lamella normal
gamma_tr = 0.08 + 0.06 * np.cos(2 * theta) ** 2            # resolved shear transf. strain 8-14%
tau_f = 0.07 / gamma_tr
tau_r = tau_f - HYST
# per-atom twin variant sign: alternating lamellae along the grain's lamella normal
band = np.floor((base[:, :2] * pvec[gid]).sum(1) / BANDW).astype(int)
svar = np.where(band % 2 == 0, 1.0, -1.0)
print(f"{na} atoms, {NG} grains; gamma_tr% {np.round(gamma_tr*100,1).min():.0f}-{np.round(gamma_tr*100,1).max():.0f}")

# --- shear stress cycle 0 -> max -> 0 ---
tau_max = tau_f.max() + W + 0.3
sched = np.concatenate([np.linspace(0, tau_max, 26), np.linspace(tau_max, 0, 26)[1:]])
loading = np.concatenate([np.ones(26, bool), np.zeros(25, bool)])
gmac_peak = tau_max / G_SHEAR + float((w_g * gamma_tr).sum())      # fully-transformed macro shear

# --- build the fully-twinned martensite at peak shear and RELAX it with MACE ---
# The raw alternating twin shuffle drives some atoms unphysically close at the
# lamella boundaries; MACE relaxation (atoms only, fixed sheared cell) removes the
# close contacts. We then reuse the relaxed twin distortion in FRACTIONAL
# coordinates, so it maps cleanly onto the cell at every shear level.
cell_peak = np.array([[L, 0, 0], [gmac_peak * L, L, 0], [0, 0, A0]])
raw = base.copy()
raw[:, 0] += gmac_peak * base[:, 1]
u = TWINAMP * svar
raw[:, 0] += u * dvec[gid, 0]; raw[:, 1] += u * dvec[gid, 1]
calc = mace_mp(model="medium-mpa-0", device="cpu", default_dtype="float32")
at = Atoms(numbers=num, positions=np.column_stack([raw[:, 0], raw[:, 1], np.zeros(na)]),
           cell=cell_peak, pbc=True)
at.calc = calc
def min_dist(P):
    from scipy.spatial import cKDTree
    d, _ = cKDTree(P[:, :2]).query(P[:, :2], k=2)   # non-periodic; catches the internal twin-boundary contacts
    return d[:, 1].min()
print(f"min interatomic dist before relax: {min_dist(raw):.2f} A")
FIRE(at, logfile=None).run(fmax=0.10, steps=60)
relaxed = at.get_positions(); relaxed[:, 2] = 0.0
print(f"min interatomic dist after relax:  {min_dist(relaxed):.2f} A")

# fractional twin distortion (relaxed twin minus austenite), cell-independent
inv_orth = np.linalg.inv(np.array([[L, 0, 0], [0, L, 0], [0, 0, A0]]))
inv_peak = np.linalg.inv(cell_peak)
f_aust = np.column_stack([base[:, 0], base[:, 1], np.zeros(na)]) @ inv_orth
f_relx = relaxed @ inv_peak
df = f_relx - f_aust
df -= np.round(df)                                                # minimum image

positions, ops, strain, stress, frac, energy = [], [], [], [], [], []
for tau, ld in zip(sched, loading):
    thr = tau_f if ld else tau_r
    phi_g = np.clip((tau - thr) / W, 0, 1); phi = phi_g[gid]
    F = float((w_g * phi_g).sum())
    gmac = tau / G_SHEAR + float((w_g * gamma_tr * phi_g).sum())   # macroscopic shear strain
    cell = np.array([[L, 0, 0], [gmac * L, L, 0], [0, 0, A0]])
    f = f_aust + phi[:, None] * df                                # austenite + relaxed twin distortion
    p = f @ cell
    positions.append(p.astype(np.float32)); ops.append((phi * svar).astype(np.float32))
    strain.append(gmac); stress.append(float(tau)); frac.append(F); energy.append(-7.189 - L_LAT * F)

strain = np.array(strain); stress = np.array(stress); energy = np.array(energy) * na
cells = np.array([[[L, 0, 0], [g * L, L, 0], [0, 0, A0]] for g in strain], dtype=np.float32)
dF = np.diff(np.array(frac), prepend=frac[0]); heat = L_LAT * na * dF; cum = np.cumsum(heat)
temp = 300.0 + (12.0 / 35.5) * cum / (na * 3 * kB)   # ΔT_ad calibrated to measured latent heat

res = LoopResult(
    strain=strain, stress_gpa=stress, energy_ev=energy, energy_per_atom=energy / na,
    heat_flow_ev=heat, cum_heat_ev=cum,
    positions=np.array(positions, dtype=np.float32), cells=cells,
    op=np.array(ops, dtype=np.float32), numbers=num.astype(int), temperature_k=temp,
    meta={"kind": "shear", "n_frames": len(strain), "n_atoms": na, "n_grains": NG,
          "supercell": [int(round(L / A0))] * 2 + [1],
          "model": "constructed polycrystal shear cycle, MACE-relaxed twinned martensite",
          "theta_deg": np.round(np.degrees(theta), 1).tolist(),
          "gamma_tr_pct": np.round(gamma_tr * 100, 1).tolist()},
)
export(res, OUT, "niti_polycrystal_shear")
print(f"{len(strain)} frames -> niti_polycrystal_shear (shear cycle, twinning)")
