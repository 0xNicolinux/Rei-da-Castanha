"""Pós-processa os renders de tools/blender/props.py e gera jogo/js/sprites-props.js.

Uso:  blender -b --python tools/blender/embutir_props.py -- <pasta-dos-renders> <saída.js>
Cada sprite ganha paleta reduzida (cara de pixel art), contorno escuro de 1 px nas bordas
transparentes e vai como data URI para RC.SPRITE_BLENDER; o normal map vai para RC.SPRITE_NORMALS."""
import bpy, sys, os, base64, numpy as np

args = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = args[0], args[1]
INK = np.array([0.11, 0.07, 0.045])          # contorno marrom-tinta, como o dos sprites CC0


def load(path):
    im = bpy.data.images.load(path); w, h = im.size
    a = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)
    bpy.data.images.remove(im); return a


def save(a, path):
    h, w = a.shape[:2]
    im = bpy.data.images.new('o', w, h, alpha=True); im.pixels[:] = a.reshape(-1).tolist()
    im.filepath_raw = path; im.file_format = 'PNG'; im.save(); bpy.data.images.remove(im)


def pixelize(a):
    rgb, al = a[..., :3], a[..., 3]
    al = (al > 0.5).astype(np.float32)                                   # alfa binário: borda nítida
    rgb = np.clip((rgb - 0.5) * 1.12 + 0.5, 0, 1)                        # um pouco mais de contraste
    rgb = np.round(rgb * 14) / 14                                        # paleta reduzida por canal
    # contorno: pixel opaco com vizinho transparente escurece em direção à tinta
    pad = np.pad(al, 1)
    edge = (al > 0) & ((pad[:-2, 1:-1] == 0) | (pad[2:, 1:-1] == 0) | (pad[1:-1, :-2] == 0) | (pad[1:-1, 2:] == 0))
    rgb[edge] = rgb[edge] * 0.35 + INK * 0.65
    out = np.concatenate([rgb, al[..., None]], -1)
    out[al == 0] = 0
    return out


albedo, normals = {}, {}
tmp = os.path.join(SRC, '_out'); os.makedirs(tmp, exist_ok=True)
for f in sorted(os.listdir(SRC)):
    if not f.endswith('.png') or f.endswith('_n.png'): continue
    name = f[:-4]
    a = pixelize(load(os.path.join(SRC, f)))
    save(a, os.path.join(tmp, f))
    n = load(os.path.join(SRC, name + '_n.png')); n[..., 3] = a[..., 3]
    save(n, os.path.join(tmp, name + '_n.png'))
    albedo[name] = 'data:image/png;base64,' + base64.b64encode(open(os.path.join(tmp, f), 'rb').read()).decode()
    normals[name] = 'data:image/png;base64,' + base64.b64encode(open(os.path.join(tmp, name + '_n.png'), 'rb').read()).decode()

import json
with open(OUT, 'w') as fh:
    fh.write('/* Gerado por tools/blender/embutir_props.py: pontes, alavanca, tronco e jangada modelados no Blender\n   (tools/blender/props.py), com normal map renderizado. Não edite à mão. */\n')
    fh.write('window.RC = window.RC || {};\n')
    fh.write('RC.SPRITE_BLENDER = Object.assign(RC.SPRITE_BLENDER || {}, ' + json.dumps(albedo) + ');\n')
    fh.write('RC.SPRITE_NORMALS = Object.assign(RC.SPRITE_NORMALS || {}, ' + json.dumps(normals) + ');\n')
print('OK', len(albedo), 'sprites ->', OUT)
