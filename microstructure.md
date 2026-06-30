# Twinning and detwinning

Martensite rarely forms as a single variant. To accommodate the shape change with little long-range strain, neighboring regions adopt twin-related variants that meet on coherent twin boundaries, giving the characteristic lamellar microstructure. Under stress the boundaries migrate and the favorably oriented variant grows, which is **detwinning** and is the main way martensite deforms.

:::{anywidget} ./widgets/elastocaloric.js
{
  "data_url": "../widgets/data/niti_twin.bin",
  "meta_url": "../widgets/data/niti_twin.json"
}
:::

The two variants are colored blue and orange, with the twin boundaries between them. As the shear strain increases, the blue variant grows at the expense of the orange one and the boundaries sweep across the cell; the right panel shows the shear stress, with a plateau where the boundaries move at nearly constant stress. On unloading the boundaries migrate back at a lower stress, giving the detwinning hysteresis.

The lamellar geometry follows the crystallographic twinning relation between the two variants, and the single-variant martensite is the MACE-MP0 ground state used in the other demos. The detwinning here is shown as boundary migration with a standard detwinning stress-strain law; resolving the boundary structure and its mobility quantitatively requires larger, finite-temperature simulations.

## Nucleation and growth

A perfect single crystal transforms homogeneously, but in practice martensite nucleates at a defect and grows behind a moving interface. Here a transformation front sweeps across the cell, converting austenite (red) to martensite (cyan) behind it.

:::{anywidget} ./widgets/elastocaloric.js
{
  "data_url": "../widgets/data/niti_nucleation.bin",
  "meta_url": "../widgets/data/niti_nucleation.json"
}
:::

The austenite and martensite are MACE-MP0 relaxed structures; the front position is driven by a stress-strain law with a small nucleation overshoot followed by a growth plateau, the standard description of a stress-induced transformation front (a Lüders-like band).
