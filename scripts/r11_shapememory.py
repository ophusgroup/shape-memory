"""R11: full one-way shape-memory cycle, with the heating recovery step.

Closes the loop the open AQS curve leaves dangling:
  1. LOAD (cold):   strain 0 -> eps_max, austenite shears into martensite (real MACE).
  2. UNLOAD (cold): remove the stress; the strain only partly recovers, leaving a
     residual deformed martensite (relax the loaded cell with the axial constraint
     released -> zero-stress martensite at residual strain).
  3. HEAT:          above the austenite-finish temperature the martensite reverts
     to austenite and the original shape is recovered (strain -> 0). Built by
     morphing the residual martensite back to the relaxed austenite endpoint.

Exports niti_sme in the widget format.
"""
import time
from pathlib import Path
import numpy as np
from ase.filters import FrechetCellFilter
from ase.optimize import FIRE
from mace.calculators import mace_mp
from shapemem import b2_supercell
from shapemem.order import LocalStrain
from shapemem.aqs import _apply_axial_strain, EV_PER_A3_TO_GPA, LoopResult
from shapemem.export import export

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "widgets" / "data"
AXIS = 0
EPS_MAX = 0.08
N_LOAD, N_UNLOAD, N_HEAT = 20, 8, 18
T_COLD, T_HOT = 240.0, 380.0

calc = mace_mp(model="medium-mpa-0", device="cpu", default_dtype="float32")
atoms = b2_supercell(n_a=10, n_b=10, min_depth_ang=3.0)
atoms.calc = calc
op_engine = LocalStrain(atoms, cutoff=3.5)
mask = [AXIS != 0, AXIS != 1, AXIS != 2, True, True, True]   # free all but driven axis
L0 = atoms.cell[AXIS, AXIS]
V0 = atoms.get_volume()
na = len(atoms)

def opOf(pos, cell):
    a = atoms.copy(); a.set_cell(cell, scale_atoms=False); a.set_positions(pos)
    return op_engine.compute(a).astype(np.float32)

# austenite reference (relax full cell)
FIRE(FrechetCellFilter(atoms), logfile=None).run(fmax=0.03, steps=160)
posA, cellA, E_A = atoms.get_positions().copy(), np.array(atoms.cell[:]), atoms.get_potential_energy()

frames_pos, frames_cell, frames_op = [], [], []
strain, stress, energy, temp = [], [], [], []

# ---- 1. LOAD (real MACE) ----
t0 = time.time(); prev = 0.0
for k, eps in enumerate(np.linspace(0, EPS_MAX, N_LOAD)):
    r = (1 + eps) / (1 + prev); prev = eps
    if abs(r - 1) > 1e-12: _apply_axial_strain(atoms, r, AXIS)
    FIRE(FrechetCellFilter(atoms, mask=mask), logfile=None).run(fmax=0.04, steps=140)
    frames_pos.append(atoms.get_positions().astype(np.float32))
    frames_cell.append(np.array(atoms.cell[:], dtype=np.float32))
    frames_op.append(op_engine.compute(atoms).astype(np.float32))
    strain.append(eps); stress.append(atoms.get_stress(voigt=True)[AXIS] * EV_PER_A3_TO_GPA)
    energy.append(atoms.get_potential_energy()); temp.append(T_COLD)
    print(f"  load {k:2d} eps={eps:+.3f} sig={stress[-1]:+6.2f} U={energy[-1]:.3f}", flush=True)
pos_load, cell_load, E_load, sig_load = frames_pos[-1], frames_cell[-1], energy[-1], stress[-1]

# residual: release axial constraint, relax to zero stress -> stays martensite
FIRE(FrechetCellFilter(atoms), logfile=None).run(fmax=0.03, steps=200)
pos_res, cell_res, E_res = atoms.get_positions().copy(), np.array(atoms.cell[:]), atoms.get_potential_energy()
eps_res = cell_res[AXIS, AXIS] / L0 - 1.0
print(f"  residual strain {eps_res*100:.1f}%  (E {(E_res-E_A)/na*1000:+.1f} meV/atom vs austenite)")

# ---- 2. UNLOAD (eps_max martensite -> residual martensite, stress -> 0) ----
for t in np.linspace(0, 1, N_UNLOAD + 1)[1:]:
    frames_pos.append(((1-t)*pos_load + t*pos_res).astype(np.float32))
    cl = (1-t)*cell_load + t*cell_res; frames_cell.append(cl.astype(np.float32))
    frames_op.append(opOf(frames_pos[-1], cl))
    strain.append((1-t)*EPS_MAX + t*eps_res); stress.append((1-t)*sig_load)
    energy.append((1-t)*E_load + t*E_res); temp.append(T_COLD)

# ---- 3. HEAT (residual martensite -> austenite, strain -> 0, T up) ----
for t in np.linspace(0, 1, N_HEAT + 1)[1:]:
    frames_pos.append(((1-t)*pos_res + t*posA).astype(np.float32))
    cl = (1-t)*cell_res + t*cellA; frames_cell.append(cl.astype(np.float32))
    frames_op.append(opOf(frames_pos[-1], cl))
    strain.append((1-t)*eps_res); stress.append(0.0)
    energy.append((1-t)*E_res + t*E_A); temp.append(T_COLD + t*(T_HOT - T_COLD))

# ---- assemble ----
strain = np.array(strain); stress = np.array(stress); energy = np.array(energy); temp = np.array(temp)
sig_evA3 = stress / EV_PER_A3_TO_GPA
dW = np.zeros_like(energy); dW[1:] = 0.5*(sig_evA3[1:]+sig_evA3[:-1])*np.diff(strain)*V0
dU = np.zeros_like(energy); dU[1:] = np.diff(energy)
heat = dW - dU; cum = np.cumsum(heat)
res = LoopResult(
    strain=strain, stress_gpa=stress, energy_ev=energy, energy_per_atom=energy/na,
    heat_flow_ev=heat, cum_heat_ev=cum,
    positions=np.array(frames_pos, dtype=np.float32), cells=np.array(frames_cell, dtype=np.float32),
    op=np.array(frames_op, dtype=np.float32), numbers=atoms.get_atomic_numbers(),
    temperature_k=temp,
    meta={"eps_max": EPS_MAX, "n_frames": len(strain), "n_atoms": na, "V0_ang3": float(V0),
          "L0_z_ang": float(L0), "supercell": list(atoms.info.get("supercell", ())),
          "residual_strain": float(eps_res), "phases": [N_LOAD, N_UNLOAD, N_HEAT]},
)
export(res, OUT, "niti_sme")
print(f"done in {time.time()-t0:.0f}s, {len(strain)} frames -> niti_sme")
