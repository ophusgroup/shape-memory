"""M7: reversible SUPERELASTIC cycle (above A_f), the main elastocaloric demo.

Builds the cycle from MACE-MP0 relaxed austenite and martensite endpoints (real
structures + real latent heat); the reversible loop follows the superelastic
model. See shapemem.superelastic for the physics notes. Loading is in-plane (x)
so the transformation is visible when viewed down the thin z axis. A modest cell
keeps the atoms large enough to see the shear + shuffle clearly.

Usage: python scripts/m7_superelastic.py
"""
import time
from pathlib import Path
from mace.calculators import mace_mp
from shapemem import b2_supercell, export
from shapemem.superelastic import relax_endpoints, superelastic_loop

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "widgets" / "data"
calc = mace_mp(model="medium-mpa-0", device="cpu", default_dtype="float32")

atoms = b2_supercell(n_a=6, n_b=6, min_depth_ang=3.0)  # 6x6x1 = 72 atoms, large atoms
print(f"supercell {atoms.info['supercell']} -> {len(atoms)} atoms")
t0 = time.time()
A, M, eA, eM = relax_endpoints(atoms, calc)
print(f"A E={eA/len(A):.4f}  M E={eM/len(A):.4f} eV/atom  dH={(eA-eM)/len(A)*1000:+.1f} meV/atom")
# use the converged large-cell latent heat (scripts/r3_latent_heat.py) for the
# thermodynamics, so the reported dT_ad and COP are not biased by the thin cell
res = superelastic_loop(A, M, eA, eM, dH_override=0.0355)  # eV/atom, canonical B19' (r7)
print(f"done in {time.time()-t0:.0f}s  COP={res.meta['COP']:.1f}  "
      f"eps_tr={res.meta['eps_tr']*100:.1f}%  dT_ad={res.meta['dT_ad_K']:.0f} K")
export(res, OUT, "niti_superelastic")
print(f"wrote {OUT/'niti_superelastic.bin'}")
