"""Rei da Castanha: objetos de cenário modelados no Blender (pontes, alavanca, tronco, jangada).

Uso:  blender -b -P tools/blender/props.py -- <pasta-de-saída>
Gera, para cada objeto, <nome>.png (cor) e <nome>_n.png (normal map no espaço da tela:
R = direita, G = para baixo, B = para quem olha), na resolução exata de pixel art do jogo
(1 texel = 2 px de mundo). Depois rode tools/blender/embutir_props.py para gerar js/sprites-props.js.
"""
import bpy, math, sys, os
from mathutils import Vector

OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '/tmp/props'
os.makedirs(OUT, exist_ok=True)
U = 0.1          # 1 texel = 0.1 unidade do Blender


# ------------------------------------------------------------------ cena base
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 48
    sc.cycles.use_denoising = False
    sc.cycles.pixel_filter_type = 'BOX'
    sc.cycles.filter_width = 0.01          # sem antisserrilhado: pixels nítidos
    sc.render.film_transparent = True
    sc.view_settings.view_transform = 'Standard'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.dither_intensity = 0
    w = bpy.data.worlds.new('w'); sc.world = w
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.5, 0.48, 1)
    w.node_tree.nodes['Background'].inputs[1].default_value = 0.22
    # sol vindo do alto à esquerda, como a luz principal das fases
    sun = bpy.data.objects.new('sol', bpy.data.lights.new('sol', 'SUN'))
    sun.data.energy = 5.0; sun.data.angle = math.radians(8)
    sun.rotation_euler = (math.radians(50), math.radians(-35), math.radians(-20))
    sc.collection.objects.link(sun)
    return sc


def mat_wood(name, base, dark, scale=18.0, rough=0.75, along_x=False):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    bsdf = N['Principled BSDF']; bsdf.inputs['Roughness'].default_value = rough
    tc = N.new('ShaderNodeTexCoord'); mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (scale * 0.25, scale, scale)
    wave = N.new('ShaderNodeTexWave'); wave.inputs['Scale'].default_value = 2.2; wave.inputs['Distortion'].default_value = 6.0; wave.inputs['Detail'].default_value = 3
    ramp = N.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*dark, 1); ramp.color_ramp.elements[1].color = (*base, 1)
    ramp.color_ramp.elements[0].position = 0.25; ramp.color_ramp.elements[1].position = 0.7
    if along_x: mp.inputs['Scale'].default_value = (scale * 0.08, scale, scale)
    L.new(tc.outputs['Object'], mp.inputs['Vector']); L.new(mp.outputs['Vector'], wave.inputs['Vector'])
    L.new(wave.outputs['Fac'], ramp.inputs['Fac']); L.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    bump = N.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.6
    L.new(wave.outputs['Fac'], bump.inputs['Height']); L.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return m


