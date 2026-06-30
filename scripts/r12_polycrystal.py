"""R12: pseudo-2D polycrystal elastocaloric cycle (periodic, MACE-relaxed).

Each grain is a B2 lattice at its own in-plane rotation. Grain membership uses a
TRUE PERIODIC Voronoi tessellation (nearest seed under the minimum-image
convention), so the tiling wraps seamlessly across the cell with no empty
regions. Every grain's rotated lattice is generated over a range large enough to
cover the whole domain after rotation. Overlapping atoms at grain boundaries are
thinned, then the austenite microstructure is RELAXED with MACE-MP0 so the grain
boundaries settle to physical spacings before the cycle.

The elastocaloric cycle itself is the constructed mean-field model: grains
transform in order of their resolved transformation strain (spanning the
MACE-MP0 range from scripts/r8), thresholds follow sigma ~ Q/eps_tr with a fixed
hysteresis, and each grain's martensite shuffle is aligned with its own lattice.

Generates two sizes:
  niti_polycrystal      22x22 cells,  9 grains
  niti_polycrystal_big  44x44 cells, 36 grains (4x area; for the full-width hero)
"""
import time
from pathlib import Path
import numpy as np
from scipy.spatial import cKDTree
from ase import Atoms
from ase.optimize import FIRE
from mace.calculators import mace_mp
from shapemem.aqs import LoopResult
from shapemem.export import export

OUT = Path(__file__).resolve().parent.parent / "public" / "widgets" / "data"
A0 = 3.0
L_LAT = 0.0355                 # latent heat eV/atom
E_MOD = 110.0                  # effective modulus GPa
W = 0.30; HYST = 0.45          # transformation window / hysteresis GPa
AMP = 0.17 * A0                # martensite shuffle amplitude
DMIN = 0.55 * A0              # grain-boundary overlap cleanup distance (keep more boundary atoms)
kB = 8.617333e-5

calc = mace_mp(model="medium-mpa-0", device="cpu", default_dtype="float32")


def build_base(ncell, ngrain, seed, relax_steps):
    rng = np.random.default_rng(seed)
    L = ncell * A0
    seeds = rng.uniform(0, L, (ngrain, 2))
    theta = rng.uniform(-np.pi / 4, np.pi / 4, ngrain)        # in-plane misorientation
    phase = rng.uniform(0, A0, (ngrain, 2))
    eps_tr = 0.04 + 0.07 * np.cos(2 * theta) ** 2             # resolved transf. strain 4-11%
    sig_f = 0.085 / eps_tr
    sig_r = sig_f - HYST

    idx = np.arange(-ncell, 2 * ncell + 1)                    # generous range to cover rotation
    II, JJ = np.meshgrid(idx, idx); II = II.ravel(); JJ = JJ.ravel()
    P, NUM, GID = [], [], []
    for g in range(ngrain):
        c, s = np.cos(theta[g]), np.sin(theta[g]); R = np.array([[c, -s], [s, c]])
        for dx, dy, Z in [(0.0, 0.0, 22), (0.5, 0.5, 28)]:    # Ti corner, Ni body-center
            p = np.column_stack([(II + dx) * A0, (JJ + dy) * A0]) @ R.T + phase[g]
            inside = (p[:, 0] >= 0) & (p[:, 0] < L) & (p[:, 1] >= 0) & (p[:, 1] < L)
            p = p[inside]
            d = p[:, None, :] - seeds[None, :, :]
            d -= L * np.round(d / L)                          # minimum-image -> periodic Voronoi
            owner = (d ** 2).sum(2).argmin(1)
            p = p[owner == g]
            P.append(p); NUM.append(np.full(len(p), Z)); GID.append(np.full(len(p), g))
    pos = np.vstack(P); num = np.concatenate(NUM); gid = np.concatenate(GID)

    # thin overlaps at grain boundaries (periodic)
    drop = set()
    for i, j in cKDTree(pos, boxsize=[L, L]).query_pairs(DMIN):
        if gid[i] != gid[j] and i not in drop and j not in drop:
            drop.add(j)
    keep = np.array([k for k in range(len(pos)) if k not in drop])
    pos, num, gid = pos[keep], num[keep], gid[keep]
    na = len(pos)

    # relax the austenite boundaries with MACE (thin periodic cell keeps it ~planar)
    at = Atoms(numbers=num, positions=np.column_stack([pos, np.zeros(na)]),
               cell=[[L, 0, 0], [0, L, 0], [0, 0, A0]], pbc=True)
    at.calc = calc
    t0 = time.time()
    FIRE(at, logfile=None).run(fmax=0.10, steps=relax_steps)
    base = at.get_positions(); base[:, 2] = 0.0
    print(f"    relaxed {na} atoms, {relax_steps} steps in {time.time()-t0:.0f}s")

    return dict(base=base, num=num, gid=gid, ngrain=ngrain, L=L, na=na,
                eps_tr=eps_tr, sig_f=sig_f, sig_r=sig_r,
                w_g=np.array([(gid == g).mean() for g in range(ngrain)]),
                dvec=np.column_stack([np.cos(theta), np.sin(theta)]),
                pvec=np.column_stack([-np.sin(theta), np.cos(theta)]),
                theta=theta)


