# Elastocaloric loading cycle

A NiTi cell driven through one superelastic load/unload cycle. Above the austenite-finish temperature the transformation is reversible: stress drives austenite (red) into martensite (cyan) on loading and reverts on unloading, tracing a closed hysteresis loop. The right panel traces the stress, energy, heat flow, and temperature; the temperature rises as martensite forms and falls as it reverts.

:::{anywidget} ./widgets/elastocaloric.js
{
  "data_url": "../widgets/data/niti_superelastic.bin",
  "meta_url": "../widgets/data/niti_superelastic.json"
}
:::

The badge reports the figure of merit COP = Q / ΔW and the transformation strain ε_tr. Use the **plot** menu to change the right-panel quantity, **color** to switch atom coloring, and **polyhedra** to outline coordination cells. Drag to tilt, scroll to zoom.

The austenite and martensite endpoints are MACE-MP0 relaxed structures; the reversible loop follows the standard superelastic model. The latent heat is the MACE-MP0 energy difference of the relaxed phases (about 35 meV/atom), which overestimates the measured value by roughly threefold. The adiabatic temperature change scales with the latent heat, so the temperature curve is an upper bound; the measured NiTi value is about 25 K. The COP (a ratio) is less sensitive to this and falls near the measured NiTi value of about 12.
