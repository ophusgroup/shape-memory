# The elastocaloric effect

The transformation that gives NiTi its shape memory also makes it a candidate solid-state refrigerant.

## Latent heat

The forward transformation, austenite to martensite, is exothermic and releases latent heat; the reverse transformation absorbs it. Under adiabatic loading, where the heat has no time to escape, this changes the temperature of the material:

- On loading, martensite forms, latent heat is released, and the material warms.
- On unloading, austenite returns, latent heat is absorbed, and the material cools.

The cooling on unloading is the elastocaloric effect. Cycling the stress while exchanging heat at the hot and cold ends gives refrigeration with no compressor and no greenhouse-gas refrigerant.

## Figure of merit

Two quantities characterize an elastocaloric material:

- The adiabatic temperature change ΔT_ad per cycle, equal to the latent heat divided by the heat capacity. For NiTi this reaches tens of kelvin.
- The coefficient of performance COP = Q / ΔW, the latent heat divided by the stress-strain hysteresis loop area. A narrow hysteresis loop gives a higher COP.

## What we compute

For each loading cycle we record the per-step heat flow and a derived adiabatic temperature change (see [methods](methods.md)). The [loading-cycle demo](demos.md) plots both; the temperature rises at the transformation as the latent heat is released.
