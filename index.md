# Atomistic Shape-Memory & Elastocaloric Simulations

Shape-memory alloys like NiTi (Nitinol) recover large deformations through a reversible, diffusionless transformation between a high-symmetry **austenite** phase and a low-symmetry **martensite** phase. The same transformation absorbs and releases latent heat, which makes these alloys candidates for solid-state **elastocaloric** cooling: stress the material and it warms, release the stress and it cools. This site simulates small periodic NiTi supercells, loads and unloads them, and computes the energies and forces with the **MACE-MP0** machine-learning interatomic potential.

:::{anywidget} ./widgets/elastocaloric.js
{
  "data_url": "widgets/data/niti_polycrystal_big.bin",
  "meta_url": "widgets/data/niti_polycrystal_big.json",
  "layout": "wide",
  "poly_default": false
}
:::

A 36-grain Nitinol polycrystal driven through one elastocaloric loading and unloading cycle. See the [Polycrystal elastocaloric cycle](polycrystal.md) page for what it shows.

## Contents

**Physics**
- [The martensitic transformation](background.md)
- [The elastocaloric effect](elastocaloric.md)

**Methods**
- [Interatomic potential](methods-potential.md)
- [Loading protocols](methods-loading.md)
- [Observables](methods-observables.md)

**Simulated results**
- [The B2 to B19' mechanism](mechanism.md)
- [Elastocaloric loading cycle](demos.md)
- [Shape-memory effect](shape-memory.md)
- [Twinning and detwinning](microstructure.md)
- [Polycrystal elastocaloric cycle](polycrystal.md)
- [Orientation dependence](orientation.md)
- [Texture and the figure of merit](texture.md)

**Reference**
- [References and methods notes](references.md)

These are small cells for teaching and fast in-browser visualization. The energies and forces are computed with MACE-MP0, but cell sizes and stress magnitudes are demo-scale; quantitative, full-scale simulations are run on HPC.