def mat_flat(name, col, rough=0.6, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    return m


def mat_noise(name, a, b, scale=30.0, bump=0.6, rough=0.85):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    bsdf = N['Principled BSDF']; bsdf.inputs['Roughness'].default_value = rough
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = 6
    ramp = N.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color = (*a, 1); ramp.color_ramp.elements[1].color = (*b, 1)
    L.new(nz.outputs['Fac'], ramp.inputs['Fac']); L.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump
    L.new(nz.outputs['Fac'], bp.inputs['Height']); L.new(bp.outputs['Normal'], bsdf.inputs['Normal'])
    return m


def mat_rings(name):
    """face cortada do tronco: anéis claros e escuros"""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    bsdf = N['Principled BSDF']; bsdf.inputs['Roughness'].default_value = 0.8
    tc = N.new('ShaderNodeTexCoord'); wave = N.new('ShaderNodeTexWave')
    wave.wave_type = 'RINGS'; wave.inputs['Scale'].default_value = 3.0; wave.inputs['Distortion'].default_value = 1.5
    ramp = N.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color = (0.22, 0.1, 0.035, 1); ramp.color_ramp.elements[1].color = (0.62, 0.38, 0.14, 1)
    L.new(tc.outputs['Object'], wave.inputs['Vector']); L.new(wave.outputs['Fac'], ramp.inputs['Fac']); L.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    return m


def box(name, size, loc, mat, bevel=0.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        md = o.modifiers.new('bv', 'BEVEL'); md.width = bevel; md.segments = 2
    o.data.materials.append(mat); return o


def cyl(name, r, depth, loc, rot, mat, verts=20, bevel=0.01):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.active_object; o.name = name
    if bevel:
        md = o.modifiers.new('bv', 'BEVEL'); md.width = bevel; md.segments = 2
    bpy.ops.object.shade_smooth()
    o.data.materials.append(mat); return o


def render(name, w, h, cx=0.0, cz=0.0, tilt=12.0):
    """câmera ortográfica de frente (olhando +Y), levemente de cima; w×h texels centrados em (cx, cz)"""
    sc = bpy.context.scene
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam)
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = max(w, h) * U
    t = math.radians(tilt)
    cam.location = (cx, -10 * math.cos(t), cz + 10 * math.sin(t))
    cam.rotation_euler = (math.radians(90) - t, 0, 0)
    sc.camera = cam
    sc.render.resolution_x = w; sc.render.resolution_y = h; sc.render.resolution_percentage = 100
    if w >= h: cam.data.sensor_fit = 'HORIZONTAL'
    else: cam.data.sensor_fit = 'VERTICAL'
    sc.view_layers[0].material_override = None
    sc.render.filepath = os.path.join(OUT, name + '.png'); bpy.ops.render.render(write_still=True)
    # passe de normais: emissão com a normal em espaço de câmera (R direita, G para baixo, B para a câmera)
    nm = bpy.data.materials.get('__normal') or make_normal_mat()
    sc.view_layers[0].material_override = nm
    keep = sc.cycles.samples; sc.cycles.samples = 8
    sc.render.filepath = os.path.join(OUT, name + '_n.png'); bpy.ops.render.render(write_still=True)
    sc.cycles.samples = keep; sc.view_layers[0].material_override = None
    bpy.data.objects.remove(cam)


def make_normal_mat():
    m = bpy.data.materials.new('__normal'); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    for n in list(N): N.remove(n)
    geo = N.new('ShaderNodeNewGeometry'); vt = N.new('ShaderNodeVectorTransform')
    vt.vector_type = 'NORMAL'; vt.convert_from = 'WORLD'; vt.convert_to = 'CAMERA'
    sep = N.new('ShaderNodeSeparateXYZ'); L.new(geo.outputs['Normal'], vt.inputs['Vector']); L.new(vt.outputs['Vector'], sep.inputs['Vector'])
    def remap(sock, sign):
        mul = N.new('ShaderNodeMath'); mul.operation = 'MULTIPLY_ADD'; mul.inputs[1].default_value = 0.5 * sign; mul.inputs[2].default_value = 0.5
        L.new(sock, mul.inputs[0]); return mul.outputs[0]
    comb = N.new('ShaderNodeCombineXYZ')
    # câmera do Blender: X direita, Y cima, Z para fora da tela (para quem olha)
    L.new(remap(sep.outputs['X'], 1), comb.inputs['X']); L.new(remap(sep.outputs['Y'], -1), comb.inputs['Y']); L.new(remap(sep.outputs['Z'], -1), comb.inputs['Z'])
    em = N.new('ShaderNodeEmission'); out = N.new('ShaderNodeOutputMaterial')
    L.new(comb.outputs['Vector'], em.inputs['Color']); L.new(em.outputs['Emission'], out.inputs['Surface'])
    return m


# cores em espaço linear (o Blender converte para sRGB): valores baixos = tons ricos, não lavados
WOOD = (0.34, 0.15, 0.05); WOOD_D = (0.07, 0.03, 0.01)
ROPE = (0.52, 0.36, 0.14); IRON = (0.06, 0.06, 0.075)

# ------------------------------------------------------------------ tábuas da ponte de corda (16x7)
for i, (b, d) in enumerate([(WOOD, WOOD_D), ((0.42, 0.2, 0.07), (0.1, 0.045, 0.015))]):
    reset()
    wood = mat_wood('w', b, d, scale=14 + i * 5)
    box('tabua', (1.5, 0.9, 0.36), (0, 0, 0), wood, 0.03)
    for x in (-0.56, 0.56):
        cyl('prego', 0.045, 0.05, (x, -0.46, 0.04), (math.radians(90), 0, 0), mat_flat('i', IRON, 0.4, 0.8), 8, 0)
    # corda amarrada passando por baixo
    for x in (-0.62, 0.62):
        box('corda', (0.1, 0.96, 0.42), (x, 0, 0), mat_flat('r', ROPE, 0.9), 0.02)
    render(f'prop_plank_{i + 1}', 16, 7)

# ------------------------------------------------------------------ poste com nó de corda (10x28)
reset()
wood = mat_wood('w', WOOD, WOOD_D, scale=10)
cyl('poste', 0.32, 2.5, (0, 0, 0), (0, 0, 0), wood, 14, 0.04)
cyl('topo', 0.36, 0.14, (0, 0, 1.27), (0, 0, 0), wood, 14, 0.03)
rope = mat_flat('r', ROPE, 0.9)
for z in (0.85, 0.98):
    bpy.ops.mesh.primitive_torus_add(major_radius=0.34, minor_radius=0.06, location=(0, 0, z))
    t = bpy.context.active_object; t.data.materials.append(rope)
render('prop_post', 10, 28, 0, 0)

# ------------------------------------------------------------------ deck da ponte levadiça (16x8, emenda lado a lado)
reset()
wood = mat_wood('w', (0.3, 0.13, 0.045), (0.06, 0.025, 0.01), scale=16)
box('deck', (1.6, 1.4, 0.5), (0, 0, 0), wood, 0.03)
iron = mat_flat('i', IRON, 0.45, 0.85)
box('cinta', (0.16, 1.44, 0.54), (0.0, 0, 0), iron, 0.01)
for x in (-0.06, 0.06):
    cyl('rebite', 0.04, 0.04, (x, -0.73, 0.14), (math.radians(90), 0, 0), iron, 8, 0)
    cyl('rebite', 0.04, 0.04, (x, -0.73, -0.14), (math.radians(90), 0, 0), iron, 8, 0)
render('prop_deck', 16, 8)

# ------------------------------------------------------------------ torre da ponte levadiça com roda (16x46)
reset()
wood = mat_wood('w', WOOD, WOOD_D, scale=8)
box('pe', (0.5, 0.5, 4.2), (0, 0, -0.1), wood, 0.04)
box('trave', (1.2, 0.4, 0.3), (0.2, 0, 1.85), wood, 0.03)
iron = mat_flat('i', IRON, 0.4, 0.9)
cyl('roda', 0.42, 0.16, (0.2, -0.32, 1.3), (math.radians(90), 0, 0), iron, 16, 0.02)
for k in range(8):
    a = k * math.pi / 4
    box('dente', (0.12, 0.14, 0.12), (0.2 + math.cos(a) * 0.48, -0.32, 1.3 + math.sin(a) * 0.48), iron, 0.0)
cyl('eixo', 0.1, 0.24, (0.2, -0.38, 1.3), (math.radians(90), 0, 0), mat_flat('b', (0.75, 0.45, 0.08), 0.35, 1.0), 10, 0)
render('prop_tower', 16, 46, 0.15, 0)

# ------------------------------------------------------------------ alavanca: base de pedra (18x10) e haste (6x22, desligada/ligada)
reset()
stone = mat_noise('s', (0.08, 0.08, 0.1), (0.3, 0.29, 0.33), 22, 0.8)
box('base', (1.6, 0.9, 0.7), (0, 0, 0), stone, 0.08)
box('fenda', (0.9, 0.2, 0.08), (0, -0.1, 0.36), mat_flat('d', (0.08, 0.07, 0.09), 0.9), 0.0)
render('prop_lever_base', 18, 10)
for state, col in (('off', (0.75, 0.06, 0.03)), ('on', (0.1, 0.6, 0.06))):
    reset()
    wood = mat_wood('w', WOOD, WOOD_D, scale=12)
    cyl('haste', 0.1, 1.7, (0, 0, -0.15), (0, 0, 0), wood, 10, 0.02)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.26, location=(0, 0, 0.8), segments=16, ring_count=10)
    s = bpy.context.active_object; bpy.ops.object.shade_smooth(); s.data.materials.append(mat_flat('k', col, 0.25))
    render(f'prop_lever_{state}', 6, 22)

