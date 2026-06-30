# Observables

## Order parameter

Each atom is colored by a local atomic shear strain (a Falk-Langer measure). For every atom we fit the deformation gradient that best maps its austenite-reference neighbor vectors onto the current frame, then take the von Mises shear of the resulting strain tensor. This is near zero in cubic austenite and grows where the lattice has sheared into martensite, driving the red-to-cyan colormap. It is closely related to the polyhedral-template-matching phase labels used in larger molecular-dynamics studies.

## Heat flow

At each step the released heat is the mechanical work put in minus the change in stored potential energy,

$$ \mathrm{d}Q = \mathrm{d}W - \mathrm{d}U, \qquad \mathrm{d}W = \langle\sigma\rangle\, \mathrm{d}\varepsilon\, V. $$

The latent heat appears as a sharp feature at the transformation.

## Adiabatic temperature change

Under adiabatic conditions the released heat raises the lattice temperature against its heat capacity,

$$ \Delta T_\mathrm{ad}(\varepsilon) = \frac{Q(\varepsilon)}{N\, c_v}, \qquad c_v = 3 k_B \ \text{(Dulong-Petit, per atom)}. $$

The widgets plot this as the temperature curve. Finite-temperature MD gives a heat capacity of about 2.8 k_B/atom (close to the Dulong-Petit value of 3 k_B). With the MACE-MP0 latent heat of about 35 meV/atom this gives ΔT_ad ≈ 130 K, but because MACE-MP0 overestimates the latent heat by roughly threefold, the measured NiTi value is about 25 K. The curve is therefore an upper bound; the COP, being a ratio, is more reliable.

## Figure of merit

The elastocaloric coefficient of performance is

$$ \mathrm{COP} = \frac{Q}{\Delta W}, $$

the latent heat divided by the stress-strain hysteresis loop area. Higher is better; the measured value for NiTi is about 12.
