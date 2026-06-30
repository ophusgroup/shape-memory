"""Export a LoopResult to the widget data format: a flat .bin + a .json sidecar.

Layout mirrors em-template-lite (binary blob + metadata json). The .bin holds
the two large float32 arrays back to back:
    [0]                positions  (n_frames * n_atoms * 3)
    [after positions]  op         (n_frames * n_atoms)
Everything small (per-frame cells, the 1-D curves, element numbers) lives in
the json so the widget can set up axes before fetching the blob.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from .aqs import LoopResult


def export(result: LoopResult, out_dir: str | Path, name: str) -> tuple[Path, Path]:
    # data is served from public/widgets/data so MyST copies it to the site
    # root in both `myst start` (dev) and `myst build` (deploy).
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    bin_path = out_dir / f"{name}.bin"
    json_path = out_dir / f"{name}.json"

    nf, na = result.positions.shape[0], result.positions.shape[1]
    pos = result.positions.reshape(-1).astype("<f4")
    op = result.op.reshape(-1).astype("<f4")
    with open(bin_path, "wb") as f:
        f.write(pos.tobytes())
        f.write(op.tobytes())

    meta = {
        "name": name,
        "n_frames": int(nf),
        "n_atoms": int(na),
        "numbers": result.numbers.astype(int).tolist(),
        "cells": result.cells.astype(float).reshape(nf, 9).tolist(),
        "bin": {
            "dtype": "float32",
            "positions": {"offset": 0, "shape": [nf, na, 3]},
            "op": {"offset": nf * na * 3 * 4, "shape": [nf, na]},
        },
        "op_range": [float(result.op.min()), float(result.op.max())],
        "curves": {
            "strain": result.strain.tolist(),
            "stress_gpa": result.stress_gpa.tolist(),
            "energy_per_atom": result.energy_per_atom.tolist(),
            "heat_flow_ev": result.heat_flow_ev.tolist(),
            "cum_heat_ev": result.cum_heat_ev.tolist(),
            **({"temperature_k": result.temperature_k.tolist()}
               if result.temperature_k is not None else {}),
        },
        "meta": result.meta,
    }
    json_path.write_text(json.dumps(meta, indent=2))
    return bin_path, json_path