# ------------------------------------------------------------------ tronco seco: meio (16x13, emenda) e ponta cortada (9x13)
reset()
bark = mat_wood('b', (0.2, 0.1, 0.04), (0.035, 0.015, 0.006), scale=7, along_x=True)
cyl('tronco', 0.6, 1.62, (0, 0, 0), (0, math.radians(90), 0), bark, 24, 0)
render('prop_log_mid', 16, 13, 0, 0, tilt=6)
reset()
bark = mat_wood('b', (0.2, 0.1, 0.04), (0.035, 0.015, 0.006), scale=7, along_x=True)
o = cyl('tronco', 0.6, 0.9, (-0.4, 0, 0), (0, math.radians(90), 0), bark, 24, 0)
o.data.materials.append(mat_rings('rings'))
# a tampa da ponta (+X) leva os anéis
for p in o.data.polygons:
    if p.normal.x > 0.9: p.material_index = 1
render('prop_log_end', 9, 13, -0.4 + 0.45 - 0.45, 0, tilt=6)

# ------------------------------------------------------------------ jangada: troncos amarrados (16x9, emenda)
reset()
bark = mat_wood('b', (0.32, 0.15, 0.05), (0.06, 0.025, 0.008), scale=9, along_x=True)
for k, (y, z) in enumerate(((-0.3, 0.05), (0.3, -0.05))):
    cyl('tora', 0.34, 1.62, (0, y, z), (0, math.radians(90), 0), bark, 16, 0)
rope = mat_flat('r', ROPE, 0.9)
for x in (-0.45, 0.45):
    bpy.ops.mesh.primitive_torus_add(major_radius=0.4, minor_radius=0.05, location=(x, -0.3, 0.05), rotation=(0, math.radians(90), 0))
    t = bpy.context.active_object; t.data.materials.append(rope)
render('prop_raft', 16, 9)

print('OK props ->', OUT)
