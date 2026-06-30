"""Per-atom order parameter: local atomic shear strain (Falk-Langer).

For each atom we fit the best local deformation gradient F_i that maps its
reference (B2, frame 0) neighbor vectors onto the current frame's neighbor
vectors, then take the von Mises shear of the local Lagrangian strain
E_i = 1/2 (F_i^T F_i - I). This is ~0 in austenite and grows in the sheared,
shuffled martensite, so it drives the red(austenite) -> cyan(martensite)
colormap directly.

The neighbor *identities* (and periodic image shifts) are fixed from the
reference frame: martensitic transformation is displacive, atoms keep their
neighbors, so this is well defined across the whole trajectory.
"""

from __future__ import annotations

import numpy as np
from ase import Atoms
from ase.neighborlist import neighbor_list


class LocalStrain:
    """Reusable per-atom local-strain order parameter against a fixed reference."""

    def __init__(self, ref: Atoms, cutoff: float = 3.5):
        self.n = len(ref)
        i, j, S = neighbor_list("ijS", ref, cutoff)
        self.i, self.j, self.S = i, j, S
        ref_pos = ref.get_positions()
        self.D0 = ref_pos[j] + S @ ref.cell[:] - ref_pos[i]
        # group bond rows by center atom for the per-atom least-squares fit
        order = np.argsort(i, kind="stable")
        self.i, self.j, self.S, self.D0 = i[order], j[order], S[order], self.D0[order]
        self._starts = np.searchsorted(self.i, np.arange(self.n))
        self._stops = np.searchsorted(self.i, np.arange(self.n), side="right")

    def compute(self, atoms: Atoms) -> np.ndarray:
        """Return per-atom von Mises shear strain (length n_atoms)."""
        pos = atoms.get_positions()
        cell = atoms.cell[:]
        D = pos[self.j] + self.S @ cell - pos[self.i]
        op = np.zeros(self.n)
        for a in range(self.n):
            s, e = self._starts[a], self._stops[a]
            if e - s < 3:
                continue
            d0, d = self.D0[s:e], D[s:e]
            # solve d0 @ F^T ~= d  (least squares) -> F (3x3)
            F, *_ = np.linalg.lstsq(d0, d, rcond=None)
            F = F.T
            E = 0.5 * (F.T @ F - np.eye(3))
            dev = E - np.trace(E) / 3.0 * np.eye(3)
            op[a] = np.sqrt(1.5 * np.sum(dev * dev))  # von Mises equivalent strain
        return op
