# Polycrystal elastocaloric cycle

Real Nitinol is a polycrystal: many grains, each with its own crystallographic orientation. Because the recoverable strain depends strongly on the [loading direction](orientation.md), the grains do not transform together. Under a rising tensile stress the favorably oriented grains (large transformation strain, low threshold stress) go first, and the poorly oriented ones follow at higher stress.

This pseudo-2D cell has nine grains tiled by a periodic Voronoi tessellation, each a B2 lattice at its own in-plane rotation, so the grains meet at real grain boundaries with a range of misorientations. The boundaries are relaxed with MACE-MP0 before the cycle. Press play and watch the transformation sweep across the microstructure grain by grain (red austenite to cyan martensite), then reverse on unloading.

:::{anywidget} ./widgets/elastocaloric.js
{
  "data_url": "../widgets/data/niti_polycrystal.bin",
  "meta_url": "../widgets/data/niti_polycrystal.json"
}
:::

The consequences for elastocaloric cooling:

- The aggregate **stress-strain curve** is a rounded, spread-out superelastic loop, not the single sharp plateau of a single crystal. The spread comes directly from the orientation distribution of the grains.
- The **latent heat** is released grain by grain on loading and reabsorbed on unloading, so the temperature change builds up gradually rather than in one jump. Plot the **temperature** or **heat flow** to see this.
- The loop area (hysteresis) sets the work that must be supplied each cycle, and therefore the COP. A sharper texture (grains aligned to a favorable direction) gives a narrower loop and better efficiency, which is why texture control matters in real elastocaloric NiTi.

This is a constructed mean-field model: the grain boundaries are MACE-MP0 relaxed, the spread of grain transformation strains spans the range from the MACE-MP0 [stereographic map](orientation.md), the latent heat is the canonical MACE value, and each grain's threshold stress follows the Clausius-Clapeyron scaling σ ≈ Q/ε_tr with a fixed transformation hysteresis. The [landing page](index.md) shows a larger 36-grain version.
