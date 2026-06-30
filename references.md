# References and methods notes

## Key references

- C. Naresh, P. S. C. Bose, C. S. P. Rao. *Shape memory alloys: a state of art review.* IOP Conf. Ser. Mater. Sci. Eng. 149, 012054 (2016). doi.org/10.1088/1757-899X/149/1/012054
- J. Chen, L. Lei, G. Fang. *Elastocaloric cooling of shape memory alloys: A review.* Materials Today Communications 28, 102706 (2021). doi.org/10.1016/j.mtcomm.2021.102706 (source of the COP = Q/ΔW figure of merit and the ΔT_ad relation)
- F. La Rosa, F. Maresca. *Atomistic simulations of structure and motion of twin interfaces reveal the origin of twinning in NiTi shape memory alloys.* Communications Materials 5, 142 (2024). doi.org/10.1038/s43246-024-00587-0
- Y. Zhang, S. Jiang, et al. *Atomistic investigation on superelasticity of NiTi shape memory alloy with complex microstructures based on molecular dynamics simulation.* International Journal of Plasticity 125, 27 (2020). doi.org/10.1016/j.ijplas.2019.09.001

## Software

- **MACE-MP0** foundation interatomic potential (`medium-mpa-0`), used through the Atomic Simulation Environment (ASE) for all energy and force evaluations.
- **shapemem**, the Python package in this repository, builds the supercells, runs the loading cycles, and exports the widget data. Source: github.com/ophusgroup/shape-memory
- **MyST** with the book theme, with pure-JavaScript [anywidget](https://anywidget.dev) components, builds this site.

## How to reproduce

Each dataset has a script under `scripts/`:

| Script | Output |
|---|---|
| `m0_b2_vs_b19.py` | validates MACE on the B2 vs B19' energy ordering |
| `m1_run_loop.py` | small single-crystal athermal loading cycle |
| `m6_hero2d.py` | large pseudo-2D athermal cycle (the one-way shape-memory demo) |
| `m7_superelastic.py` | reversible superelastic cycle (the landing-page demo) |
| `m8_doping.py` | per-composition superelastic loops and the comparison index |
| `m5_md.py` | finite-temperature molecular-dynamics loop (HPC scale) |

## Scope

These are deliberately small cells for teaching and fast in-browser visualization. The physics is computed with MACE-MP0, but cell sizes, strain rates, and stress magnitudes are demo-scale. Quantitative, full-scale simulations (larger cells, finite-temperature MD, realistic strain rates, twinned and polycrystalline microstructures) are run separately on HPC.
