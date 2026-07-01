# Elastocaloric loading cycle

A NiTi cell driven through one superelastic load/unload cycle. Above the austenite-finish temperature the transformation is reversible: stress drives austenite (red) into martensite (cyan) on loading and reverts on unloading, tracing a closed hysteresis loop. The right panel traces the stress, energy, heat flow, and temperature; the temperature rises as martensite forms and falls as it reverts.

:::{anywidget} ./widgets/elastocaloric.js
{
  "data_url": "../widgets/data/niti_superelastic.bin",
  "meta_url": "../widgets/data/niti_superelastic.json"
}
:::

The badge reports the figure of merit COP = Q / ΔW and the transformation strain ε_tr. Use the **plot** menu to change the right-panel quantity, **color** to switch atom coloring, and **polyhedra** to outline coordination cells. Drag to tilt, scroll to zoom.

The austenite and martensite endpoints are MACE-MP0 relaxed structures; the reversible loop follows the standard superelastic model. MACE-MP0 gives the latent heat as about 35 meV/atom, roughly threefold larger than the measured value, which would put the adiabatic temperature change near 140 K. The temperature curve is therefore calibrated to the measured NiTi latent heat (about 12 meV/atom), giving an adiabatic ΔT_ad of about 46 K. This is still an idealized upper bound (full transformation, no heat loss); real devices reach roughly 25 K. The COP (a ratio) uses the raw MACE energetics and falls near the measured NiTi value of about 12.
