"""Cristalería de la práctica «Prueba de cloruros» (ruta B, paramétrica).

  blender -b --factory-startup -P art/blender/cristaleria_cloruros.py -- art/export [--render]

Genera, en metros y con el origen en el centro de la base:
  SM_Erlenmeyer_500     matraz Erlenmeyer de 500 mL con marcas de 100 a 500 mL
  SM_GradCylinder_100   probeta de 100 mL con base hexagonal, pico y escala de 10 a 100 mL
  SM_ReagentBottle_500  frasco de laboratorio de 500 mL con boca GL45 (sin tapa ni rosca)
  SM_Cap_GL45           tapa roscada

Cada malla graduada lleva dos materiales: 0 = vidrio, 1 = M_Graduacion (marcas blancas).
Las marcas se colocan a la altura donde el VOLUMEN INTERIOR DE ESTA MALLA vale lo que
indican (integrando el perfil interior), con el frente de la escala hacia +X.

Medidas exteriores tomadas de resúmenes de catálogo, SIN verificar contra las normas
(ver docs/PIPELINE_VISUAL_HIGGSFIELD.md): matraz Ø105 x 180 mm, cuello Ø34 (ISO 1773);
probeta Ø29 x 256 mm (ISO 4788); frasco Ø86 x 176 mm sin tapa (ISO 4796-1).
Decisiones propias, no medidas: grosores de pared, radios de acuerdo, altura del hombro
del matraz y del frasco, base hexagonal, pico, tapa, y tamaño y disposición de la escala.
"""
import math
import sys
from pathlib import Path

import bmesh
import bpy

MM = 0.001
INNER = {}   # perfil interior (r, z) en mm de cada recipiente, para graduar y para el líquido


def arc(cx, cz, r, a0, a1, n=6):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cz + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


def by_height(profile):
    # A igual altura (el fondo plano) va primero el punto del eje: si no, la interpolación del
    # radio partía de 0 en el primer tramo y las marcas quedaban hasta 0,4 mm altas.
    return sorted(profile, key=lambda p: (p[1], p[0]))


def radius_at(profile, z):
    pts = by_height(profile)
    for (r1, z1), (r2, z2) in zip(pts, pts[1:]):
        if z1 <= z <= z2:
            return r1 if z2 == z1 else r1 + (r2 - r1) * (z - z1) / (z2 - z1)
    return pts[-1][0]


def capacity_ml(inner):
    pts = by_height(inner)
    return sum(math.pi * (z2 - z1) * (r1 * r1 + r1 * r2 + r2 * r2) / 3.0
               for (r1, z1), (r2, z2) in zip(pts, pts[1:])) / 1000.0


def height_for_ml(inner, ml):
    """Altura (mm) a la que el volumen interior acumulado alcanza `ml`."""
    pts = by_height(inner)
    z, step, vol = pts[0][1], 0.02, 0.0
    while z < pts[-1][1]:
        r = radius_at(inner, z + step / 2)
        vol += math.pi * r * r * step / 1000.0
        z += step
        if vol >= ml:
            return z
    raise ValueError("la pieza no llega a %s mL" % ml)


