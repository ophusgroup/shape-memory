"""M0 go/no-go: does MACE-MP0 capture the NiTi B2 <-> B19' transformation?

Relax B2 austenite (CsCl, Pm-3m) and B19' martensite (P2_1/m) with MACE-MP0,
compare per-atom energies, and check the martensite keeps a monoclinic
distortion (beta != 90, b/a != 1) rather than collapsing back to cubic.

Run:  source .venv/bin/activate && python scripts/m0_b2_vs_b19.py
"""

import numpy as np
from ase import Atoms
from ase.optimize import FIRE
from ase.filters import FrechetCellFilter
from mace.calculators import mace_mp

MODEL = "medium-mpa-0"
DTYPE = "float64"  # accurate small energy differences matter here

calc = mace_mp(model=MODEL, device="cpu", default_dtype=DTYPE)


def relax(atoms, label, fmax=0.01, steps=300):
    atoms.calc = calc
    e0 = atoms.get_potential_energy() / len(atoms)
    opt = FIRE(FrechetCellFilter(atoms), logfile=None)
    opt.run(fmax=fmax, steps=steps)
    e1 = atoms.get_potential_energy() / len(atoms)
    print(f"  {label}: E0={e0:+.4f}  ->  E_relaxed={e1:+.4f} eV/atom  ({len(atoms)} atoms)")
    return e1


def cell_report(atoms, label):
    a, b, c, al, be, ga = atoms.cell.cellpar()
    print(f"  {label} cell: a={a:.3f} b={b:.3f} c={c:.3f}  "
          f"alpha={al:.2f} beta={be:.2f} gamma={ga:.2f}")
    return a, b, c, al, be, ga


# --- B2 austenite: CsCl-type, Ni at corner, Ti at body center ---
aB2 = 3.015
b2 = Atoms(
    "NiTi",
    scaled_positions=[(0, 0, 0), (0.5, 0.5, 0.5)],
    cell=[aB2, aB2, aB2],
    pbc=True,
)

# --- B19' martensite: P2_1/m, unique axis b (Kudoh et al. 1985, exptl) ---
a, bb, c, beta = 2.898, 4.108, 4.646, 97.78
br = np.deg2rad(beta)
cellB19 = np.array([
    [a, 0.0, 0.0],
    [0.0, bb, 0.0],
    [c * np.cos(br), 0.0, c * np.sin(br)],
])
# Wyckoff 2e (x, 1/4, z) + symmetry mate (-x, 3/4, -z)
frac = np.array([
    [0.4726, 0.25, 0.0917],          # Ti1
    [0.5274, 0.75, 0.9083],          # Ti2
    [0.0372, 0.25, 0.6752],          # Ni1
    [0.9628, 0.75, 0.3248],          # Ni2
])
b19 = Atoms("Ti2Ni2", scaled_positions=frac, cell=cellB19, pbc=True)

print(f"MACE model: {MODEL}  dtype: {DTYPE}\n")
print("Relaxing B2 austenite...")
cell_report(b2, "B2 input")
eB2 = relax(b2, "B2")
cell_report(b2, "B2 final")

print("\nRelaxing B19' martensite...")
cell_report(b19, "B19' input")
eB19 = relax(b19, "B19'")
_, _, _, _, beF, _ = cell_report(b19, "B19' final")

dE = (eB19 - eB2) * 1000.0
print("\n" + "=" * 60)
print(f"  E(B19') - E(B2) = {dE:+.2f} meV/atom")
print(f"  B19' final beta = {beF:.2f} deg (90 = collapsed to cubic-ish)")
print("=" * 60)
print("GO if: B19' is at or below B2 (dE <~ 0) AND beta stays off 90.")
print("If B19' relaxes to beta~90 / dE>>0, MACE-MP0 misses martensite -> looks-first.")
