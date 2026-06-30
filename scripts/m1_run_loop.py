"""M1 driver: build a single-crystal B2 supercell, run one AQS load/unload
cycle with MACE-MP0, export to widgets/data/.

Usage:
  python scripts/m1_run_loop.py smoke   # tiny + few steps, validates pipeline
  python scripts/m1_run_loop.py         # production single-crystal run
"""

import sys
import time
from pathlib import Path

from mace.calculators import mace_mp

from shapemem import b2_supercell, run_loop, export

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "widgets" / "data"

SMOKE = len(sys.argv) > 1 and sys.argv[1] == "smoke"

if SMOKE:
    cfg = dict(n_a=2, n_b=2, min_depth=12.0, eps_max=0.08, n_steps=4, name="smoke")
else:
    cfg = dict(n_a=3, n_b=3, min_depth=12.0, eps_max=0.09, n_steps=24, name="niti_5050")

calc = mace_mp(model="medium-mpa-0", device="cpu", default_dtype="float32")

atoms = b2_supercell(n_a=cfg["n_a"], n_b=cfg["n_b"], min_depth_ang=cfg["min_depth"])
print(f"supercell {atoms.info['supercell']}  ->  {len(atoms)} atoms")

t0 = time.time()
res = run_loop(atoms, calc, eps_max=cfg["eps_max"], n_steps=cfg["n_steps"])
print(f"\nloop done in {time.time()-t0:.1f} s, {res.meta['n_frames']} frames")
print(f"peak stress  = {res.stress_gpa.max():.3f} GPa")
print(f"loop area    = {res.meta['loop_area_ev']:.4f} eV  "
      f"({res.meta['loop_area_ev']/len(atoms)*1000:.2f} meV/atom)")
print(f"dissipated heat (cycle) = {res.cum_heat_ev[-1]:.4f} eV")
print(f"OP range     = {res.op.min():.3f} .. {res.op.max():.3f}")

bin_p, json_p = export(res, OUT, cfg["name"])
print(f"wrote {bin_p.relative_to(ROOT)} ({bin_p.stat().st_size/1024:.0f} KB) + "
      f"{json_p.relative_to(ROOT)}")
