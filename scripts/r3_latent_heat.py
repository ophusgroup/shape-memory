"""R3: accurate latent heat and adiabatic temperature change.

The adiabatic elastocaloric temperature change is dT_ad = L / c_p, where L is the
transformation latent heat and c_p the heat capacity. We compute both as well as
CPU allows:
  * L from the MACE-MP0 0 K energy difference between relaxed austenite and
    martensite on a large supercell (well converged in size),
  * c_p from finite-temperature MD: the slope of the total energy vs temperature
    (compared against the Dulong-Petit value 3 k_B/atom).
"""
import time
import numpy as np
from ase import units
from ase.md.langevin import Langevin
from ase.md.velocitydistribution import MaxwellBoltzmannDistribution, Stationary
from mace.calculators import mace_mp

from shapemem import b2_supercell
from shapemem.superelastic import relax_endpoints

calc = mace_mp(model="medium-mpa-0", device="cpu", default_dtype="float32")
kB = 8.617333e-5

# ---- latent heat from a large 0 K relaxation -----------------------------
big = b2_supercell(n_a=8, n_b=8, min_depth_ang=9.0)   # ~8x8x3 = 384 atoms
print(f"latent-heat cell: {len(big)} atoms", flush=True)
t0 = time.time()
A, M, eA, eM = relax_endpoints(big, calc)
L = (eA - eM) / len(A)  # eV/atom
print(f"  E_aust={eA/len(A):.4f}  E_mart={eM/len(A):.4f} eV/atom", flush=True)
print(f"  latent heat L = {L*1000:.2f} meV/atom  ({time.time()-t0:.0f}s)", flush=True)

# ---- heat capacity from MD (energy vs temperature) -----------------------
def mean_energy(atoms, T, equil=400, sample=400, dt_fs=2.0, friction=0.02):
    at = atoms.copy(); at.calc = calc
    MaxwellBoltzmannDistribution(at, temperature_K=T); Stationary(at)
    dyn = Langevin(at, dt_fs*units.fs, temperature_K=T, friction=friction)
    dyn.run(equil)
    es = []
    for _ in range(sample):
        dyn.run(1)
        es.append(at.get_potential_energy() + at.get_kinetic_energy())
    return float(np.mean(es))

mdcell = b2_supercell(n_a=4, n_b=4, min_depth_ang=9.0)  # smaller for MD stats
mdcell.calc = calc
# relax to martensite basin first (use M endpoint scaled? just relax)
from ase.filters import FrechetCellFilter
from ase.optimize import FIRE
FIRE(FrechetCellFilter(mdcell), logfile=None).run(fmax=0.03, steps=120)
na = len(mdcell)
temps = [150.0, 300.0, 450.0]
Es = []
for T in temps:
    t1 = time.time()
    E = mean_energy(mdcell, T)
    Es.append(E)
    print(f"  T={T:.0f}K  <E_tot>={E/na:.4f} eV/atom  ({time.time()-t1:.0f}s)", flush=True)

# linear fit E(T) -> cp = dE/dT
slope = np.polyfit(temps, np.array(Es)/na, 1)[0]  # eV/atom/K
cp_dp = 3 * kB
print("\n" + "="*56)
print(f"  latent heat L      = {L*1000:.2f} meV/atom")
print(f"  c_p (MD slope)     = {slope/kB:.2f} k_B/atom  ({slope*1e3:.4f} meV/atom/K)")
print(f"  c_p (Dulong-Petit) = 3.00 k_B/atom")
print(f"  dT_ad = L/c_p (MD) = {L/slope:.0f} K")
print(f"  dT_ad = L/c_p (DP) = {L/cp_dp:.0f} K")
print("="*56)
