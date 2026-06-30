"""Plot the AQS loop curves from an exported widget json. For quick inspection.

Usage: python scripts/plot_loop.py niti_5050
"""

import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

name = sys.argv[1] if len(sys.argv) > 1 else "niti_5050"
ROOT = Path(__file__).resolve().parent.parent
meta = json.loads((ROOT / "public" / "widgets" / "data" / f"{name}.json").read_text())
c = meta["curves"]
strain = [100 * s for s in c["strain"]]  # percent

fig, ax = plt.subplots(1, 3, figsize=(13, 4))
ax[0].plot(strain, c["stress_gpa"], "-o", ms=3, color="#c00")
ax[0].set_xlabel("strain (%)"); ax[0].set_ylabel("axial stress (GPa)")
ax[0].set_title("stress-strain loop")

ax[1].plot(strain, c["energy_per_atom"], "-o", ms=3, color="#06c")
ax[1].set_xlabel("strain (%)"); ax[1].set_ylabel("energy (eV/atom)")
ax[1].set_title("energy")

ax[2].plot(strain, c["heat_flow_ev"], "-o", ms=3, color="#0a8", label="heat flow / step")
ax[2].plot(strain, c["cum_heat_ev"], "-s", ms=3, color="#a0a", label="cumulative heat")
ax[2].set_xlabel("strain (%)"); ax[2].set_ylabel("heat (eV)")
ax[2].set_title("heat flow"); ax[2].legend(fontsize=8)

for a in ax:
    a.grid(alpha=0.3)
fig.suptitle(f"{name}: {meta['meta']['n_atoms']} atoms, "
             f"{meta['n_frames']} frames, loop area "
             f"{meta['meta']['loop_area_ev']*1000/meta['meta']['n_atoms']:.1f} meV/atom")
fig.tight_layout()
out = ROOT / "scripts" / f"{name}_loop.png"
fig.savefig(out, dpi=110)
print(f"wrote {out}")
