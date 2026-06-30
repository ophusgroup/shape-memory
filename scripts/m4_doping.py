"""M4: run the AQS load/unload cycle for a few doped compositions and write a
compare index for the overlay widget.

Each doped cell is the same B2 supercell as the reference, with a few atoms
substituted onto the Ni or Ti sublattice. Outputs go to public/widgets/data/.

Usage: python scripts/m4_doping.py
"""

import json
import time
from pathlib import Path

import numpy as np
from mace.calculators import mace_mp

from shapemem import b2_supercell, run_loop, export

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "widgets" / "data"

# (name, label, dopant symbol, host symbol to replace, n_substitutions)
RUNS = [
    ("niti_cu", "Ni-Ti-Cu (Cu on Ni)", "Cu", "Ni", 4),
    ("niti_hf", "Ni-Ti-Hf (Hf on Ti)", "Hf", "Ti", 4),
    ("ni_rich", "Ni-rich (Ti to Ni)", "Ni", "Ti", 4),
]

calc = mace_mp(model="medium-mpa-0", device="cpu", default_dtype="float32")


def substitute(atoms, dopant, host, n, seed=0):
    rng = np.random.default_rng(seed)
    syms = np.array(atoms.get_chemical_symbols())
    host_idx = np.where(syms == host)[0]
    pick = rng.choice(host_idx, size=min(n, len(host_idx)), replace=False)
    for i in pick:
        atoms[i].symbol = dopant
    return atoms


index = {"reference": {"name": "niti_5050", "label": "NiTi 50:50 (reference)",
                       "json": "niti_5050.json"}, "doped": []}

for name, label, dopant, host, n in RUNS:
    atoms = b2_supercell(n_a=3, n_b=3, min_depth_ang=12.0)
    atoms = substitute(atoms, dopant, host, n)
    print(f"\n=== {name}: {label}  ({len(atoms)} atoms) ===")
    t0 = time.time()
    res = run_loop(atoms, calc, eps_max=0.09, n_steps=20, verbose=False)
    print(f"  done in {time.time()-t0:.0f}s  peak {res.stress_gpa.max():.2f} GPa  "
          f"heat {res.cum_heat_ev[-1]:.3f} eV")
    export(res, OUT, name)
    index["doped"].append({"name": name, "label": label, "json": f"{name}.json"})

(OUT / "compare_index.json").write_text(json.dumps(index, indent=2))
print(f"\nwrote {OUT/'compare_index.json'} with {len(index['doped'])} doped sets")
