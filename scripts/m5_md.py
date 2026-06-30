"""M5: finite-temperature MD load/unload loop.

  python scripts/m5_md.py sweep   # small cell, scan temperatures for a closed loop
  python scripts/m5_md.py         # production pseudo-2D run at PROD_T

The sweep prints, per temperature, the mean order parameter and stress at the
start vs the end of the cycle. A closed (superelastic) loop reverts: final OP
and stress fall back near their initial values. A stuck (one-way) loop keeps a
high final OP and a large compressive final stress.
"""

import sys
import time
from pathlib import Path

import numpy as np
from mace.calculators import mace_mp

from shapemem import b2_supercell, run_md_loop, export

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "widgets" / "data"

PROD_T = 600.0  # updated after the sweep
MODE = sys.argv[1] if len(sys.argv) > 1 else "prod"

calc = mace_mp(model="medium-mpa-0", device="cpu", default_dtype="float32")

if MODE == "sweep":
    for T in (400.0, 700.0, 1000.0):
        atoms = b2_supercell(n_a=4, n_b=4, min_depth_ang=3.0)
        t0 = time.time()
        res = run_md_loop(atoms, calc, temperature_k=T, eps_max=0.08, n_steps=10,
                          steps_per_frame=25, equil_steps=150, verbose=False)
        op0, opE = res.op[0].mean(), res.op[-1].mean()
        print(f"T={T:6.0f}K  ({time.time()-t0:.0f}s)  "
              f"OP start {op0:.3f} -> end {opE:.3f}  |  "
              f"stress start {res.stress_gpa[0]:+.2f} -> end {res.stress_gpa[-1]:+.2f} GPa  "
              f"| peak {res.stress_gpa.max():.2f} GPa")
else:
    atoms = b2_supercell(n_a=10, n_b=10, min_depth_ang=3.0)  # pseudo-2D, 200 atoms
    print(f"supercell {atoms.info['supercell']} -> {len(atoms)} atoms, T={PROD_T:.0f} K")
    t0 = time.time()
    res = run_md_loop(atoms, calc, temperature_k=PROD_T, eps_max=0.08, n_steps=28,
                      steps_per_frame=60, equil_steps=600)
    print(f"\ndone in {time.time()-t0:.0f}s  peak {res.stress_gpa.max():.2f} GPa  "
          f"OP end {res.op[-1].mean():.3f}  T range {res.temperature_k.min():.0f}-"
          f"{res.temperature_k.max():.0f} K")
    export(res, OUT, "niti_md")
    print(f"wrote {OUT/'niti_md.bin'}")
