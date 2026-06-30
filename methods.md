# Methods

All simulations use the [`shapemem`](https://github.com/ophusgroup/shape-memory) Python package together with the **MACE-MP0** foundation interatomic potential (`medium-mpa-0`) through the Atomic Simulation Environment (ASE).

## Building the supercell

We start from the B2 austenite unit cell (CsCl structure, lattice constant near 3.0 Angstrom) and tile it into an `N_a x N_b x N_depth` supercell. The third axis is the **projection axis** that the widget views down. We tile it to at least 12 Angstrom so that an atom does not interact with its own periodic image through the potential's finite receptive field.

## Validating the potential

Before any loading, we confirm that MACE-MP0 captures the transformation. Relaxing both phases gives:

- martensite (B19') lower in energy than austenite (B2) by about **33 meV per atom**, the correct ordering, and
- a relaxed martensite that keeps its monoclinic distortion (it does not collapse back to cubic).

This is consistent with density-functional theory, so the potential is a sound basis for the demos.

## The loading cycle

We load the cell with an **athermal quasi-static** protocol:

1. Impose an axial strain along the loading axis in small increments, ramping from zero up to the maximum strain and back to zero (one cycle).
2. At each increment, relax the internal atomic coordinates and the transverse and shear components of the cell with MACE-MP0, holding only the imposed axial strain fixed. This is uniaxial-stress-like control that still lets martensite form its natural monoclinic shear.
3. Carry the relaxed structure forward to the next increment. Because the transformation has an energy barrier, loading can be trapped in metastable martensite minima and unloading follows a different path, which produces a genuine **stress-strain hysteresis** loop.

For each frame we record the atomic positions, the axial stress, the potential energy, and the per-atom order parameter.

:::{important}
At zero temperature the single crystal transforms **one way**: once it shears into martensite under load it stays there on unloading, because MACE correctly places martensite below austenite in energy. This is the true shape-memory effect. Recovering austenite (the cooling half of the elastocaloric cycle) is a finite-temperature effect driven by entropy, which we treat with finite-temperature molecular dynamics in a separate demo.
:::

## The order parameter

Each atom is colored by a **local atomic shear strain** (a Falk-Langer measure). For every atom we fit the best local deformation gradient that maps its austenite-reference neighbor vectors onto the current frame, then take the von Mises shear of the resulting strain tensor. This is near zero in cubic austenite and grows where the lattice has sheared and shuffled into martensite, so it drives the red-to-cyan colormap directly. It is closely related to the polyhedral-template-matching phase labels used in larger molecular-dynamics studies.

## Heat flow

For the athermal cycle we report a thermodynamically consistent heat-flow proxy. At each step the released heat is the mechanical work put in minus the change in stored potential energy:

$$ \mathrm{d}Q = \mathrm{d}W - \mathrm{d}U, \qquad \mathrm{d}W = \langle\sigma\rangle\, \mathrm{d}\varepsilon\, V. $$

Summed over a closed cycle this equals the loop area, the total dissipated heat. The latent heat appears as a sharp spike in the heat flow at the transformation. For the actual adiabatic temperature change we run finite-temperature molecular dynamics and read the temperature directly.

## Reproducing

The scripts under `scripts/` regenerate every dataset:

- `m0_b2_vs_b19.py` runs the potential-validation check.
- `m1_run_loop.py` builds a supercell and runs one load/unload cycle, exporting the widget data.
- `plot_loop.py` plots the resulting curves for inspection.
