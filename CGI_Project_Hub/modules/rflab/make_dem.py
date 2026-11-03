"""Regenerate data/dem_data.js from a Copernicus GLO-30 COG tile (needs numpy only).
Handles deflate + floating-point predictor, which most TIFF readers need extra codecs for."""
import base64, json, struct, sys, zlib
from pathlib import Path
import numpy as np
W_, E_, S_, N_ = 25.39, 25.66, -24.475, -24.315   # project crop
def read_tiff(path):
    f = open(path, 'rb'); hdr = f.read(16); bo = '<' if hdr[:2] == b'II' else '>'
    big = struct.unpack(bo + 'H', hdr[2:4])[0] == 43
    f.seek(struct.unpack(bo + ('Q' if big else 'I'), hdr[8:16] if big else hdr[4:8])[0])
    n = struct.unpack(bo + ('Q' if big else 'H'), f.read(8 if big else 2))[0]
    T = {1: ('B', 1), 2: ('s', 1), 3: ('H', 2), 4: ('I', 4), 12: ('d', 8), 16: ('Q', 8)}; tags = {}
    for _ in range(n):
        e = f.read(20 if big else 12)
        tag, typ, cnt = struct.unpack(bo + ('HHQ' if big else 'HHI'), e[:12] if big else e[:8]); val = e[12:] if big else e[8:]
        fmt, sz = T.get(typ, ('B', 1)); total = sz * cnt
        if total > len(val):
            cur = f.tell(); f.seek(struct.unpack(bo + ('Q' if big else 'I'), val)[0]); val = f.read(total); f.seek(cur)
        tags[tag] = val[:total] if fmt == 's' else struct.unpack(bo + fmt * cnt, val[:total])
    W, H, tw, tl = tags[256][0], tags[257][0], tags[322][0], tags[323][0]
    if tags.get(317, (1,))[0] != 3: sys.exit('Expected floating-point predictor (Copernicus COG).')
    out = np.zeros((H, W), np.float32); nx = (W + tw - 1) // tw
    for k, (off, cnt) in enumerate(zip(tags[324], tags[325])):
        f.seek(off); b = np.frombuffer(zlib.decompress(f.read(cnt)), np.uint8).reshape(tl, tw * 4)
        b = np.cumsum(b, axis=1, dtype=np.uint64).astype(np.uint8)
        t = np.ascontiguousarray(b.reshape(tl, 4, tw).transpose(0, 2, 1)).view('>f4').reshape(tl, tw)
        ty, tx = divmod(k, nx); y0, x0 = ty * tl, tx * tw; hh, ww = min(tl, H - y0), min(tw, W - x0)
        out[y0:y0 + hh, x0:x0 + ww] = t[:hh, :ww]
    scale, tie = tags[33550], tags[33922]
    return out, tie[3], tie[4], scale[0]
if __name__ == '__main__':
    root = Path(__file__).resolve().parents[1]
    src = sys.argv[1] if len(sys.argv) > 1 else next((root / 'data' / 'terrain').glob('*.tif'))
    a, lon0, lat0, st = read_tiff(src)
    r0, r1 = round((lat0 - N_) / st), round((lat0 - S_) / st); c0, c1 = round((W_ - lon0) / st), round((E_ - lon0) / st)
    crop = a[r0:r1 + 1, c0:c1 + 1]
    meta = dict(w=int(crop.shape[1]), h=int(crop.shape[0]), north=lat0 - r0 * st, west=lon0 + c0 * st, step=st, scale=0.1)
    js = 'const DEM_META=' + json.dumps(meta) + ';\nconst DEM_B64="' + base64.b64encode(np.round(crop * 10).astype('<u2').tobytes()).decode() + '";\n'
    (root / 'data' / 'dem_data.js').write_text(js); print('Wrote data/dem_data.js', crop.shape, f'{crop.min():.0f}–{crop.max():.0f} m')
