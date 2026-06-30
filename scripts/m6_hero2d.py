"""M6: large pseudo-2D hero dataset.

A big in-plane supercell, only ONE unit cell deep along the projection axis, so
the widget renders it as a clean 2D microstructure. Athermal quasi-static
load/unload (reliable transformation). Exports niti_2d.

Usage: python scripts/m6_hero2d.py
"""

import time
from pathlib import Path

from mace.calculators import mace_mp

from shapemem import b2_supercell, run_loop, export

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "widgets" / "data"

calc = mace_mp(model="medium-mpa-0", device="cpu", default_dtype="float32")

atoms = b2_supercell(n_a=10, n_b=10, min_depth_ang=3.0)  # 10x10x1 = 200 atoms, pseudo-2D
print(f"supercell {atoms.info['supercell']} -> {len(atoms)} atoms")

t0 = time.time()
res = run_loop(atoms, calc, eps_max=0.09, n_steps=26, fmax=0.04, max_relax_steps=140)
print(f"\ndone in {time.time()-t0:.0f}s, {res.meta['n_frames']} frames")
print(f"peak stress {res.stress_gpa.max():.2f} GPa, OP range {res.op.min():.3f}-{res.op.max():.3f}")
export(res, OUT, "niti_2d")
print(f"wrote {OUT/'niti_2d.bin'}")