def lathe(name, outer, inner, segments=72, spout=None):
    """Malla de revolución cerrada. `spout` = (z_min, semiángulo_grados, empuje_mm, ángulo_centro_grados)."""
    pts = outer + inner
    loop = pts[-1] == pts[0]          # perfil que vuelve al punto inicial (anillo, p. ej. la tapa)
    if loop:
        pts = pts[:-1]
    top = max(p[1] for p in pts)
    bm = bmesh.new()
    rings = []
    for r, z in pts:
        if r < 1e-6:
            rings.append([bm.verts.new((0.0, 0.0, z * MM))])
            continue
        ring = []
        for s in range(segments):
            a = 2 * math.pi * s / segments
            rr = r
            if spout and z >= spout[0]:
                d = abs((a - math.radians(spout[3]) + math.pi) % (2 * math.pi) - math.pi)
                w = max(0.0, 1.0 - d / math.radians(spout[1]))
                rr = r + spout[2] * (w * w) * (z - spout[0]) / max(1e-6, top - spout[0])
            ring.append(bm.verts.new((rr * MM * math.cos(a), rr * MM * math.sin(a), z * MM)))
        rings.append(ring)
    for a, b in zip(rings, rings[1:] + ([rings[0]] if loop else [])):
        if len(a) == 1 and len(b) == 1:
            continue                  # tramo sobre el eje: no genera caras
        for s in range(segments):
            t = (s + 1) % segments
            if len(a) == 1:
                bm.faces.new((a[0], b[s], b[t]))
            elif len(b) == 1:
                bm.faces.new((a[s], b[0], a[t]))
            else:
                bm.faces.new((a[s], b[s], b[t], a[t]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    manifold = all(e.is_manifold for e in bm.edges)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj["manifold"] = manifold
    return obj


def material(name, color=(1, 1, 1, 1), glass=True, roughness=0.03):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_backface_culling = False
    b = mat.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = color
    b.inputs["Roughness"].default_value = roughness
    if glass:
        b.inputs["IOR"].default_value = 1.47   # borosilicato (valor habitual, sin fuente citada)
        b.inputs["Transmission Weight"].default_value = 1.0
    return mat


def text_outline(text, size):
    """Vértices (x, y) y caras de un texto plano de altura `size` (en mm)."""
    curve = bpy.data.curves.new("txt", "FONT")
    curve.body, curve.size = text, size
    obj = bpy.data.objects.new("txt", curve)
    bpy.context.collection.objects.link(obj)
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    verts = [(v.co.x, v.co.y) for v in mesh.vertices]
    faces = [tuple(p.vertices) for p in mesh.polygons]
    bpy.data.meshes.remove(mesh)
    bpy.data.objects.remove(obj)
    bpy.data.curves.remove(curve)
    return verts, faces


def add_graduations(obj, outer, ticks, labels, offset=0.12):
    """Añade marcas sobre la cara exterior, centradas en +X.

    ticks  = [(z, u_inicio, longitud, grosor)]   labels = [(texto, u_inicio, z_centro, altura)]
    `u` es la distancia en mm medida sobre la circunferencia (positiva hacia +Y).
    """
    bm = bmesh.new()

    def wrap(u, z, r_ref):
        r = radius_at(outer, z) + offset
        a = u / r_ref
        return bm.verts.new((r * MM * math.cos(a), r * MM * math.sin(a), z * MM))

    for z, u0, length, thick in ticks:
        r_ref = radius_at(outer, z)
        n = max(2, int(length))
        low = [wrap(u0 + length * i / n, z - thick / 2, r_ref) for i in range(n + 1)]
        high = [wrap(u0 + length * i / n, z + thick / 2, r_ref) for i in range(n + 1)]
        for i in range(n):
            bm.faces.new((low[i], low[i + 1], high[i + 1], high[i]))
    for text, u0, zc, size in labels:
        verts, faces = text_outline(text, size)
        r_ref = radius_at(outer, zc)
        made = [wrap(u0 + x, zc - size * 0.34 + y, r_ref) for x, y in verts]
        for f in faces:
            bm.faces.new([made[i] for i in f])
    mesh = bpy.data.meshes.new(obj.name + "_marcas")
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(material("M_Graduacion", (0.92, 0.92, 0.9, 1), glass=False, roughness=0.6))
    marks = bpy.data.objects.new(obj.name + "_marcas", mesh)
    bpy.context.collection.objects.link(marks)
    bpy.ops.object.select_all(action="DESELECT")
    marks.select_set(True)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.join()


def erlenmeyer_500():
    BASE_R, H, NECK_R, WALL, BASE_T, F, SH = 52.5, 180.0, 17.0, 2.0, 3.0, 8.0, 148.0
    outer = [(0.0, 0.0)] + arc(BASE_R - F, F, F, -90, 0)
    outer += [(NECK_R + 3.0, SH - 8.0), (NECK_R + 0.8, SH - 2.0), (NECK_R, SH + 4.0), (NECK_R, H - 9.0),
              (NECK_R + 1.2, H - 5.5), (NECK_R + 3.4, H - 2.6)] + arc(NECK_R + 2.8, H - 1.2, 1.2, -30, 150)
    ri = NECK_R - WALL
    inner = [(ri + 1.6, H - 3.6), (ri, H - 9.0), (ri, SH + 4.0), (ri + 0.8, SH - 2.0), (ri + 3.0, SH - 8.0)]
    inner += list(reversed(arc(BASE_R - F, F + (BASE_T - WALL), F - WALL, -90, 0))) + [(0.0, BASE_T)]
    obj = lathe("SM_Erlenmeyer_500", outer, inner)
    INNER[obj.name] = inner
    obj.data.materials.append(material("M_Glass_Boro"))
    levels = {ml: height_for_ml(inner, ml) for ml in (100, 200, 300, 400, 500)}
    add_graduations(obj, outer,
                    [(z, -15.0, 12.0, 0.7) for z in levels.values()],
                    [(str(ml), -1.0, z, 6.5) for ml, z in levels.items()])
    return obj, capacity_ml(inner), levels


def cylinder_100():
    H, R, WALL, FOOT_H = 256.0, 14.5, 1.5, 6.0
    outer = [(0.0, 0.0), (R, 0.0), (R, H - 5.0), (R + 0.8, H - 2.0)] + arc(R + 0.2, H - 1.0, 1.0, -30, 150)
    ri = R - WALL
    inner = [(ri + 0.6, H - 3.0), (ri, H - 6.0)] + list(reversed(arc(ri - 3.0, FOOT_H + 4.0, 3.0, -90, 0))) + [(0.0, FOOT_H + 1.0)]
    tube = lathe("SM_GradCylinder_100", outer, inner, segments=48, spout=(H - 14.0, 28.0, 5.0, 90.0))
    INNER[tube.name] = inner
    # Base hexagonal: 60 mm entre caras -> radio a vértices = 30 / cos(30°)
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=30.0 / math.cos(math.radians(30)) * MM,
                                        depth=FOOT_H * MM, location=(0, 0, FOOT_H * MM / 2))
    foot = bpy.context.object
    bev = foot.modifiers.new("Bisel", "BEVEL")
    bev.width, bev.segments = 1.2 * MM, 3
    bpy.ops.object.select_all(action="DESELECT")
    foot.select_set(True)
    tube.select_set(True)
    bpy.context.view_layer.objects.active = tube
    bpy.ops.object.convert(target="MESH")
    bpy.ops.object.join()
    tube.data.materials.append(material("M_Glass_Boro"))
    ticks, labels, levels = [], [], {}
    for ml in range(10, 101):
        z = height_for_ml(inner, ml)
        if ml % 10 == 0:
            levels[ml] = z
            ticks.append((z, -9.0, 9.0, 0.45))
            labels.append((str(ml), 1.2, z, 3.6))
        else:
            ticks.append((z, -9.0, 6.0 if ml % 5 == 0 else 4.0, 0.3))
    add_graduations(tube, outer, ticks, labels)
    return tube, capacity_ml(inner), levels


def bottle_500():
    H, R, NECK, WALL, F = 176.0, 43.0, 22.5, 3.0, 6.0
    outer = [(0.0, 0.0)] + arc(R - F, F, F, -90, 0)
    outer += [(R, 100.0), (R - 1.5, 114.0), (R - 7.0, 128.0), (R - 15.0, 140.0), (NECK + 2.5, 148.0),
              (NECK + 2.5, 152.0), (NECK, 153.5), (NECK, H - 2.0)] + arc(NECK - 1.0, H - 1.0, 1.0, 0, 150)
    ri, ni = R - WALL, NECK - WALL
    inner = [(ni, H - 2.0), (ni, 150.0), (R - 17.5, 138.5), (R - 10.0, 127.0), (R - 4.2, 113.5), (ri, 100.0)]
    inner += list(reversed(arc(R - F, F + 1.0, F - WALL, -90, 0))) + [(0.0, 3.5)]
    obj = lathe("SM_ReagentBottle_500", outer, inner)
    INNER[obj.name] = inner
    obj.data.materials.append(material("M_Glass_Bottle"))
    return obj, capacity_ml(inner), {}


def cap_gl45():
    R, H, T = 27.0, 26.0, 3.0
    outer = [(R - 3.5, 0.0), (R, 0.0), (R, H - 3.0)] + arc(R - 3.0, H - 3.0, 3.0, 0, 90) + [(0.0, H)]
    inner = [(0.0, H - T), (R - 3.5, H - T), (R - 3.5, 0.0)]
    obj = lathe("SM_Cap_GL45", outer, inner)
    obj.data.materials.append(material("M_Cap_PP_Blue", (0.02, 0.12, 0.55, 1), glass=False, roughness=0.45))
    return obj, None, {}


def liquid(vessel, ml, name, mat, meniscus=0.8, gap=0.1):
    """Cuerpo de líquido de `ml` mililitros dentro de `vessel`: sigue la pared interior (con
    `gap` mm de holgura para que no coincidan las caras) y termina en un menisco cóncavo
    que sube `meniscus` mm junto al vidrio. El nivel se lee en el centro, como en la realidad."""
    inner = by_height(INNER[vessel])
    z0, zl = inner[0][1], height_for_ml(INNER[vessel], ml)
    wall = [(r - gap, z) for r, z in inner if z0 + 0.05 < z < zl - 0.05 and r > gap]
    r_top = radius_at(inner, zl) - gap
    m = min(meniscus, r_top * 0.2)
    outer = [(0.0, z0 + gap)] + wall + [(r_top, zl + m)]
    top = [(r_top - m * 0.6, zl + m * 0.45), (r_top - m * 1.6, zl + m * 0.1), (r_top - m * 3.0, zl), (0.0, zl)]
    obj = lathe(name, outer, top, segments=48)
    obj.data.materials.append(mat)
    obj["nivel_mm"] = zl
    return obj


def export(obj, out):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=str(out / (obj.name + ".glb")), use_selection=True, export_apply=True)


