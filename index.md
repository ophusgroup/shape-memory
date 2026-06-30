# Atomistic Shape-Memory & Elastocaloric Simulations

Shape-memory alloys like NiTi (Nitinol) recover large deformations through a reversible, diffusionless transformation between a high-symmetry **austenite** phase and a low-symmetry **martensite** phase. The same transformation absorbs and releases latent heat, which makes these alloys candidates for solid-state **elastocaloric** cooling: stress the material and it warms, release the stress and it cools.

This site runs that physics atom by atom. We build small periodic NiTi supercells, load and unload them, and compute energies and forces with the **MACE-MP0** machine-learning interatomic potential. The result is an interactive, browser-based view of the transformation as it happens.

:::{anywidget} ./widgets/elastocaloric.js
{
  "data_url": "widgets/data/niti_5050.bin",
  "meta_url": "widgets/data/niti_5050.json"
}
:::

The left panel shows the supercell viewed down its projection axis, with each atom colored by a local order parameter: **red where the lattice is still cubic austenite** and **cyan where it has sheared into martensite**. The right panel traces the stress, energy, and heat flow as the cell is driven through one loading and unloading cycle. Press play, drag to rotate, or scrub the slider.

## What is here

- **[Background](background.md)** introduces the austenite/martensite transformation, superelasticity, and the elastocaloric effect.
- **[Methods](methods.md)** describes how the supercells are built, how MACE-MP0 drives the loading cycle, and how we define the order parameter and heat flow.
- **[Demos](demos.md)** collects the interactive widgets: the elastocaloric loop, the unit-cell transformation, and microstructure examples.
- **[Results](results.md)** compares compositions and shows how alloying changes the energy and heat-flow response.

:::{note}
These are deliberately small cells built for teaching and fast in-browser visualization. Quantitative, full-scale simulations are run separately on HPC. The physics shown here is real (computed with MACE-MP0), but the cell sizes, strain rates, and stress magnitudes are demo-scale.
:::
