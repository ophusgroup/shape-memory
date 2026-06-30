"""Twinned martensite microstructures and detwinning.

A twinned martensite is built from a B2 supercell by applying the martensitic
shape change with the shear sign alternating in lamellae along y. Adjacent
lamellae are the two twin-related variants; where the shear flips sign there is a
coherent twin boundary. Detwinning is modeled by sweeping the variant-1 volume
fraction f from 1/2 (equal twins) toward 1 (single variant): the boundaries
migrate, the favoured variant grows, and the cell shears over.

Projection is down z; shear and loading are in the x-y plane. The mean shear
gamma*(2f-1) is carried by the cell (so the structure stays periodic); the atoms
carry only the deviation from the mean, which is the triangle-wave displacement
that makes the lamellae visible.
"""

from __future__ import annotations

import numpy as np
from .build import b2_supercell


def build_twin_frame(n_a=12, n_b=12, min_depth=3.0, n_bands=3, gamma=0.13,
                     e_xx=-0.04, e_yy=0.03, frac=0.5, shuffle=0.08):
    """ASE Atoms of a twinned (f=0.5) to detwinned (f->1) martensite."""
    atoms = b2_supercell(n_a=n_a, n_b=n_b, min_depth_ang=min_depth)

    # Bain normal strains (carry atoms with the cell)
    atoms.set_cell(np.array(atoms.cell) @ np.diag([1 + e_xx, 1 + e_yy, 1.0]).T,
                   scale_atoms=True)
    Ly = atoms.cell[1, 1]
    P = Ly / n_bands
    f = float(np.clip(frac, 0.02, 0.98))
    mean_slope = gamma * (2 * f - 1)

    # mean shear -> cell (atoms carried along), keeps periodicity
    cell = np.array(atoms.cell)
    cell[1, 0] = mean_slope * Ly
    atoms.set_cell(cell, scale_atoms=True)

    # deviation-from-mean triangle wave u(y): slope d1 in variant-1, d2 in variant-2
    d1 = gamma - mean_slope          # = 2 gamma (1 - f)
    d2 = -gamma - mean_slope         # = -2 gamma f
    pos = atoms.get_positions()
    y = pos[:, 1]
    ph = (y % P) / P
    yl = ph * P
    peak = d1 * f * P
    u = np.where(ph < f, d1 * yl, peak + d2 * (yl - f * P))
    pos[:, 0] += u

    # small internal shuffle, alternating by sublattice
    nums = atoms.get_atomic_numbers()
    pos[:, 0] += np.where(nums == 28, shuffle, -shuffle) * np.sin(2 * np.pi * ph)
    atoms.set_positions(pos)
    atoms.wrap()
    atoms.info["twin"] = dict(n_bands=n_bands, gamma=gamma, frac=f, P=float(P))
    return atoms


def variant_field(atoms, gamma=0.13):
    """Signed per-atom variant indicator in [-1, 1] from the local dx/dy shear.

    +1 = variant 1, -1 = variant 2, ~0 = boundary. Uses the local slope of
    neighbour displacements relative to the (already sheared) cell mean removed.
    """
    from scipy.spatial import cKDTree
    pos = atoms.get_positions()
    cell = np.array(atoms.cell)
    mean_slope = cell[1, 0] / cell[1, 1]
    tree = cKDTree(pos[:, :2])
    _, idx = tree.query(pos[:, :2], k=7)
    out = np.zeros(len(atoms))
    for i in range(len(atoms)):
        nb = idx[i][1:]
        dy = pos[nb, 1] - pos[i, 1]
        dx = pos[nb, 0] - pos[i, 0]
        m = np.abs(dy) > 0.4
        if m.sum() >= 2:
            slope = np.sum(dx[m] * dy[m]) / np.sum(dy[m] * dy[m])
            out[i] = np.clip((slope) / gamma, -1.2, 1.2)
    return out
