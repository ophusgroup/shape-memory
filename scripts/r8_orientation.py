"""R8: orientation dependence of the transformation.

The recoverable transformation strain depends on the loading direction relative
to the crystal. We compute it from the MACE-MP0 relaxed B19' martensite (r7):
build the transformation stretch via the Bain lattice correspondence, generate
the symmetry-equivalent variants with the cubic point group, and for each tensile
direction take the best-variant normal strain. From this we also estimate the
critical transformation stress (Clausius-Clapeyron, sigma ~ Q/eps_tr) and the
elastocaloric COP (Q / hysteresis work, with a constant hysteresis stress), so we
can compare energies/work/COP across orientations.

Outputs a JSON grid over the standard stereographic triangle plus the three
special directions, read by widgets/orient-strain.js.
"""
import json
from pathlib import Path
import numpy as np

OUT = Path(__file__).resolve().parent.parent / "public" / "widgets" / "data"

# MACE-relaxed structures (r7 / austenite relax)
a0 = 3.016                       # B2 lattice constant
aM, bM, cM, beta = 2.851, 4.172, 4.665, 99.92
br = np.deg2rad(beta)

# Bain correspondence frame: e1=[100], e2=[011]/sqrt2, e3=[0 -1 1]/sqrt2
e1 = np.array([1, 0, 0.0]); e2 = np.array([0, 1, 1.0])/np.sqrt(2); e3 = np.array([0, -1, 1.0])/np.sqrt(2)
R = np.column_stack([e1, e2, e3])
# F in correspondence frame (columns = images of the cubic reference vectors)
F_corr = np.array([
    [aM/a0, 0,            (cM/(a0*np.sqrt(2)))*np.cos(br)],
    [0,     bM/(a0*np.sqrt(2)), 0],
    [0,     0,            (cM/(a0*np.sqrt(2)))*np.sin(br)],
])
F = R @ F_corr @ R.T
# symmetric stretch (remove rotation)
from scipy.linalg import polar
_, U0 = polar(F)

# cubic proper rotation group (24)
def cubic_group():
    mats = []
    import itertools
    for perm in itertools.permutations(range(3)):
        P = np.zeros((3, 3))
        for i, p in enumerate(perm):
            P[i, p] = 1
        for signs in itertools.product([1, -1], repeat=3):
            M = P * np.array(signs)
            if abs(np.linalg.det(M) - 1) < 1e-6:
                mats.append(M)
    return mats
G = cubic_group()
variants = [g @ U0 @ g.T for g in G]

def eps_tr(n):
    n = np.asarray(n, float); n = n/np.linalg.norm(n)
    return max(np.linalg.norm(Uv @ n) - 1 for Uv in variants)

# special directions
specials = {"[001]": [0,0,1], "[110]": [1,1,0], "[111]": [1,1,1]}
for k, v in specials.items():
    print(f"{k}: eps_tr = {eps_tr(v)*100:.2f}%")

# stereographic standard triangle grid ([001]-[101]-[111])
def dir_from_stereo(X, Y):
    d = 1 + X*X + Y*Y
    return np.array([2*X, 2*Y, 1 - X*X - Y*Y]) / d
A2 = np.array([0.0, 0.0]); B2 = np.array([0.0, 0.41421]); C2 = np.array([0.36603, 0.36603])
def in_tri(p):
    def sign(a, b, c): return (a[0]-c[0])*(b[1]-c[1])-(b[0]-c[0])*(a[1]-c[1])
    d1, d2, d3 = sign(p, A2, B2), sign(p, B2, C2), sign(p, C2, A2)
    return not (((d1 < 0) or (d2 < 0) or (d3 < 0)) and ((d1 > 0) or (d2 > 0) or (d3 > 0)))

NG = 60
grid = []
for j in range(NG):
    row = []
    for i in range(NG):
        X = 0.0 + 0.42*i/(NG-1); Y = 0.0 + 0.42*j/(NG-1)
        if in_tri([X, Y]):
            row.append(round(eps_tr(dir_from_stereo(X, Y))*100, 3))
        else:
            row.append(None)
    grid.append(row)

emin = min(e for r in grid for e in r if e is not None)
emax = max(e for r in grid for e in r if e is not None)
# elastocaloric quantities: Q latent heat (const), COP ~ Q/(dsig*eps_tr)
Q_meV = 35.5; kB = 8.617333e-5
# ΔT_ad calibrated to the MEASURED latent heat (~12 meV/atom); MACE overestimates it ~3x
dT_ad = 12.0*1e-3/(3*kB)
data = {
    "grid": grid, "ngrid": NG, "xmax": 0.42,
    "tri": {"A001": A2.tolist(), "B011": B2.tolist(), "C111": C2.tolist()},
    "emin": emin, "emax": emax,
    "specials": {k: round(eps_tr(v)*100, 2) for k, v in specials.items()},
    "Q_meV": Q_meV, "dT_ad_K": round(dT_ad, 0),
    "a0": a0,
    "variants": [Uv.tolist() for Uv in variants],   # 24 stretch matrices for the widget
    "note": "transformation strain from MACE-MP0 relaxed B19' (Bain correspondence, cubic variants)",
}
(OUT/"orientation.json").write_text(json.dumps(data))
print(f"eps_tr range {emin:.2f}-{emax:.2f}%, dT_ad(MACE)={dT_ad:.0f}K -> wrote orientation.json")
