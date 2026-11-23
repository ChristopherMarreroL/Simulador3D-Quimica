"""Manos en primera persona con guante de nitrilo y puño de bata (modelado paramétrico).

  blender -b --factory-startup -P art/blender/manos.py -- art/export [--render]

Genera SM_Hand_R y SM_Hand_L (espejo), en metros. Origen en la muñeca; los dedos apuntan a +X,
la palma mira a -Z y el pulgar de la mano derecha queda en +Y (al importar en Unreal, +Y de
Blender pasa a -Y, es decir, hacia dentro). Materiales: 0 = M_Nitrile_Blue, 1 = M_LabCoat.

Es una mano ESTÁTICA en pose relajada: cápsulas fundidas con un remallado por vóxeles. No tiene
esqueleto ni dedos articulados, así que no puede cerrarse sobre un objeto. Las proporciones son
estimaciones propias de una mano adulta, no medidas.
"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

MM = 0.001


def capsule(bm, a, b, radius):
    """Cilindro entre a y b (mm) con una esfera en cada extremo."""
    a, b = Vector(a) * MM, Vector(b) * MM
    eje = b - a
    largo = eje.length
    giro = Vector((0, 0, 1)).rotation_difference(eje.normalized()).to_matrix().to_4x4()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=radius * MM, radius2=radius * MM, depth=largo,
                          matrix=Matrix.Translation((a + b) / 2) @ giro)
    for p in (a, b):
        bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=12, radius=radius * MM, matrix=Matrix.Translation(p))


def finger(bm, base, length, radius, curls, spread=0.0):
    """Tres falanges desde `base`, cada una doblada hacia la palma (-Z) el ángulo acumulado."""
    p = Vector(base)
    angle = 0.0
    for fraction, curl in zip((0.45, 0.30, 0.25), curls):
        angle += math.radians(curl)
        d = Vector((math.cos(angle) * math.cos(spread), math.cos(angle) * math.sin(spread), -math.sin(angle)))
        q = p + d * length * fraction
        capsule(bm, p, q, radius)
        p = q
        radius *= 0.93


def material(name, color, roughness):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    b = mat.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = color
    b.inputs["Roughness"].default_value = roughness
    return mat


def build_right():
    bm = bmesh.new()
    # Palma: tres cápsulas anchas en abanico, más el talón de la mano.
    for y in (-24.0, -8.0, 8.0, 24.0):
        capsule(bm, (8.0, y * 0.75, 0.0), (78.0, y, -2.0), 13.0)
    capsule(bm, (-6.0, -12.0, -2.0), (-6.0, 14.0, -2.0), 17.0)
    # Muñeca y puño del guante.
    capsule(bm, (-55.0, 0.0, 0.0), (-4.0, 0.0, 0.0), 24.0)
    # Dedos: meñique, anular, corazón, índice (hacia +Y).
    finger(bm, (80.0, -28.0, -2.0), 58.0, 8.0, (22, 30, 24), spread=math.radians(-7))
    finger(bm, (86.0, -10.0, -2.0), 74.0, 9.0, (18, 28, 22), spread=math.radians(-2))
    finger(bm, (88.0, 9.0, -2.0), 80.0, 9.5, (16, 26, 20), spread=math.radians(2))
    finger(bm, (84.0, 28.0, -2.0), 72.0, 9.0, (14, 24, 18), spread=math.radians(7))
    # Pulgar: dos falanges hacia delante y hacia dentro.
    capsule(bm, (6.0, 30.0, -4.0), (34.0, 52.0, -10.0), 13.0)
    capsule(bm, (34.0, 52.0, -10.0), (62.0, 60.0, -18.0), 11.0)
    capsule(bm, (62.0, 60.0, -18.0), (84.0, 60.0, -27.0), 10.0)
    mesh = bpy.data.meshes.new("guante")
    bm.to_mesh(mesh)
    bm.free()
    glove = bpy.data.objects.new("guante", mesh)
    bpy.context.collection.objects.link(glove)
    # Funde las cápsulas en una sola piel, la suaviza y reduce el número de triángulos.
    remesh = glove.modifiers.new("Remallado", "REMESH")
    remesh.mode, remesh.voxel_size = "VOXEL", 1.6 * MM
    smooth = glove.modifiers.new("Suavizado", "SMOOTH")
    smooth.factor, smooth.iterations = 0.6, 12
    decimate = glove.modifiers.new("Reducir", "DECIMATE")
    decimate.ratio = 0.22
    final = bpy.data.meshes.new_from_object(glove.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(glove)
    hand = bpy.data.objects.new("SM_Hand_R", final)
    bpy.context.collection.objects.link(hand)
    final.materials.append(material("M_Nitrile_Blue", (0.05, 0.22, 0.62, 1), 0.38))
    for p in final.polygons:
        p.use_smooth = True

    # Manga de la bata: tubo ligeramente cónico, cerrado por detrás, con el puño vuelto.
    sleeve = bmesh.new()
    rings = [(-640.0, 56.0), (-300.0, 50.0), (-120.0, 44.0), (-52.0, 37.0), (-44.0, 36.0), (-44.0, 30.0), (-60.0, 30.0)]
    verts = [[sleeve.verts.new((x * MM, r * MM * math.cos(2 * math.pi * s / 32), r * MM * 0.82 * math.sin(2 * math.pi * s / 32)))
              for s in range(32)] for x, r in rings]
    for a, b in zip(verts, verts[1:]):
        for s in range(32):
            sleeve.faces.new((a[s], a[(s + 1) % 32], b[(s + 1) % 32], b[s]))
    sleeve.faces.new(list(reversed(verts[0])))
    bmesh.ops.recalc_face_normals(sleeve, faces=sleeve.faces)
    sm = bpy.data.meshes.new("manga")
    sleeve.to_mesh(sm)
    sleeve.free()
    sm.materials.append(material("M_LabCoat", (0.86, 0.86, 0.84, 1), 0.85))
    for p in sm.polygons:
        p.use_smooth = True
    so = bpy.data.objects.new("manga", sm)
    bpy.context.collection.objects.link(so)
    bpy.ops.object.select_all(action="DESELECT")
    so.select_set(True)
    hand.select_set(True)
    bpy.context.view_layer.objects.active = hand
    bpy.ops.object.join()
    return hand


def mirrored(right):
    left = right.copy()
    left.data = right.data.copy()
    left.name = left.data.name = "SM_Hand_L"
    bpy.context.collection.objects.link(left)
    for v in left.data.vertices:
        v.co.y = -v.co.y
    left.data.flip_normals()
    return left


def export(obj, out):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=str(out / (obj.name + ".glb")), use_selection=True, export_apply=True)


def render(right, left, path):
    scene = bpy.context.scene
    right.location.y, left.location.y = -0.09, 0.09
    bpy.ops.mesh.primitive_plane_add(size=3.0, location=(0, 0, -0.08))
    bpy.context.object.data.materials.append(material("Suelo", (0.03, 0.035, 0.04, 1), 0.2))
    world = bpy.data.worlds.new("Mundo")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.75, 0.78, 0.8, 1)
    scene.world = world
    light = bpy.data.objects.new("Luz", bpy.data.lights.new("Luz", "AREA"))
    light.data.energy, light.data.size = 60, 0.8
    light.location, light.rotation_euler = (0.1, -0.2, 0.7), (math.radians(20), math.radians(8), 0)
    scene.collection.objects.link(light)
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    cam.data.lens = 45
    cam.location, cam.rotation_euler = (-0.42, 0.0, 0.32), (math.radians(58), 0, math.radians(-90))
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.engine = "CYCLES"
    scene.cycles.samples, scene.cycles.device = 64, "CPU"
    scene.render.resolution_x, scene.render.resolution_y = 1280, 720
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = (Path(args[0]) if args else Path("art/export")).resolve()
    out.mkdir(parents=True, exist_ok=True)
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    right = build_right()
    left = mirrored(right)
    for obj in (right, left):
        d = obj.dimensions
        print(f"PIEZA {obj.name} mm=({d.x*1000:.0f}, {d.y*1000:.0f}, {d.z*1000:.0f}) "
              f"tris={sum(len(p.vertices) - 2 for p in obj.data.polygons)} materiales={[m.name for m in obj.data.materials]}")
        export(obj, out)
    if "--render" in args:
        render(right, left, out / "manos_preview.png")
    print("EXPORT_OK")


main()
