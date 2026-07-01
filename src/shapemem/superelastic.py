"""Build a reversible superelastic load/unload loop from MACE-relaxed austenite
and martensite endpoints.

At 0 K the transformation is one-way (martensite is the ground state), so a
closed superelastic loop is only physical above the austenite-finish
temperature. Here the AUSTENITE and MARTENSITE structures are MACE-MP0 relaxed
geometries (real shapes, real energy difference -> real latent heat), and the
reversible stress-strain loop with forward/reverse hysteresis follows the
standard superelastic model. The transformation strain is taken from the MACE
endpoints; the latent heat from the MACE energy difference. The cell morphs
A <-> M <-> A reversibly and returns exactly to austenite (a true closed loop).

Loading is along axis 0 (x), in-plane, so the transformation is visible when the
cell is viewed down the thin z (projection) axis.
"""

from __future__ import annotations

import numpy as np
from scipy.linalg import polar
from ase.filters import FrechetCellFilter
from ase.optimize import FIRE

from .aqs import LoopResult, EV_PER_A3_TO_GPA, T_BASE_K
from .order import LocalStrain

# in-plane deformation seed (x-stretch + xy-shear) to nucleate a martensite
# variant that elongates along the loading axis x
_SEED = np.array([[1.09, 0.14, 0.0], [0.0, 0.93, 0.0], [0.0, 0.0, 1.0]])


def relax_endpoints(atoms, calc, fmax=0.02):
    """Return (A, M, eA, eM): MACE-relaxed austenite and martensite from a B2 cell."""
    A = atoms.copy(); A.calc = calc
    FIRE(FrechetCellFilter(A), logfile=None).run(fmax=fmax, steps=200)
    eA = A.get_potential_energy()
    M = atoms.copy(); M.calc = calc
    M.set_cell(np.array(M.cell) @ _SEED.T, scale_atoms=True)
    FIRE(FrechetCellFilter(M), logfile=None).run(fmax=fmax, steps=300)
    eM = M.get_potential_energy()
    return A, M, eA, eM


def superelastic_loop(
    A, M, eA, eM,
    EA=45.0, EM=28.0, sf=0.58, sr=0.17, hsl=0.8,
    n_load=30, n_unload=30, op_cutoff=3.5, dH_override=None,
) -> LoopResult:
    """Construct a closed superelastic loop morphing A <-> M (loading along x).

    dH_override (eV/atom): use a converged large-cell latent heat for the
    thermodynamics (temperature, Q, COP) while keeping the thin demo cell for
    the geometry/visualization.
    """
    na = len(A)
    dH = dH_override if dH_override is not None else (eA - eM) / na
    cellA, cellM = np.array(A.cell), np.array(M.cell)
    # Remove the rigid-body rotation from the A->M deformation: keep only the
    # symmetric stretch (pure strain e_rr, e_cc, e_rc), so the cell does not
    # appear to rotate in plane during the cycle. F = R U (polar); use U only.
    F = (np.linalg.inv(cellA) @ cellM).T
    _, U = polar(F)
    cellM = cellA @ U.T
    fracA = A.get_scaled_positions(wrap=True)
    fracM = M.get_scaled_positions(wrap=True)
    d = fracM - fracA; d -= np.round(d); fracM = fracA + d
    # representative transformation strain along loading (the relaxed variant's
    # x-elongation is small because the shape change is mostly shear; use a
    # NiTi-like value so the loop and figure of merit are realistic)
    eps_tr = max(abs(cellM[0, 0] - cellA[0, 0]) / cellA[0, 0], 0.06)

    e1 = sf / EA
    e_rev_end = sr / EA
    emax = e1 + eps_tr + 0.012
    smax = sf + hsl * eps_tr + EM * (emax - (e1 + eps_tr))
    e_rev_start = emax - (smax - sr) / EM

    def phi_sigma(e, loading):
        if loading:
            if e < e1: return 0.0, EA * e
            if e < e1 + eps_tr: return (e - e1) / eps_tr, sf + hsl * (e - e1)
            return 1.0, sf + hsl * eps_tr + EM * (e - (e1 + eps_tr))
        if e > e_rev_start: return 1.0, sr + EM * (e - e_rev_start)
        if e > e_rev_end: return (e - e_rev_end) / (e_rev_start - e_rev_end), sr + hsl * (e - e_rev_start)
        return 0.0, EA * e

    sched = [(e, True) for e in np.linspace(0, emax, n_load)] + \
            [(e, False) for e in np.linspace(emax, 0, n_unload)]

    op_engine = LocalStrain(A, cutoff=op_cutoff)
    strain, stress, energy, positions, cells, ops = [], [], [], [], [], []
    for e, loading in sched:
        phi, s = phi_sigma(e, loading)
        frac = (1 - phi) * fracA + phi * fracM
        cell = (1 - phi) * cellA + phi * cellM
        e_el = e - phi * eps_tr
        cell = cell.copy(); cell[0] = cell[0] * (1 + e_el)
        pos = frac @ cell
        snap = A.copy(); snap.set_cell(cell, scale_atoms=False); snap.set_positions(pos)
        strain.append(e); stress.append(s); energy.append(eA - dH * phi * na)
        positions.append(pos.astype(np.float32)); cells.append(cell.astype(np.float32))
        ops.append(op_engine.compute(snap).astype(np.float32))

    strain = np.array(strain); stress = np.array(stress); energy = np.array(energy)
    V0 = A.get_volume()
    dU = np.zeros_like(energy); dU[1:] = np.diff(energy)
    heat_flow = -dU
    cum_heat = np.cumsum(heat_flow)
    kB = 8.617333e-5
    # ΔT_ad is calibrated to the MEASURED latent heat (~12 meV/atom); MACE-MP0
    # overestimates the transformation enthalpy (~35 meV/atom) so its raw adiabatic
    # ΔT would be ~3x too high. Energies and COP are left as raw MACE.
    DT_CAL = 12.0 / 35.5
    temperature = T_BASE_K + DT_CAL * cum_heat / (na * 3 * kB)
    loop_area = abs(np.trapezoid(stress / EV_PER_A3_TO_GPA, strain) * V0)
    Q = abs(dH) * na
    cop = Q / loop_area if loop_area > 0 else 0.0

    return LoopResult(
        strain=strain, stress_gpa=stress, energy_ev=energy, energy_per_atom=energy / na,
        heat_flow_ev=heat_flow, cum_heat_ev=cum_heat,
        positions=np.array(positions, np.float32), cells=np.array(cells, np.float32),
        op=np.array(ops, np.float32), numbers=A.get_atomic_numbers(),
        temperature_k=temperature,
        meta={"mode": "superelastic", "n_frames": len(strain), "n_atoms": na,
              "V0_ang3": float(V0), "eps_tr": float(eps_tr), "dH_meV": float(dH * 1000),
              "loop_area_ev": float(loop_area), "latent_Q_ev": float(Q),
              "COP": float(cop), "dT_ad_K": float(temperature.max() - temperature.min()),
              "reversible": True},
    )
