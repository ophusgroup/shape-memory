"""M8: precise composition comparison via per-composition superelastic loops.

To keep every composition in the martensite basin, we relax the pure-NiTi
austenite (A0) and martensite (M0) endpoints once, then for each composition
substitute the dopant at the SAME atomic sites in both A0 and M0 and relax each.
This gives a doped austenite and a doped martensite whose energy difference is
the doping-shifted latent heat. Each loop is built identically, so the latent
heat, transformation strain, and figure of merit COP are directly comparable.
"""
import json, time
from pathlib import Path
import numpy as np
from ase.filters import FrechetCellFilter
from ase.optimize import FIRE
from mace.calculators import mace_mp
from shapemem import b2_supercell, export
from shapemem.superelastic import relax_endpoints, superelastic_loop

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "widgets" / "data"
calc = mace_mp(model="medium-mpa-0", device="cpu", default_dtype="float32")

# pure endpoints once
A0, M0, _, _ = relax_endpoints(b2_supercell(n_a=6, n_b=6, min_depth_ang=3.0), calc)
print(f"pure endpoints ready ({len(A0)} atoms)")

# 72 atoms = 36 Ni + 36 Ti. (name, label, dopant, host, n)
RUNS = [
    ("niti_5050", "Ni₅₀Ti₅₀ (reference)", None, None, 0),
    ("niti_cu6",  "Ni₄₄Ti₅₀Cu₆ (Cu on Ni, 5.6 at%)", "Cu", "Ni", 4),
    ("niti_cu11", "Ni₃₉Ti₅₀Cu₁₁ (Cu on Ni, 11.1 at%)", "Cu", "Ni", 8),
    ("niti_hf6",  "Ni₅₀Ti₄₄Hf₆ (Hf on Ti, 5.6 at%)", "Hf", "Ti", 4),
    ("ni_rich",   "Ni₅₆Ti₄₄ (Ni-rich)", "Ni", "Ti", 4),
]

def relax(at):
    at = at.copy(); at.calc = calc
    FIRE(FrechetCellFilter(at), logfile=None).run(fmax=0.02, steps=160)
    return at, at.get_potential_energy()

index = {"reference": None, "doped": []}
for name, label, dopant, host, n in RUNS:
    A, M = A0.copy(), M0.copy()
    if dopant:
        rng = np.random.default_rng(2)
        idx = np.where(np.array(A.get_chemical_symbols()) == host)[0]
        sites = rng.choice(idx, size=min(n, len(idx)), replace=False)
        for s in sites:
            A[s].symbol = dopant; M[s].symbol = dopant
    t0 = time.time()
    A, eA = relax(A); M, eM = relax(M)
    res = superelastic_loop(A, M, eA, eM)
    export(res, OUT, name)
    m = res.meta
    print(f"{name}: {time.time()-t0:.0f}s  dH={m['dH_meV']:+.1f} meV  "
          f"eps_tr={m['eps_tr']*100:.1f}%  COP={m['COP']:.1f}  dT={m['dT_ad_K']:.0f}K")
    entry = {"name": name, "label": label, "composition": label, "json": f"{name}.json"}
    if index["reference"] is None: index["reference"] = entry
    else: index["doped"].append(entry)

(OUT / "compare_index.json").write_text(json.dumps(index, indent=2))
print(f"wrote compare_index.json with {len(index['doped'])} doped + reference")
