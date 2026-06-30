"""R6: nucleation and growth -- a propagating austenite/martensite interface.

A single crystal under stress transforms homogeneously (see niti_2d), but in a
real sample a martensite band nucleates and grows behind a moving habit-plane
interface. Here that interface is built explicitly: a front sweeps across the
cell, converting austenite (red) to martensite (cyan) behind it. The endpoints
are the MACE-MP0 relaxed austenite and martensite; the front position is driven
by a model stress-strain with a nucleation peak and a growth plateau (Luders-like
front), which is the standard description of stress-induced transformation.
"""
import time
from pathlib import Path
import numpy as np
from scipy.linalg import polar
from mace.calculators import mace_mp
from shapemem import b2_supercell, export
from shapemem.superelastic import relax_endpoints
from shapemem.aqs import LoopResult, EV_PER_A3_TO_GPA, T_BASE_K

OUT = Path(__file__).resolve().parent.parent / "public" / "widgets" / "data"
calc = mace_mp(model="medium-mpa-0", device="cpu", default_dtype="float32")

atoms = b2_supercell(n_a=14, n_b=14, min_depth_ang=3.0)   # 392 atoms, room for a front
print(f"{len(atoms)} atoms", flush=True)
t0 = time.time()
A, M, eA, eM = relax_endpoints(atoms, calc)
cellA, cellM = np.array(A.cell), np.array(M.cell)
F = (np.linalg.inv(cellA) @ cellM).T
_, U = polar(F); cellM = cellA @ U.T          # remove rigid rotation
fracA = A.get_scaled_positions(wrap=True)
fracM = M.get_scaled_positions(wrap=True)
d = fracM - fracA; d -= np.round(d); fracM = fracA + d
eps_tr = abs(cellM[0, 0] - cellA[0, 0]) / cellA[0, 0]
na = len(A); Lx = cellA[0, 0]
x = A.get_positions()[:, 0]
w = 0.16 * Lx                                  # interface width
print(f"endpoints ready ({time.time()-t0:.0f}s), eps_tr={eps_tr*100:.1f}%", flush=True)

# model shear/stress: nucleation peak then growth plateau
SF, SN, EEL = 0.55, 0.45, 45.0   # plateau, nucleation overshoot start, modulus

N = 34
ps = np.concatenate([np.linspace(0, 1, N), np.linspace(1, 0, N)[1:]])
loading = [True]*N + [False]*(N-1)
dH = 0.0355  # canonical B19' latent heat (eV/atom), see r7
positions, cells, ops, strain, stress, energy = [], [], [], [], [], []
for p, ld in zip(ps, loading):
    xf = p * (Lx + 2*w) - w
    phi = np.clip((xf - x) / w + 0.5, 0.0, 1.0)        # per-atom transformed fraction
    mean_phi = phi.mean()
    cell = cellA + mean_phi * (cellM - cellA)
    frac = (1 - phi)[:, None] * fracA + phi[:, None] * fracM
    pos = frac @ cell
    positions.append(pos.astype(np.float32))
    cells.append(cell.astype(np.float32))
    ops.append(phi.astype(np.float32))
    strain.append(mean_phi * eps_tr)
    # nucleation overshoot near onset, then plateau
    s = SF + (0.18 if (ld and 0.04 < mean_phi < 0.18) else 0.0)
    if not ld: s = SF - 0.22
    stress.append(s if mean_phi > 0.02 else EEL * strain[-1])
    energy.append(eA - dH * mean_phi * na)

strain = np.array(strain); stress = np.array(stress); energy = np.array(energy)
dU = np.zeros_like(energy); dU[1:] = np.diff(energy)
heat = -dU; cum = np.cumsum(heat)
temp = T_BASE_K + cum / (na * 3 * 8.617333e-5)
res = LoopResult(
    strain=strain, stress_gpa=stress, energy_ev=energy, energy_per_atom=energy/na,
    heat_flow_ev=heat, cum_heat_ev=cum,
    positions=np.array(positions, np.float32), cells=np.array(cells, np.float32),
    op=np.array(ops, np.float32), numbers=A.get_atomic_numbers(), temperature_k=temp,
    meta={"kind": "front", "n_frames": len(ps), "n_atoms": na, "eps_tr": float(eps_tr)},
)
export(res, OUT, "niti_nucleation")
print(f"wrote niti_nucleation ({na} atoms, {len(ps)} frames)", flush=True)
