"""R7: verify the martensite structure against the literature B19'.

Builds the experimental B19' (P2_1/m, Kudoh et al. 1985) as a 4-atom cell, tiles
and relaxes it with MACE-MP0, and reports the relaxed lattice parameters and the
energy relative to B2 austenite. Compares to the seed-relaxed martensite used in
the demos to confirm they are the same phase.
"""
import numpy as np
from ase import Atoms
from ase.filters import FrechetCellFilter
from ase.optimize import FIRE
from mace.calculators import mace_mp
from shapemem import b2_supercell
from shapemem.superelastic import relax_endpoints

calc = mace_mp(model="medium-mpa-0", device="cpu", default_dtype="float32")

def b19_unit():
    a, b, c, beta = 2.898, 4.108, 4.646, 97.78
    br = np.deg2rad(beta)
    cell = np.array([[a,0,0],[0,b,0],[c*np.cos(br),0,c*np.sin(br)]])
    frac = np.array([[0.4726,0.25,0.0917],[0.5274,0.75,0.9083],
                     [0.0372,0.25,0.6752],[0.9628,0.75,0.3248]])
    return Atoms("Ti2Ni2", scaled_positions=frac, cell=cell, pbc=True)

# austenite reference (per-atom)
A = b2_supercell(n_a=4, n_b=4, min_depth_ang=9.0); A.calc = calc
FIRE(FrechetCellFilter(A), logfile=None).run(fmax=0.02, steps=200)
eA = A.get_potential_energy()/len(A)

# literature B19', tiled and relaxed
m = b19_unit() * (4, 3, 3)
m.calc = calc
FIRE(FrechetCellFilter(m), logfile=None).run(fmax=0.02, steps=300)
eM = m.get_potential_energy()/len(m)
a,b,c,al,be,ga = m.cell.cellpar()
# normalize the tiled params back to one cell
print(f"austenite E = {eA:.4f} eV/atom")
print(f"B19' (literature, relaxed): {len(m)} atoms, E = {eM:.4f} eV/atom")
print(f"  dH = {(eA-eM)*1000:+.1f} meV/atom  (martensite should be lower)")
print(f"  relaxed cell per unit: a={a/4:.3f} b={b/3:.3f} c={c/3:.3f} beta={be:.2f} deg")
print(f"  literature input:      a=2.898 b=4.108 c=4.646 beta=97.78 deg")

# demo martensite (seed-relaxed) for comparison
A2, M2, eA2, eM2 = relax_endpoints(b2_supercell(n_a=6, n_b=6, min_depth_ang=3.0), calc)
print(f"demo seed-relaxed martensite: dH = {(eA2-eM2)/len(A2)*1000:+.1f} meV/atom")
