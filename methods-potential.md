# Interatomic potential

All energies and forces come from the **MACE-MP0** foundation machine-learning interatomic potential (`medium-mpa-0`), driven through the Atomic Simulation Environment (ASE). The [`shapemem`](https://github.com/ophusgroup/shape-memory) package builds the structures, runs the protocols, and exports the data shown on this site.

## Validation

Before any loading we confirm that MACE-MP0 reproduces the transformation. Relaxing the experimental B19' structure with MACE-MP0 gives lattice parameters a = 2.85, b = 4.17, c = 4.67 Å, β = 99.9°, within about 2% of the measured values (2.90, 4.11, 4.65 Å, 97.78°). The martensite is **35 meV per atom** below austenite, the correct ordering, so the structure and energetics are sound.

One known limitation: this 35 meV/atom latent heat overestimates the measured value (about 8–10 meV/atom) by roughly threefold, a typical accuracy issue for foundation potentials on near-degenerate phases. Adiabatic temperature changes reported here therefore scale too high (upper bounds), while transformation strains and the figure of merit COP (a ratio) are more reliable.

## Supercells

We start from the B2 austenite unit cell (CsCl structure, lattice constant near 3.0 Å) and tile it into an `N_a × N_b × N_depth` supercell. The third axis is the projection direction the widgets view down; it is kept thin (one to a few cells) so the in-plane structure reads clearly, while loading is applied in-plane so the transformation is visible in projection.
