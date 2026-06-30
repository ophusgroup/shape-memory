# Interactive demos

## Elastocaloric loading cycle

A single-crystal NiTi supercell driven through one load/unload cycle with MACE-MP0. Watch the cubic austenite (red) shear into martensite (cyan) as the strain ramps up, and follow the stress, energy, and heat flow on the right. The sharp spike in the heat flow at the transformation is the latent heat.

:::{anywidget} ./widgets/elastocaloric.js
{
  "data_url": "../widgets/data/niti_5050.bin",
  "meta_url": "../widgets/data/niti_5050.json"
}
:::

Use the **plot** menu to switch the right panel between the stress-strain loop, the energy, the per-step heat flow, and the cumulative heat. Use the **color** menu to switch the atoms between the order parameter and a plain element coloring (Ni versus Ti). Drag the left panel to rotate, scroll to zoom.

## The B2 to B19' transformation

The unit-cell mechanism behind everything above: cubic B2 austenite shears and shuffles into monoclinic B19' martensite. Slide through the transformation to see the lattice distort.

:::{anywidget} ./widgets/lattice-morph.js
{
  "a_b2": 3.015,
  "a_m": 2.898, "b_m": 4.108, "c_m": 4.646, "beta_m": 97.78
}
:::

## More to come

Microstructure demos (twinned martensite, gliding twin interfaces, nucleation at grain boundaries) and finite-temperature elastocaloric cooling are in progress.
