"""R10: transformation energy landscape.

Energy along the B2 -> B19' path: at each point the cell is interpolated between
the relaxed austenite and martensite, the internal atoms are relaxed at that
fixed cell, and the MACE-MP0 energy is recorded. This shows the austenite as a
shallow metastable well, a small barrier, and the deeper martensite well -- the
double-well landscape that underlies the transformation and its hysteresis.
"""
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from ase.optimize import FIRE
from mace.calculators import mace_mp
from shapemem import b2_supercell
from shapemem.superelastic import relax_endpoints

ROOT = Path(__file__).resolve().parent.parent
calc = mace_mp(model="medium-mpa-0", device="cpu", default_dtype="float32")

A, M, eA, eM = relax_endpoints(b2_supercell(n_a=6, n_b=6, min_depth_ang=3.0), calc)
cellA, cellM = np.array(A.cell), np.array(M.cell)
fracA = A.get_scaled_positions(wrap=True)
fracM = M.get_scaled_positions(wrap=True)
d = fracM - fracA; d -= np.round(d); fracM = fracA + d
na = len(A)

lams = np.linspace(-0.1, 1.1, 19)   # extend a bit past both ends
E = []
for lam in lams:
    cell = (1-lam)*cellA + lam*cellM
    frac = (1-lam)*fracA + lam*fracM
    at = A.copy(); at.set_cell(cell, scale_atoms=False); at.set_scaled_positions(frac)
    at.calc = calc
    FIRE(at, logfile=None).run(fmax=0.03, steps=80)   # relax atoms at fixed cell
    E.append(at.get_potential_energy()/na)
    print(f"  lam={lam:+.2f}  E={E[-1]:.4f} eV/atom", flush=True)

E = np.array(E); E = (E - E[np.argmin(np.abs(lams))]) * 1000  # meV/atom, ref austenite

fig, ax = plt.subplots(figsize=(5.6, 3.6))
ax.plot(lams, E, "-o", color="#8c1515", ms=4)
ax.axhline(0, color="#999", lw=0.8, ls=":")
ax.set_xlabel("reaction coordinate  (B2 $\\to$ B19$'$)")
ax.set_ylabel("energy  (meV / atom)")
ax.set_title("Transformation energy landscape (MACE-MP0)")
ax.annotate("austenite (B2)", (0, 0), textcoords="offset points", xytext=(6, 8), fontsize=9)
imin = np.argmin(E)
ax.annotate("martensite (B19$'$)", (lams[imin], E[imin]), textcoords="offset points",
            xytext=(-10, -14), fontsize=9, color="#1763d6")
ax.grid(alpha=0.25)
fig.tight_layout()
out = ROOT / "images" / "energy_landscape.png"
out.parent.mkdir(parents=True, exist_ok=True)
fig.savefig(out, dpi=130)
print(f"wrote {out};  martensite well = {E.min():.1f} meV/atom at lam={lams[imin]:.2f}")
