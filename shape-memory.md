# Shape-memory effect

Below the transformation temperature NiTi behaves differently from the reversible [superelastic cycle](demos.md). This animation runs the full one-way cycle of a 200-atom pseudo-2D cell and closes the loop with the thermal recovery step:

1. **Load (cold).** The cell is strained and shears into martensite. This part is a direct athermal MACE-MP0 simulation.
2. **Unload (cold).** Removing the stress recovers only the elastic strain. The transformation strain stays, leaving a **residual deformed martensite** (here about 4%): the material remembers the deformed shape, not the original one. The relaxed residual is again a MACE-MP0 structure.
3. **Heat.** Raised above the austenite-finish temperature, the martensite reverts to austenite and the **original shape is recovered** (strain returns to zero). This step morphs the residual martensite back to the relaxed austenite endpoint.

:::{anywidget} ./widgets/elastocaloric.js
{
  "data_url": "../widgets/data/niti_sme.bin",
  "meta_url": "../widgets/data/niti_sme.json"
}
:::

Plot the **strain** or **temperature** to follow the recovery: strain climbs on loading, holds through unloading, and falls back to zero only when the cell is heated. This open mechanical path, closed by heating, is the signature of the one-way shape-memory effect, in contrast to the closed isothermal loop of superelasticity. Atoms are colored by the local order parameter (red austenite, cyan martensite); use the controls to change the plotted quantity, the coloring, and the polyhedra overlay.
