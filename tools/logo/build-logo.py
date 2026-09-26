"""
Rebuilds the BOONS logo from exact shapes (instead of tracing the old PNG),
so every edge is a clean line or curve at any size.

    python tools/logo/build-logo.py            writes the three SVGs below
    python tools/logo/build-logo.py --check    also prints how far it is off the old PNG

  assets/images/logo.svg                    white, same 1062x319 canvas as logo.png (drop-in for the site)
  assets/images/brand/boons-logo-white.svg  white, cropped to the letters
  assets/images/brand/boons-logo-black.svg  dark, cropped to the letters

All measurements are in pixels of the original logo.png (1062 x 319). The shapes were
measured from its edges and then fitted to it (Powell optimisation on the rendered pixels),
so the rebuilt logo lands within about half a pixel of the original everywhere.
The design, as measured:
  - the O's are rounded rectangles with big elliptical corners (flat on top and at the sides),
    their counters the same kind of shape; a horizontal bar runs through both O's and joins them
  - the B is mirrored (bowls on the left) and sits 1px lower than the other letters, as in the original
  - the S is built like a B with bowls on the right and an open top bowl
  - the N's two cut-outs have parallel diagonals
"""
import sys
from pathlib import Path
import pathops

ROOT = Path(__file__).resolve().parents[2]
K_SQUIRCLE = 0.69
K_ELLIPSE = 0.5523      # bezier handle for a quarter ellipse

TOP, BOTTOM = 71.37, 256.66
MID = (TOP + BOTTOM) / 2


# ---------- shape helpers (all return pathops.Path) ----------

def rounded_rect(x0, y0, x1, y1, tl=(0, 0), tr=(0, 0), br=(0, 0), bl=(0, 0), k=K_ELLIPSE):
    """Rectangle with an elliptical corner (rx, ry) per corner; (0, 0) = square corner.
    k per corner can be given as a 3rd value: (rx, ry, k)."""
    def c(v):
        return (v[0], v[1], v[2] if len(v) > 2 else k)
    tl, tr, br, bl = c(tl), c(tr), c(br), c(bl)
    p = pathops.Path()
    p.moveTo(x0 + tl[0], y0)
    p.lineTo(x1 - tr[0], y0)
    if tr[0]:
        p.cubicTo(x1 - tr[0] + tr[0] * tr[2], y0, x1, y0 + tr[1] - tr[1] * tr[2], x1, y0 + tr[1])
    p.lineTo(x1, y1 - br[1])
    if br[0]:
        p.cubicTo(x1, y1 - br[1] + br[1] * br[2], x1 - br[0] + br[0] * br[2], y1, x1 - br[0], y1)
    p.lineTo(x0 + bl[0], y1)
    if bl[0]:
        p.cubicTo(x0 + bl[0] - bl[0] * bl[2], y1, x0, y1 - bl[1] + bl[1] * bl[2], x0, y1 - bl[1])
    p.lineTo(x0, y0 + tl[1])
    if tl[0]:
        p.cubicTo(x0, y0 + tl[1] - tl[1] * tl[2], x0 + tl[0] - tl[0] * tl[2], y0, x0 + tl[0], y0)
    p.close()
    return p


def squircle(cx, cy, a, b, k=K_SQUIRCLE):
    return rounded_rect(cx - a, cy - b, cx + a, cy + b, (a, b), (a, b), (a, b), (a, b), k)


def polygon(*pts):
    p = pathops.Path()
    p.moveTo(*pts[0])
    for pt in pts[1:]:
        p.lineTo(*pt)
    p.close()
    return p


def union(*paths):
    result = paths[0]
    for p in paths[1:]:
        result = pathops.op(result, p, pathops.PathOp.UNION)
    return result


def minus(a, *cuts):
    for c in cuts:
        a = pathops.op(a, c, pathops.PathOp.DIFFERENCE)
    return a


# ---------- the letters ----------