def make_frames(d, name):
    sig_max = d["sig_f"].max() + W + 0.4
    sched = np.concatenate([np.linspace(0, sig_max, 26), np.linspace(sig_max, 0, 26)[1:]])
    loading = np.concatenate([np.ones(26, bool), np.zeros(25, bool)])
    positions, ops, strain, stress, frac, energy = [], [], [], [], [], []
    for sig, ld in zip(sched, loading):
        thr = d["sig_f"] if ld else d["sig_r"]
        phi_g = np.clip((sig - thr) / W, 0, 1); phi = phi_g[d["gid"]]
        F = float((d["w_g"] * phi_g).sum())
        eps = sig / E_MOD + float((d["w_g"] * d["eps_tr"] * phi_g).sum())
        p = d["base"].copy(); p[:, 1] *= (1 + eps)
        for g in range(d["ngrain"]):
            if phi_g[g] <= 0:
                continue
            m = d["gid"] == g
            proj = d["base"][m, :2] @ d["dvec"][g]
            sh = AMP * phi_g[g] * np.sin(2 * np.pi * proj / A0)
            p[m, 0] += sh * d["pvec"][g, 0]; p[m, 1] += sh * d["pvec"][g, 1]
        positions.append(p.astype(np.float32)); ops.append(phi.astype(np.float32))
        strain.append(eps); stress.append(float(sig)); frac.append(F); energy.append(-7.189 - L_LAT * F)
    na = d["na"]
    strain = np.array(strain); stress = np.array(stress); energy = np.array(energy) * na
    cells = np.array([np.diag([d["L"], d["L"] * (1 + e), A0]) for e in strain], dtype=np.float32)
    dF = np.diff(np.array(frac), prepend=frac[0]); heat = L_LAT * na * dF; cum = np.cumsum(heat)
    temp = 300.0 + cum / (na * 3 * kB)
    res = LoopResult(
        strain=strain, stress_gpa=stress, energy_ev=energy, energy_per_atom=energy / na,
        heat_flow_ev=heat, cum_heat_ev=cum,
        positions=np.array(positions, dtype=np.float32), cells=cells,
        op=np.array(ops, dtype=np.float32), numbers=d["num"].astype(int), temperature_k=temp,
        meta={"n_frames": len(strain), "n_atoms": na, "n_grains": d["ngrain"],
              "supercell": [int(round(d["L"] / A0))] * 2 + [1],
              "model": "constructed polycrystal, periodic Voronoi, MACE-relaxed grain boundaries",
              "theta_deg": np.round(np.degrees(d["theta"]), 1).tolist(),
              "eps_tr_pct": np.round(d["eps_tr"] * 100, 1).tolist()},
    )
    export(res, OUT, name)


for name, ncell, ngrain, seed, relax in [
    ("niti_polycrystal", 22, 9, 5, 90),
    ("niti_polycrystal_big", 44, 36, 11, 70),
]:
    print(name)
    d = build_base(ncell, ngrain, seed, relax)
    make_frames(d, name)
    print(f"  -> {name}: {d['na']} atoms, {ngrain} grains")
