# Texture and the figure of merit

The [orientation map](orientation.md) showed that the recoverable strain depends strongly on the loading direction, and the [polycrystal cycle](polycrystal.md) showed how a spread of grain orientations rounds off the transformation. Put together, they give the central design lever for elastocaloric NiTi: **texture**, the degree to which the grains are aligned.

The three cases below are polycrystals with the same grains but different texture. Hover a curve to identify it; switch the plotted quantity to compare temperature and heat.

:::{anywidget} ./widgets/compare.js
{ "index_url": "../widgets/data/compare_texture_index.json" }
:::

What the comparison shows:

- A **⟨001⟩ texture** transforms at high stress over a small strain, so its hysteresis loop is small: the **highest COP** (most efficient), but the smallest stroke.
- A **⟨111⟩ texture** gives the **largest stroke** at low stress, but the wider loop dissipates more work per cycle, so the COP is lower.
- A **random texture** sits in between, with a rounded loop spanning the full range of grain behavior.

Crucially, the **adiabatic temperature change ΔT_ad is the same (~137 K) for every texture**, because it is set by the latent heat, which is a property of the phase transformation, not the orientation. Texture trades stroke against efficiency without changing the intrinsic cooling power. This is why real elastocaloric NiTi is processed to a deliberate texture: a sharp ⟨001⟩-type texture maximizes the coefficient of performance.

This is a constructed mean-field model grounded in the MACE-MP0 [transformation strains](orientation.md) and the canonical latent heat; absolute stress and COP values are demo-scale.
