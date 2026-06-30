# Orientation dependence

How much strain the transformation recovers depends on the loading direction relative to the crystal. The map below is the standard stereographic triangle of cubic loading axes, shaded by the recoverable transformation strain ε_tr. It is computed from the MACE-MP0 relaxed B19' martensite: the Bain lattice correspondence gives the transformation stretch, the cubic point group generates the twelve variants, and for each tensile direction the best variant is selected. Drag the marker; it snaps to a low-index loading axis, and the right panel shows the martensite variant that forms for that axis as a deformed B2 supercell.

:::{anywidget} ./widgets/orient-strain.js
{ "data_url": "../widgets/data/orientation.json" }
:::

Loading along ⟨001⟩ recovers the least strain (about 4%), and ⟨111⟩ the most (about 12%). This anisotropy matters for the elastocaloric application:

- The **latent heat** and therefore the **adiabatic temperature change** ΔT_ad are set by the phase energy difference and are essentially **orientation-independent**.
- The **critical transformation stress** scales roughly as 1/ε_tr (Clausius-Clapeyron): directions with small ε_tr need higher stress to transform.
- The **figure of merit** COP = Q/ΔW depends on the hysteresis work ΔW, which grows with ε_tr. So ⟨001⟩ tends to be the most efficient (highest COP, smallest stroke), while ⟨111⟩ gives the largest recoverable stroke at lower efficiency.

This is the trade-off a device designer balances through texture and grain orientation. The strains here are computed directly from the relaxed structures; the stress and COP relations are the standard thermodynamic estimates.
