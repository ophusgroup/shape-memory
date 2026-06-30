# Shape-memory effect

Below the transformation temperature NiTi behaves differently from the reversible [superelastic cycle](demos.md). This loading cycle is a direct athermal MACE-MP0 simulation of a 200-atom cell, with no model assumptions: the cell shears into martensite on loading and **stays** there on unloading, because at 0 K martensite is the lower-energy phase. The stress-strain curve is an open loop, the signature of the one-way shape-memory effect. The remembered austenite shape is recovered only on heating above the austenite-finish temperature.

:::{anywidget} ./widgets/elastocaloric.js
{
  "data_url": "../widgets/data/niti_2d.bin",
  "meta_url": "../widgets/data/niti_2d.json"
}
:::

Atoms are colored by the local order parameter (red austenite, cyan martensite). Use the controls to change the plotted quantity, the atom coloring, and the polyhedra overlay.
