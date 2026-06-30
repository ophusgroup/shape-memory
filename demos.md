# Elastocaloric loading cycle

A NiTi cell driven through one superelastic load/unload cycle. Above the austenite-finish temperature the transformation is reversible: stress drives austenite (red) into martensite (cyan) on loading and reverts on unloading, tracing a closed hysteresis loop. The right panel traces the stress, energy, heat flow, and temperature; the temperature rises as martensite forms and falls as it reverts.

:::{anywidget} ./widgets/elastocaloric.js
{
  "data_url": "../widgets/data/niti_superelastic.bin",
  "meta_url": "../widgets/data/niti_superelastic.json"
}
:::

The badge reports COP = Q / ΔW, the adiabatic temperature change ΔT_ad, and the transformation strain ε_tr. Use the **plot** menu to change the right-panel quantity, **color** to switch atom coloring, and **polyhedra** to outline coordination cells. Drag to tilt, scroll to zoom.

The austenite and martensite endpoints are MACE-MP0 relaxed structures and the latent heat is their energy difference; the reversible loop follows the standard superelastic model. MACE overestimates the latent heat by roughly a factor of two, so ΔT_ad is an upper bound, while COP (a ratio) is near the measured NiTi value of about 12.

## Shape-memory effect

Below the transformation temperature the same cell behaves differently. This loading cycle is computed athermally with MACE-MP0 on a 200-atom cell: the cell shears into martensite on loading and stays there on unloading, because at 0 K martensite is the lower-energy phase. The stress-strain curve is an open loop, the signature of the one-way shape-memory effect.

:::{anywidget} ./widgets/elastocaloric.js
{
  "data_url": "../widgets/data/niti_2d.bin",
  "meta_url": "../widgets/data/niti_2d.json"
}
:::
