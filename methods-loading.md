# Loading protocols

The site uses two complementary protocols, because the two regimes of NiTi behavior are physically distinct.

## Athermal quasi-static (shape-memory)

This is a direct MACE-MP0 simulation, with no model assumptions:

1. Impose an axial strain in small increments, ramping from zero up to the maximum and back to zero.
2. At each increment, relax the atomic coordinates and the transverse and shear cell components with MACE-MP0, holding only the imposed axial strain fixed.
3. Carry the relaxed structure forward to the next increment.

At zero temperature MACE-MP0 places martensite below austenite, so the cell shears into martensite on loading and stays there on unloading. The stress-strain curve is an open loop, which is the correct one-way shape-memory response. This protocol produces the [shape-memory demo](demos.md).

## Superelastic cycle (above A_f)

A closed, reversible superelastic loop is only physical above the austenite-finish temperature, where entropy restabilizes austenite at zero stress. Reaching that regime with this potential requires finite-temperature dynamics at a scale beyond a browser demo, so the reversible loop is built from MACE-MP0 endpoints plus a standard superelastic model:

- The austenite and martensite endpoints are relaxed with MACE-MP0 (real structures, real energy difference, real transformation strain).
- The A→M deformation is reduced to its symmetric stretch (pure strain, no rigid rotation) by a polar decomposition.
- A standard superelastic stress-strain law drives the phase fraction through the cycle, with forward and reverse plateaus giving the hysteresis. The cell morphs reversibly between the two endpoints and returns exactly to austenite.

This produces the [elastocaloric loading-cycle demo](demos.md).
