"""Finite-temperature molecular dynamics load/unload of a NiTi supercell.

Unlike the athermal quasi-static loop (aqs.py), here the cell is held at a
finite temperature with a Langevin thermostat while an axial strain is cycled
up and back down. Above the transformation temperature the stress-induced
martensite can revert on unloading, which closes the superelastic hysteresis
loop. The per-frame temperature also carries the elastocaloric signal (the
material warms as martensite forms and cools as it reverts).

Returns the same LoopResult container as aqs.run_loop, plus temperature_k.
"""

from __future__ import annotations

import numpy as np
from ase import units
from ase.md.langevin import Langevin
from ase.md.velocitydistribution import MaxwellBoltzmannDistribution, Stationary

from .aqs import LoopResult, EV_PER_A3_TO_GPA
from .order import LocalStrain


def _strain_axial(atoms, ratio):
    F = np.diag([1.0, 1.0, ratio])
    atoms.set_cell(atoms.cell[:] @ F.T, scale_atoms=True)


def run_md_loop(
    atoms,
    calc,
    temperature_k: float = 600.0,
    eps_max: float = 0.08,
    n_steps: int = 24,
    steps_per_frame: int = 60,
    equil_steps: int = 400,
    dt_fs: float = 2.0,
    friction: float = 0.01,
    op_cutoff: float = 3.5,
    verbose: bool = True,
) -> LoopResult:
    """Cyclic uniaxial strain under NVT MD. Returns a LoopResult with temperature."""
    atoms = atoms.copy()
    atoms.calc = calc
    dt = dt_fs * units.fs

    MaxwellBoltzmannDistribution(atoms, temperature_K=temperature_k)
    Stationary(atoms)
    dyn = Langevin(atoms, dt, temperature_K=temperature_k, friction=friction)

    if verbose:
        print(f"  equilibrating {equil_steps} steps at {temperature_k:.0f} K...")
    dyn.run(equil_steps)

    ref = atoms.copy()
    op_engine = LocalStrain(ref, cutoff=op_cutoff)

    up = np.linspace(0.0, eps_max, n_steps + 1)
    down = np.linspace(eps_max, 0.0, n_steps + 1)[1:]
    schedule = np.concatenate([up, down])

    V0 = atoms.get_volume()
    na = len(atoms)
    strain, stress, energy, temp = [], [], [], []
    positions, cells, ops = [], [], []
    prev_eps = 0.0

    for k, eps in enumerate(schedule):
        ratio = (1.0 + eps) / (1.0 + prev_eps)
        if abs(ratio - 1.0) > 1e-12:
            _strain_axial(atoms, ratio)
        prev_eps = eps

        acc_s, acc_t = [], []
        half = steps_per_frame // 2
        for sub in range(steps_per_frame):
            dyn.run(1)
            if sub >= half:
                acc_s.append(atoms.get_stress(voigt=True)[2])
                acc_t.append(atoms.get_temperature())

        s_zz = float(np.mean(acc_s)) * EV_PER_A3_TO_GPA
        T = float(np.mean(acc_t))
        u = atoms.get_potential_energy()
        strain.append(eps); stress.append(s_zz); energy.append(u); temp.append(T)
        positions.append(atoms.get_positions().astype(np.float32))
        cells.append(np.array(atoms.cell[:], dtype=np.float32))
        ops.append(op_engine.compute(atoms).astype(np.float32))
        if verbose:
            print(f"  frame {k:3d}  eps={eps:+.4f}  sigma={s_zz:+7.3f} GPa  "
                  f"T={T:6.1f} K  U={u:+.2f} eV")

    strain = np.array(strain); stress = np.array(stress)
    energy = np.array(energy); temp = np.array(temp)

    sig_evA3 = stress / EV_PER_A3_TO_GPA
    dW = np.zeros_like(energy)
    dW[1:] = 0.5 * (sig_evA3[1:] + sig_evA3[:-1]) * np.diff(strain) * V0
    dU = np.zeros_like(energy); dU[1:] = np.diff(energy)
    heat_flow = dW - dU
    cum_heat = np.cumsum(heat_flow)

    return LoopResult(
        strain=strain, stress_gpa=stress, energy_ev=energy,
        energy_per_atom=energy / na, heat_flow_ev=heat_flow, cum_heat_ev=cum_heat,
        positions=np.array(positions, dtype=np.float32),
        cells=np.array(cells, dtype=np.float32),
        op=np.array(ops, dtype=np.float32),
        numbers=atoms.get_atomic_numbers(),
        temperature_k=temp,
        meta={
            "mode": "md", "temperature_k": temperature_k, "eps_max": eps_max,
            "n_frames": len(strain), "n_atoms": na,
            "dt_fs": dt_fs, "steps_per_frame": steps_per_frame,
            "supercell": list(atoms.info.get("supercell", ())),
            "residual_strain": float(strain[-1]),
            "stress_drop": float(stress.max() - stress[-1]),
        },
    )