def render(objs, path):
    scene = bpy.context.scene
    flask, cyl, bottle, cap = objs
    for o, x in ((flask, -0.14), (cyl, -0.03), (bottle, 0.09)):
        o.location.x = x
        o.rotation_euler.z = -math.pi / 2          # la escala (+X) hacia la cámara (-Y)
    cap.location = (0.09, 0, 0.155)
    bottle.data.materials[0] = material("Vista_Ambar", (0.55, 0.22, 0.03, 1))
    bpy.ops.mesh.primitive_plane_add(size=3.0)
    bpy.context.object.data.materials.append(material("Suelo", (0.03, 0.035, 0.04, 1), glass=False, roughness=0.15))
    world = bpy.data.worlds.new("Mundo")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.75, 0.78, 0.8, 1)
    scene.world = world
    light = bpy.data.objects.new("Luz", bpy.data.lights.new("Luz", "AREA"))
    light.data.energy, light.data.size = 80, 0.7
    light.location, light.rotation_euler = (0.35, -0.35, 0.7), (math.radians(35), math.radians(25), 0)
    scene.collection.objects.link(light)
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    cam.data.lens = 70
    cam.location, cam.rotation_euler = (-0.02, -0.9, 0.19), (math.radians(87), 0, 0)
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.engine = "CYCLES"
    scene.cycles.samples, scene.cycles.device = 128, "CPU"
    scene.render.resolution_x, scene.render.resolution_y = 1280, 960
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = (Path(args[0]) if args else Path("art/export")).resolve()  # Blender exige ruta absoluta al renderizar
    out.mkdir(parents=True, exist_ok=True)
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    built = [erlenmeyer_500(), cylinder_100(), bottle_500(), cap_gl45()]
    # Líquidos de la práctica: 20 mL medidos en la probeta, 25 mL de mezcla en el matraz (blanco
    # lechoso de AgCl, como indica el modelo) y frasco de reactivo con 400 mL (incoloro).
    agua = material("M_Liquid_Clear", (0.97, 0.985, 1.0, 1), roughness=0.0)
    agua.node_tree.nodes["Principled BSDF"].inputs["IOR"].default_value = 1.333
    lechoso = material("M_Liquid_AgCl", (0.9, 0.9, 0.88, 1), glass=False, roughness=0.3)
    liquids = [(liquid("SM_GradCylinder_100", 20, "SM_Liquid_Cylinder100_20mL", agua), "SM_GradCylinder_100"),
               (liquid("SM_Erlenmeyer_500", 25, "SM_Liquid_Erlenmeyer500_25mL", lechoso, meniscus=0.4), "SM_Erlenmeyer_500"),
               (liquid("SM_ReagentBottle_500", 400, "SM_Liquid_Bottle500_400mL", agua, meniscus=0.5), "SM_ReagentBottle_500")]
    for liq, vessel in liquids:
        built.append((liq, None, {"nivel": liq["nivel_mm"]}))
    for obj, ml, levels in built:
        d = obj.dimensions
        tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
        print(f"PIEZA {obj.name} mm=({d.x*1000:.1f}, {d.y*1000:.1f}, {d.z*1000:.1f}) tris={tris} "
              f"cerrada={obj.get('manifold')} capacidad_ml={'-' if ml is None else round(ml, 1)} "
              f"materiales={[m.name for m in obj.data.materials]}")
        if levels:
            print("  MARCAS_MM " + ", ".join(f"{k} mL={v:.1f}" for k, v in levels.items()))
        export(obj, out)
    # Perfiles interiores (radio, altura) en mm, ordenados por altura: los usa el componente de
    # líquido de Unreal para calcular el nivel de cualquier volumen con la misma geometría.
    import json
    perfiles = {name: [[round(r, 4), round(z, 4)] for r, z in by_height(pts)] for name, pts in INNER.items()}
    (out / "perfiles_interiores.json").write_text(json.dumps(perfiles, indent=1), encoding="utf-8")
    if "--render" in args:
        for liq, vessel in liquids:
            liq.parent = bpy.data.objects[vessel]
        render([b[0] for b in built[:4]], out / "cristaleria_cloruros_preview.png")
    print("EXPORT_OK")


if __name__ == "__main__":
    main()
