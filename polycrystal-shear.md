# Polycrystal elastocaloric shear cycle

This is the same thirty-six-grain polycrystal as the [strain cycle](polycrystal.md), loaded in pure shear instead of tension. Under shear the favorable product is not a single martensite variant but a **twin**: alternating lamellae of two shear-related variants whose average accommodates the imposed shear at low energy. Press play and watch each grain fill with fine twin bands as it transforms, then detwin and revert on unloading.

:::{anywidget} ./widgets/elastocaloric.js
{
  "data_url": "../widgets/data/niti_polycrystal_shear.bin",
  "meta_url": "../widgets/data/niti_polycrystal_shear.json",
  "layout": "wide",
  "poly_default": false
}
:::

Atoms are colored by the signed twin variant (blue and orange), pale where the lattice is still austenite. The plot shows the aggregate shear stress against shear strain; switch it to temperature or heat flow to see the elastocaloric response. The latent heat is released grain by grain exactly as in the tensile cycle, so the adiabatic temperature change is the same. What differs is the microstructure: shear is carried by twinning, the mechanism that lets martensite change shape while keeping its interfaces coherent, and detwinning under load is the main source of the recoverable strain.

The grain boundaries are MACE-MP0 relaxed (shared with the [strain cycle](polycrystal.md)); the twin lamellae and the grain-by-grain transformation are the same constructed mean-field model, with each grain's threshold shear stress following the Clausius-Clapeyron scaling τ ≈ Q/γ_tr.
