"""Find an AQS protocol that gives a REVERSIBLE closed loop.

Compares cell-relaxation constraints on a small cell and reports, for each:
  - whether the structure returns to austenite (energy & OP back to start),
  - the hysteresis loop area (we want > 0 but closed),
  - peak stress and peak OP (did it actually transform?).
"""
import time
import numpy as np
from mace.calculators import mace_mp
from shapemem import b2_supercell, run_loop
from shapemem.aqs import EV_PER_A3_TO_GPA

calc = mace_mp(model="medium-mpa-0", device="cpu", default_dtype="float32")

PROTOCOLS = [
    ("full (transverse+shear)", dict(cell_mask=[True,True,False,True,True,True], relax_cell=True)),
    ("no-shear (transverse only)", dict(cell_mask=[True,True,False,False,False,False], relax_cell=True)),
    ("atoms-only (fixed cell)", dict(relax_cell=False)),
]

for name, kw in PROTOCOLS:
    atoms = b2_supercell(n_a=6, n_b=6, min_depth_ang=3.0)
    t0 = time.time()
    res = run_loop(atoms, calc, eps_max=0.08, n_steps=18, fmax=0.02,
                   max_relax_steps=200, verbose=False, **kw)
    op0, opEnd, opPk = res.op[0].mean(), res.op[-1].mean(), res.op.mean(axis=1).max()
    e0, eEnd = res.energy_per_atom[0], res.energy_per_atom[-1]
    area = float(np.trapezoid(res.stress_gpa/EV_PER_A3_TO_GPA, res.strain)*res.meta['V0_ang3'])
    reverted = abs(eEnd-e0) < 0.003 and abs(opEnd-op0) < 0.02
    print(f"[{name}] {time.time()-t0:.0f}s")
    print(f"    OP start/peak/end: {op0:.3f}/{opPk:.3f}/{opEnd:.3f}   "
          f"E end-start: {(eEnd-e0)*1000:+.1f} meV/atom   "
          f"final stress: {res.stress_gpa[-1]:+.2f} GPa")
    print(f"    peak stress {res.stress_gpa.max():.2f} GPa   loop area {area:.3f} eV   "
          f"=> {'REVERSIBLE' if reverted else 'one-way / residual'}\n")
