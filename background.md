# The martensitic transformation

Near-equiatomic NiTi exists in two crystal structures that interconvert without diffusion:

- **Austenite (B2):** the high-temperature, high-symmetry phase. It is the CsCl structure, a simple cubic arrangement with Ni at the cube corners and Ti at the body center, with a lattice constant near 3.0 Å.
- **Martensite (B19'):** the low-temperature phase. It is monoclinic, formed from B2 by a coordinated shear plus an internal shuffle of the atoms, with a monoclinic angle near 98°.

The transformation is displacive: atoms move less than one bond length and keep their neighbors, so it is fast and reversible. Because martensite has lower symmetry, it forms in several crystallographically equivalent variants, which arrange themselves as fine twins to minimize the overall shape change.

## Shape memory and superelasticity

- **Shape-memory effect:** martensite deformed below the transformation temperature stays deformed; heating above the austenite-finish temperature recovers the original austenite shape.
- **Superelasticity:** above the austenite-finish temperature, applied stress drives the forward transformation to martensite and removing it drives the reverse, recovering strains of several percent and tracing a stress-strain hysteresis loop.

The area enclosed by the loop is energy dissipated as heat per cycle, and the latent heat exchanged during the transformation is the basis of the [elastocaloric effect](elastocaloric.md).

## Atomistic simulation

The transformation pathway, the latent heat, and the way microstructure controls nucleation are all set at the atomic scale. MACE-MP0 reproduces the energetics of the B2 and B19' phases well enough to follow the transformation directly, which is what the [loading cycle](demos.md) shows.
