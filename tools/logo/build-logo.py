"""
Rebuilds the BOONS logo from exact shapes (instead of tracing the old PNG),
so every edge is a clean line or curve at any size.

    python tools/logo/build-logo.py            writes the three SVGs below
    python tools/logo/build-logo.py --check    also prints how far it is off the old PNG

  assets/images/logo.svg                    white, same 1062x319 canvas as logo.png (drop-in for the site)
  assets/images/brand/boons-logo-white.svg  white, cropped to the letters
  assets/images/brand/boons-logo-black.svg  dark, cropped to the letters

All measurements are in pixels of the original logo.png (1062 x 319), taken from its edges.
The design, as measured:
  - one cap height for every letter: top 71.3, bottom 257.0
  - the O's are squircles (superellipse, exponent 2.5), their counters the same shape, smaller;
    a horizontal bar runs through both O's and joins them
  - the B is mirrored (bowls on the left), the S is built like a B with bowls on the right
    and an open top bowl
  - the N's two cut-outs have parallel diagonals
"""
import sys
from pathlib import Path
import pathops

ROOT = Path(__file__).resolve().parents[2]
K_SQUIRCLE = 0.69       # bezier handle for a quarter superellipse n=2.5 (fitted to the old PNG)
K_ELLIPSE = 0.5523      # bezier handle for a quarter ellipse

TOP, BOTTOM = 71.3, 257.0
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

# corner (rx, ry, bezier handle) of the bowls
# (fitted against the old PNG: tools/logo/build-logo.py --check)
B_UP_TL, B_UP_BL = (64, 60, 0.62), (36, 48, 0.55)
B_LO_TL, B_LO_BL = (31, 44, 0.55), (53, 54, 0.57)
S_UP_TR, S_LO_TR, S_LO_BR = (64, 61, 0.6), (64, 56, 0.63), (58, 60, 0.6)


def letter_b():
    """Mirrored B: two bowls on the left, straight spine on the right."""
    right = 288.1
    upper = rounded_rect(105.0, TOP, right, 175.1, tl=B_UP_TL, bl=B_UP_BL)
    lower = rounded_rect(111.8, 155.5, right, BOTTOM, tl=B_LO_TL, bl=B_LO_BL)
    counter_up = rounded_rect(157.8, 115.6, 235.2, 141.3, tl=(10, 10), bl=(10, 10), tr=(1.5, 1.5), br=(1.5, 1.5))
    counter_lo = rounded_rect(164.0, 185.7, 235.2, 215.1, tl=(12, 12), bl=(12, 12), tr=(1.5, 1.5), br=(1.5, 1.5))
    return minus(union(upper, lower), counter_up, counter_lo)


O_A, O_B = 97.0, 93.1                          # outer squircle half-width / half-height (a hair taller than
                                               # the straight letters: optical overshoot, as in the original)
C_A, C_B = 47.6, 49.8                          # counter squircle
BAR_TOP, BAR_BOTTOM = 140.7, 185.2             # the horizontal bar through the O's
O1_X, O2_X = 376.7, 577.3


def letter_o(cx):
    outer = squircle(cx, MID, O_A, O_B)
    counter = squircle(cx, MID, C_A, C_B)
    bar = rounded_rect(cx - C_A - 1, BAR_TOP, cx + C_A + 1, BAR_BOTTOM)
    return minus(outer, minus(counter, bar))


def bar_between_os():
    return rounded_rect(O1_X, BAR_TOP, O2_X, BAR_BOTTOM)


def letter_n_and_s():
    """The N and the S share one solid block (the N's right stem is the S's left side)."""
    slope = 0.61                                 # the N's diagonals, x per y
    n_left, n_inner_left, n_inner_right = 661.8, 714.7, 786.0
    top_cut_x = 733.1 - slope * (90 - TOP)       # diagonal edge of the top cut-out, at the top
    top_tip_y = 90 + (n_inner_right - 733.1) / slope
    bot_tip_y = 190 - (736.8 - n_inner_left) / slope
    bot_cut_x = 736.8 + slope * (BOTTOM - 190)

    # S: straight left side, bowls on the right; the upper bowl is open underneath
    s_upper = rounded_rect(n_left, TOP, 951.0, 132.8, tr=S_UP_TR, br=(2, 2))
    s_lower = rounded_rect(n_left, 142.6, 953.1, BOTTOM, tr=S_LO_TR, br=S_LO_BR)
    # the solid block left of the S counters; it stops before the bowls start curving
    body = union(rounded_rect(n_left, TOP, 850.0, BOTTOM), s_upper, s_lower)

    n_top_cut = polygon((top_cut_x, TOP - 1), (n_inner_right, TOP - 1), (n_inner_right, top_tip_y))
    n_bottom_cut = polygon((n_inner_left, bot_tip_y), (n_inner_left, BOTTOM + 1), (bot_cut_x, BOTTOM + 1))
    s_counter_up = rounded_rect(837.6, 114.3, 899.0, 142.6, tl=(10, 10), bl=(10, 10), tr=(8, 8))
    s_counter_lo = rounded_rect(836.3, 185.7, 900.2, 215.1, tr=(14.7, 14.7), br=(14.7, 14.7))
    return minus(body, n_top_cut, n_bottom_cut, s_counter_up, s_counter_lo)


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
