"""Athermal quasi-static (AQS) uniaxial load/unload of a NiTi supercell.

Protocol (v1):
  * impose an axial (lab-z) strain in small increments, ramping 0 -> eps_max
    -> 0 (one cycle),
  * at every increment relax internal coordinates AND the transverse / shear
    cell components with MACE-MP0, holding only the imposed axial strain fixed
    (uniaxial-stress-like control that still lets martensite form its natural
    monoclinic shear),
  * carry the structure forward between increments, so loading can be trapped
    in metastable martensite minima and unloading follows a different path ->
    a genuine stress-strain hysteresis loop.

Recorded per frame: positions, cell, axial stress, potential energy, and the
per-atom local-strain order parameter.

Heat flow per step (elastocaloric proxy, thermodynamically consistent):
    dQ_released = dW - dU,  dW = <sigma_zz> * d_eps * V
The closed-cycle sum of dQ equals the loop area (total dissipated heat).
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from ase import Atoms
from ase.filters import FrechetCellFilter
from ase.optimize import FIRE

from .order import LocalStrain

# Voigt mask for FrechetCellFilter: [xx, yy, zz, yz, xz, xy].
# Free everything except zz (the imposed axial strain) so the cell may contract
# transversely and shear into martensite.
_UNIAXIAL_MASK = [True, True, False, True, True, True]

EV_PER_A3_TO_GPA = 160.21766208


@dataclass
class LoopResult:
    strain: np.ndarray
    stress_gpa: np.ndarray            # axial (zz) stress per frame
    energy_ev: np.ndarray            # total potential energy per frame
    energy_per_atom: np.ndarray
    heat_flow_ev: np.ndarray         # dW - dU per step (released > 0)
    cum_heat_ev: np.ndarray
    positions: np.ndarray            # (n_frames, n_atoms, 3) float32
    cells: np.ndarray                # (n_frames, 3, 3) float32
    op: np.ndarray                   # (n_frames, n_atoms) float32 local shear
    numbers: np.ndarray
    meta: dict = field(default_factory=dict)


def _apply_axial_strain(atoms: Atoms, ratio: float) -> None:
    """Multiply the lab-z dimension by `ratio`, scaling atoms with it."""
    F = np.diag([1.0, 1.0, ratio])
    atoms.set_cell(atoms.cell[:] @ F.T, scale_atoms=True)


def run_loop(
    atoms: Atoms,
    calc,
    eps_max: float = 0.07,
    n_steps: int = 24,
    fmax: float = 0.03,
    max_relax_steps: int = 120,
    op_cutoff: float = 3.5,
    verbose: bool = True,
) -> LoopResult:
    """Run one load/unload cycle and return per-frame trajectory + curves."""
    atoms = atoms.copy()
    atoms.calc = calc
    op_engine = LocalStrain(atoms, cutoff=op_cutoff)

    # strain schedule: 0 -> eps_max -> 0 (frame 0 is the unstrained reference)
    up = np.linspace(0.0, eps_max, n_steps + 1)
    down = np.linspace(eps_max, 0.0, n_steps + 1)[1:]
    schedule = np.concatenate([up, down])

    L0_z = atoms.cell[2, 2]
    V0 = atoms.get_volume()
    n_atoms = len(atoms)

    strain, stress, energy = [], [], []
    positions, cells, ops = [], [], []
    prev_eps = 0.0

    for k, eps in enumerate(schedule):
        ratio = (1.0 + eps) / (1.0 + prev_eps)
        if abs(ratio - 1.0) > 1e-12:
            _apply_axial_strain(atoms, ratio)
        prev_eps = eps

        opt = FIRE(FrechetCellFilter(atoms, mask=_UNIAXIAL_MASK), logfile=None)
        opt.run(fmax=fmax, steps=max_relax_steps)

        s_zz = atoms.get_stress(voigt=True)[2] * EV_PER_A3_TO_GPA  # eV/A^3 -> GPa
        u = atoms.get_potential_energy()
        strain.append(eps)
        stress.append(s_zz)  # ASE convention: tensile strain -> positive stress
        energy.append(u)
        positions.append(atoms.get_positions().astype(np.float32))
        cells.append(np.array(atoms.cell[:], dtype=np.float32))
        ops.append(op_engine.compute(atoms).astype(np.float32))
        if verbose:
            print(f"  frame {k:3d}  eps={eps:+.4f}  sigma_zz={stress[-1]:+7.3f} GPa  "
                  f"U={u:+.3f} eV")

    strain = np.array(strain)
    stress = np.array(stress)
    energy = np.array(energy)

    # heat flow: dQ = dW - dU, dW = <sigma> * d_eps * V0 (sigma GPa -> eV/A^3)
    dW = np.zeros_like(energy)
    sig_evA3 = stress / EV_PER_A3_TO_GPA
    deps = np.diff(strain)
    dW[1:] = 0.5 * (sig_evA3[1:] + sig_evA3[:-1]) * deps * V0
    dU = np.zeros_like(energy)
    dU[1:] = np.diff(energy)
    heat_flow = dW - dU
    cum_heat = np.cumsum(heat_flow)

    return LoopResult(
        strain=strain,
        stress_gpa=stress,
        energy_ev=energy,
        energy_per_atom=energy / n_atoms,
        heat_flow_ev=heat_flow,
        cum_heat_ev=cum_heat,
        positions=np.array(positions, dtype=np.float32),
        cells=np.array(cells, dtype=np.float32),
        op=np.array(ops, dtype=np.float32),
        numbers=atoms.get_atomic_numbers(),
        meta={
            "eps_max": eps_max,
            "n_steps": int(n_steps),
            "n_frames": len(strain),
            "n_atoms": n_atoms,
            "V0_ang3": float(V0),
            "L0_z_ang": float(L0_z),
            "supercell": list(atoms.info.get("supercell", ())),
            "loop_area_ev": float(np.trapezoid(stress / EV_PER_A3_TO_GPA, strain) * V0),
        },
    )
