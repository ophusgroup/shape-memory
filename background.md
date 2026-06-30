# Background: the martensitic transformation

## Two phases, one alloy

Near-equiatomic NiTi exists in two crystal structures that interconvert without diffusion:

- **Austenite (B2):** the high-temperature, high-symmetry phase. It is the CsCl structure, a simple cubic arrangement with Ni at the cube corners and Ti at the body center (or vice versa), lattice constant near 3.0 Angstrom.
- **Martensite (B19'):** the low-temperature phase. It is monoclinic, formed from B2 by a coordinated shear plus internal shuffle of the atoms. Its monoclinic angle is close to 97 degrees.

The transformation is **displacive**: atoms move less than one bond length and keep their neighbors, so it is fast and reversible. Because martensite has lower symmetry, it forms in several crystallographically equivalent **variants**, which usually arrange themselves as fine **twins** to minimize the overall shape change.

## Shape memory and superelasticity

Two behaviors follow from this transformation:

- **Shape-memory effect:** deform martensite at low temperature and it stays deformed; heat it above the austenite finish temperature and it snaps back to the remembered austenite shape.
- **Superelasticity (pseudoelasticity):** above the austenite finish temperature, applying stress drives a forward transformation to martensite, and removing the stress drives it back. The material recovers strains of several percent, far beyond ordinary elastic limits, tracing a stress-strain hysteresis loop.

The area enclosed by that loop is energy dissipated as heat during each cycle.

## The elastocaloric effect

The forward transformation (austenite to martensite) is **exothermic**: it releases latent heat. The reverse transformation absorbs it. In an adiabatic cycle this shows up as a temperature change of the material itself:

- Load it quickly and it **warms** as martensite forms.
- Unload it quickly and it **cools** as austenite returns.

This is the basis for solid-state elastocaloric cooling, a refrigeration approach with no greenhouse-gas refrigerants. The figure of merit is the adiabatic temperature change per cycle and the efficiency, both of which depend on the latent heat, the transformation hysteresis, and the microstructure.

## Why simulate it atomistically

The transformation pathway, the latent heat, and the way microstructure (single crystal versus twinned versus polycrystalline) controls nucleation are all set at the atomic scale. A machine-learning interatomic potential such as MACE-MP0 reproduces the near-degenerate energetics of the B2 and B19' phases well enough to watch the transformation directly, which is what the [demos](demos.md) do.

:::{seealso}
A general overview of shape-memory alloys: C. Naresh, P. S. C. Bose, C. S. P. Rao, *Shape memory alloys: a state of art review*, IOP Conf. Ser. Mater. Sci. Eng. 149, 012054 (2016), doi.org/10.1088/1757-899X/149/1/012054.
:::
