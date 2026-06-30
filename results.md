# Composition and alloying

The elastocaloric performance of NiTi depends on composition. Substituting elements onto the Ni or Ti sublattice changes the latent heat, the transformation strain, and the transformation stress, and therefore the figure of merit. Each composition below is run as its own reversible [superelastic cycle](demos.md): austenite and martensite endpoints are relaxed with MACE-MP0, so the latent heat (from the MACE energy difference) and the transformation strain are computed consistently and the results are directly comparable.

:::{anywidget} ./widgets/compare.js
{
  "index_url": "../widgets/data/compare_index.json"
}
:::

**How to read this.** Hover any curve to identify its composition. The **curve** menu switches between the stress-strain loop, the temperature, the cumulative heat, and the energy. The table on the right reports, for each composition:

- **σ_pk**, the peak transformation stress,
- **ΔT_ad**, the adiabatic temperature change (latent heat divided by the Dulong-Petit heat capacity),
- **COP = Q / ΔW**, the elastocaloric figure of merit: latent heat divided by the stress-strain hysteresis loop area. Higher is better. The reference NiTi value is about 12.

The compositions shown are equiatomic NiTi, two Cu-doped cells (5.6 and 11.1 at% Cu on the Ni sublattice), one Hf-doped cell (5.6 at% Hf on the Ti sublattice), and a Ni-rich cell (Ni₅₆Ti₄₄). Each is a 72-atom cell with the substitutions placed at random on the chosen sublattice.

:::{caution}
This panel demonstrates the **workflow**, not validated alloying trends. Each composition is a single 72-atom cell with one martensite variant and randomly placed dopants, so the per-element numbers are noisy and can even get the sign wrong: real Hf, for example, *stabilizes* martensite and raises the transformation temperature, which a small cell with a single variant will not reliably capture. The latent heat is also overestimated by MACE-MP0, so ΔT_ad is an upper bound. The robust result here is the equiatomic reference (COP ≈ 12, matching experiment). Quantitative alloying predictions require large cells, multiple variants, and statistical averaging, which are run on HPC.
:::
