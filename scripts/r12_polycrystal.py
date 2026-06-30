"""R12: pseudo-2D polycrystal elastocaloric cycle.

A large in-plane cell split into grains of different crystallographic orientation.
Under a tensile load the grains transform one at a time, in order of how favorably
they are oriented: a grain with a large resolved transformation strain transforms
at a low stress (Clausius-Clapeyron), and accommodates more strain. The aggregate
stress-strain curve is therefore a rounded, spread-out superelastic loop rather
than the single sharp plateau of a single crystal, and the latent heat is released
grain by grain on loading and reabsorbed on unloading (the elastocaloric cycle).

This is a constructed mean-field model: grain transformation strains span the range
from the MACE-MP0 stereographic map (scripts/r8), the latent heat is the canonical
MACE value, and per-grain thresholds follow sigma ~ Q/eps_tr with a fixed
hysteresis. Exports niti_polycrystal in the widget format.
"""
from pathlib import Path
import numpy as np
from shapemem.aqs import LoopResult
from shapemem.export import export

OUT = Path(__file__).resolve().parent.parent / "public" / "widgets" / "data"
rng = np.random.default_rng(3)

N = 20                 # cells per side (pseudo-2D, 1 deep)
A0 = 3.0
G = 9                  # grains
L_LAT = 0.0355         # latent heat eV/atom (canonical MACE)
E_MOD = 110.0          # effective elastic modulus, GPa
W = 0.30               # transformation stress window, GPa
HYST = 0.45            # forward-reverse hysteresis, GPa
AMP = 0.17 * A0        # martensite shuffle amplitude

# ---- build pseudo-2D B2 atom sites (Ti corners, Ni body centers) ----
sites, numbers = [], []
for i in range(N):
    for j in range(N):
        sites.append((i, j)); numbers.append(22)            # Ti
        sites.append((i + 0.5, j + 0.5)); numbers.append(28)  # Ni
sites = np.array(sites); numbers = np.array(numbers)
na = len(sites)
base = np.column_stack([sites[:, 0] * A0, sites[:, 1] * A0, np.zeros(na)])

# ---- grains: Voronoi assignment + per-grain orientation/strain/thresholds ----
seeds = rng.uniform(0, N, size=(G, 2))
gid = np.array([np.argmin(((sites - s) ** 2).sum(1)) for s in [seeds]][0]) if False else \
      np.argmin(((sites[:, None, :] - seeds[None, :, :]) ** 2).sum(2), axis=1)
theta = rng.uniform(-1.25, 1.25, size=G)                     # in-plane misorientation, rad
eps_tr = 0.04 + 0.07 * np.cos(theta) ** 2                    # resolved transf. strain 4-11%
sig_f = 0.085 / eps_tr                                       # forward threshold ~0.8-2.1 GPa
sig_r = sig_f - HYST                                         # reverse threshold
w_g = np.array([(gid == g).mean() for g in range(G)])        # area fraction
print("grains: eps_tr%", np.round(eps_tr * 100, 1), " sig_f", np.round(sig_f, 2))

# ---- stress schedule 0 -> max -> 0 ----
sig_max = sig_f.max() + W + 0.4
up = np.linspace(0, sig_max, 26); down = np.linspace(sig_max, 0, 26)[1:]
sched = np.concatenate([up, down])
loading = np.concatenate([np.ones(26, bool), np.zeros(25, bool)])

# precompute per-atom shuffle direction (transverse to grain shear dir)
positions, ops = [], []
strain, stress, energy, frac = [], [], [], []
for k, (sig, load) in enumerate(zip(sched, loading)):
    thr = sig_f if load else sig_r
    phi_g = np.clip((sig - thr) / W, 0, 1)                   # per-grain transformed fraction
    phi = phi_g[gid]                                          # per-atom
    F = float((w_g * phi_g).sum())                            # transformed area fraction
    eps = sig / E_MOD + float((w_g * eps_tr * phi_g).sum())   # macroscopic strain
    # positions: vertical affine stretch + oriented martensite shuffle
    pos = base.copy(); pos[:, 1] *= (1 + eps)
    for g in range(G):
        m = gid == g
        if phi_g[g] <= 0: continue
        d = np.array([np.cos(theta[g]), np.sin(theta[g])])
        perp = np.array([-d[1], d[0]])
        proj = base[m, :2] @ d
        sh = AMP * phi_g[g] * np.sin(2 * np.pi * proj / A0)
        pos[m, 0] += sh * perp[0]; pos[m, 1] += sh * perp[1]
    positions.append(pos.astype(np.float32))
    ops.append(phi.astype(np.float32))
    strain.append(eps); stress.append(sig); frac.append(F)
    energy.append(-7.189 - L_LAT * F)                         # eV/atom, austenite ref

strain = np.array(strain); stress = np.array(stress)
energy = np.array(energy) * na                                # total (export divides per atom too)
cells = np.array([np.diag([N * A0, N * A0 * (1 + e), A0]) for e in strain], dtype=np.float32)

# heat: latent released as fraction grows (>0 loading), reabsorbed on unload
dF = np.diff(np.array(frac), prepend=frac[0])
heat = L_LAT * na * dF
cum = np.cumsum(heat)
kB = 8.617333e-5
temp = 300.0 + cum / (na * 3 * kB)

res = LoopResult(
    strain=strain, stress_gpa=stress, energy_ev=energy, energy_per_atom=energy / na,
    heat_flow_ev=heat, cum_heat_ev=cum,
    positions=np.array(positions, dtype=np.float32), cells=cells,
    op=np.array(ops, dtype=np.float32), numbers=numbers, temperature_k=temp,
    meta={"n_frames": len(strain), "n_atoms": na, "supercell": [N, N, 1], "n_grains": G,
          "model": "constructed polycrystal (MACE eps_tr range + canonical latent heat)",
          "eps_tr_pct": np.round(eps_tr * 100, 1).tolist()},
)
export(res, OUT, "niti_polycrystal")
print(f"{len(strain)} frames, {na} atoms, {G} grains -> niti_polycrystal")