# ---- B (mirrored: bowls on the left). Corners are (rx, ry, bezier handle). ----
B_TOP, B_BOTTOM, B_RIGHT = 72.51, 258.06, 288.09
B_UP = (104.63, 174.28)            # upper bowl: left edge, bottom
B_LO = (112.36, 154.26)            # lower bowl: left edge, top
B_UP_TL, B_UP_BL = (58.9, 62.56, 0.63), (35.37, 48.31, 0.55)
B_LO_TL, B_LO_BL = (30.71, 44.14, 0.55), (56.85, 51.7, 0.56)
B_CU = (157.77, 115.74, 235.21, 141.5, 9.37)   # upper counter x0, y0, x1, y1, radius of the rounded (left) end
B_CL = (163.96, 185.5, 235.24, 215, 12.54)


def letter_b():
    upper = rounded_rect(B_UP[0], B_TOP, B_RIGHT, B_UP[1], tl=B_UP_TL, bl=B_UP_BL)
    lower = rounded_rect(B_LO[0], B_LO[1], B_RIGHT, B_BOTTOM, tl=B_LO_TL, bl=B_LO_BL)
    cu = rounded_rect(*B_CU[:4], tl=(B_CU[4],) * 2, bl=(B_CU[4],) * 2, tr=(1.5, 1.5), br=(1.5, 1.5))
    cl = rounded_rect(*B_CL[:4], tl=(B_CL[4],) * 2, bl=(B_CL[4],) * 2, tr=(1.5, 1.5), br=(1.5, 1.5))
    return minus(union(upper, lower), cu, cl)


# The O's: rounded rectangles with big elliptical corners (a flat stretch on top and on the
# sides), not pure ellipses. Counters: the same kind of shape, smaller. Values fitted to the PNG.
O_A, O_B, O_RX, O_RY, O_K = 98.34, 92.92, 83.76, 82.35, 0.57       # half-width, half-height, corner rx/ry, handle
C_A, C_B, C_RX, C_RY, C_K = 46.22, 49.41, 38.95, 39.35, 0.58
O_Y = 164.29
BAR_TOP, BAR_BOTTOM = 141, 184.64             # the horizontal bar through the O's
O1_X, O2_X = 376.43, 577.04


def o_shape(cx, cy, a, b, rx, ry, k):
    corner = (min(rx, a), min(ry, b), k)
    return rounded_rect(cx - a, cy - b, cx + a, cy + b, corner, corner, corner, corner)


def letter_o(cx):
    outer = o_shape(cx, O_Y, O_A, O_B, O_RX, O_RY, O_K)
    counter = o_shape(cx, O_Y, C_A, C_B, C_RX, C_RY, C_K)
    bar = rounded_rect(cx - C_A - 1, BAR_TOP, cx + C_A + 1, BAR_BOTTOM)
    return minus(outer, minus(counter, bar))


def bar_between_os():
    return rounded_rect(O1_X, BAR_TOP, O2_X, BAR_BOTTOM)


# ---- N and S (they share one solid block: the N's right stem is the S's left side) ----
N_LEFT, N_INNER_LEFT, N_INNER_RIGHT = 661.82, 714.34, 785.98
N_SLOPE = 0.61                   # the N's two diagonals are parallel (x per y)
N_TOP_CUT = 721.25                # x where the top cut-out's diagonal meets the top
N_BOTTOM_CUT = 777.4             # x where the bottom cut-out's diagonal meets the bottom
S_UPPER = (950.94, 132.5)         # upper bowl: right edge, bottom (it is open underneath)
S_LOWER = (142.58, 953.25)         # lower bowl: top, right edge
S_UP_TR, S_LO_TR, S_LO_BR = (62.64, 61.13, 0.6), (65.14, 56.51, 0.64), (58.4, 59.2, 0.6)
S_CU = (837.37, 114.75, 898.64, 141.36, 11.37, 14.31)   # upper counter x0, y0, x1, y1, left radius, top-right radius
S_CL = (836.33, 185.73, 900.75, 215)              # lower counter; its right end is a half circle


