"""R4: twinned martensite and detwinning.

Builds a twinned martensite (alternating shear variants with coherent boundaries)
from crystallographic twinning geometry, then animates detwinning by sweeping the
variant-1 fraction f from 1/2 (equal twins) to 1 (single variant) and back. The
boundaries migrate and the favoured variant grows. Atoms are colored by a signed
variant field; the right panel shows a model shear stress-strain detwinning loop.

The single-variant martensite is the MACE-MP0 ground state (see the other demos);
here the lamellar geometry follows the twinning equation and the detwinning is
shown as boundary migration with a standard detwinning stress-strain law.
"""
import json
from pathlib import Path
import numpy as np
from shapemem.twin import build_twin_frame, variant_field
from shapemem.aqs import LoopResult
from shapemem import export

OUT = Path(__file__).resolve().parent.parent / "public" / "widgets" / "data"

NA, NB, NBANDS, GAMMA = 16, 16, 4, 0.13
N = 26  # frames per half cycle

# detwinning stress-strain model (shear): elastic -> plateau (forward/reverse)
TAU_D, TAU_R, G = 0.16, 0.07, 6.0   # GPa: detwin / retwin plateau, shear modulus

def stress(strain_frac, loading):
    g = strain_frac  # 0..GAMMA
    e_el = (TAU_D if loading else TAU_R) / G
    if loading:
        return min(G * g, TAU_D) if g < e_el else TAU_D
    return min(G * g, TAU_R)

fracs = np.concatenate([np.linspace(0.5, 1.0, N), np.linspace(1.0, 0.5, N)[1:]])
loading = [True]*N + [False]*(N-1)

positions, cells, ops, strain, stress_g = [], [], [], [], []
for fr, ld in zip(fracs, loading):
    at = build_twin_frame(n_a=NA, n_b=NB, n_bands=NBANDS, gamma=GAMMA, frac=fr)
    # variant directly from the band structure (clean, no neighbour-estimate noise):
    # +1 = variant 1 (the growing one), -1 = variant 2; pale at the boundaries
    y = at.get_positions()[:, 1]
    P = at.cell[1, 1] / NBANDS
    ph = (y % P) / P
    v = np.where(ph < fr, 1.0, -1.0)
    db = np.minimum.reduce([ph, np.abs(ph - fr), np.abs(ph - 1.0)])  # dist to boundary
    v = v * np.clip(db / 0.06, 0.25, 1.0)
    g_app = GAMMA * (2*fr - 1)           # macroscopic shear strain
    positions.append(at.get_positions().astype(np.float32))
    cells.append(np.array(at.cell, dtype=np.float32))
    ops.append(v.astype(np.float32))
    strain.append(g_app)
    stress_g.append(stress(g_app, ld))

na = len(build_twin_frame(n_a=NA, n_b=NB, n_bands=NBANDS, gamma=GAMMA))
strain = np.array(strain); stress_g = np.array(stress_g)
nf = len(fracs)
res = LoopResult(
    strain=strain, stress_gpa=stress_g, energy_ev=np.zeros(nf),
    energy_per_atom=np.zeros(nf), heat_flow_ev=np.zeros(nf), cum_heat_ev=np.zeros(nf),
    positions=np.array(positions, np.float32), cells=np.array(cells, np.float32),
    op=np.array(ops, np.float32), numbers=build_twin_frame(n_a=NA, n_b=NB, n_bands=NBANDS, gamma=GAMMA).get_atomic_numbers(),
    meta={"kind": "twin", "n_frames": nf, "n_atoms": na, "n_bands": NBANDS,
          "gamma": GAMMA, "shear_label": True},
)
b, j = export(res, OUT, "niti_twin")
print(f"wrote {b} ({na} atoms, {nf} frames)")
print(f"variant range {np.array(ops).min():.2f}..{np.array(ops).max():.2f}, "
      f"shear strain max {strain.max()*100:.1f}%")
