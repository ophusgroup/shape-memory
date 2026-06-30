"""Build NiTi supercells for elastocaloric loading.

B2 austenite is the CsCl structure (Ni at the corner, Ti at the body center).
We tile it N_a x N_b x N_depth, where `depth` is the projection / "beam"
direction that the widget views down. Depth is tiled to at least ~12 A so
atoms do not interact with their own periodic image through MACE's ~2-layer
receptive field.
"""

from __future__ import annotations

import numpy as np
from ase import Atoms

A_B2 = 3.015  # B2 NiTi lattice constant (A), MACE-MP0 relaxed ~3.016


def b2_unit(a: float = A_B2) -> Atoms:
    """Single B2 (CsCl) NiTi unit cell: Ni at (0,0,0), Ti at (1/2,1/2,1/2)."""
    return Atoms(
        "NiTi",
        scaled_positions=[(0, 0, 0), (0.5, 0.5, 0.5)],
        cell=[a, a, a],
        pbc=True,
    )


def b2_supercell(
    n_a: int = 3,
    n_b: int = 3,
    min_depth_ang: float = 12.0,
    a: float = A_B2,
) -> Atoms:
    """B2 supercell of size n_a x n_b x n_depth.

    The third axis (depth) is the viewing/beam direction; its repeat count is
    chosen so the depth length is at least `min_depth_ang` angstroms.
    """
    n_depth = max(1, int(np.ceil(min_depth_ang / a)))
    sc = b2_unit(a) * (n_a, n_b, n_depth)
    sc.info["supercell"] = (n_a, n_b, n_depth)
    sc.info["a_b2"] = a
    return sc