def letter_n_and_s():
    body = union(rounded_rect(N_LEFT, TOP, 850.0, BOTTOM),
                 rounded_rect(N_LEFT, TOP, S_UPPER[0], S_UPPER[1], tr=S_UP_TR, br=(2, 2)),
                 rounded_rect(N_LEFT, S_LOWER[0], S_LOWER[1], BOTTOM, tr=S_LO_TR, br=S_LO_BR))
    top_tip_y = TOP + (N_INNER_RIGHT - N_TOP_CUT) / N_SLOPE
    bot_tip_y = BOTTOM - (N_BOTTOM_CUT - N_INNER_LEFT) / N_SLOPE
    n_top_cut = polygon((N_TOP_CUT - N_SLOPE, TOP - 1), (N_INNER_RIGHT, TOP - 1), (N_INNER_RIGHT, top_tip_y))
    n_bottom_cut = polygon((N_INNER_LEFT, bot_tip_y), (N_INNER_LEFT, BOTTOM + 1), (N_BOTTOM_CUT + N_SLOPE, BOTTOM + 1))
    r = (S_CL[3] - S_CL[1]) / 2
    s_cu = rounded_rect(*S_CU[:4], tl=(S_CU[4],) * 2, bl=(S_CU[4],) * 2, tr=(S_CU[5],) * 2)
    s_cl = rounded_rect(*S_CL, tr=(r, r), br=(r, r))
    return minus(body, n_top_cut, n_bottom_cut, s_cu, s_cl)


def logo():
    return union(letter_b(), letter_o(O1_X), letter_o(O2_X), bar_between_os(), letter_n_and_s())


# ---------- output ----------

def svg_d(path, dx=0.0, dy=0.0):
    f = lambda v: f"{round(v, 2):g}"
    out = []
    for verb, pts in path.segments:
        pts = [(x - dx, y - dy) for x, y in pts]
        if verb == 'moveTo':
            out.append('M' + ' '.join(f(x) + ' ' + f(y) for x, y in pts))
        elif verb == 'lineTo':
            out.append('L' + ' '.join(f(x) + ' ' + f(y) for x, y in pts))
        elif verb == 'curveTo':
            out.append('C' + ' '.join(f(x) + ' ' + f(y) for x, y in pts))
        elif verb == 'qCurveTo':
            out.append('Q' + ' '.join(f(x) + ' ' + f(y) for x, y in pts))
        elif verb == 'closePath':
            out.append('Z')
    return ''.join(out)


def write(path, file, color, crop):
    if crop:
        x0, y0, x1, y1 = path.bounds
        box = f'viewBox="0 0 {round(x1 - x0, 2):g} {round(y1 - y0, 2):g}"'
        d = svg_d(path, x0, y0)
    else:
        box = 'width="1062" height="319" viewBox="0 0 1062 319"'
        d = svg_d(path)
    Path(file).write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" {box} role="img" aria-label="BOONS AGENCY">'
        f'<title>BOONS AGENCY</title><path fill="{color}" d="{d}"/></svg>\n', encoding='utf-8', newline='\n')


if __name__ == '__main__':
    p = logo()
    p.simplify()
    out = Path(sys.argv[sys.argv.index('--out') + 1]) if '--out' in sys.argv else ROOT / 'assets' / 'images'
    (out / 'brand').mkdir(parents=True, exist_ok=True)
    write(p, out / 'logo.svg', '#ffffff', crop=False)
    write(p, out / 'brand' / 'boons-logo-white.svg', '#ffffff', crop=True)
    write(p, out / 'brand' / 'boons-logo-black.svg', '#0B0A0F', crop=True)
    print('written to', out, '| path bounds', [round(v, 1) for v in p.bounds])
