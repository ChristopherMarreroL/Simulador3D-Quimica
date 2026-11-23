"""Instrumentos de laboratorio para los gabinetes y la vitrina (modelado paramétrico).

  blender -b --factory-startup -P art/blender/instrumentos.py -- art/export [--render]

Reutiliza los ayudantes de cristaleria_cloruros.py (torno, graduaciones, volumen interior).
Todas las piezas van en metros, con el origen en el centro de la base. Los recipientes que
pueden contener mezclas añaden su perfil interior a art/export/perfiles_interiores.json.

LAS MEDIDAS SON APROXIMADAS: proporciones habituales de catálogo escritas de memoria, sin
contrastar con ISO 3819 (vasos), ISO 4788 (probetas), ISO 1042 (aforados) ni con ningún
fabricante. Sirven para llenar el laboratorio; hay que verificarlas antes de darlas por buenas.

Nombres de material (los usa el guion del nivel para asignar los de Unreal):
M_Glass_Boro, M_Graduacion, M_Glass_Amber, M_HDPE, M_Porcelain, M_Metal, M_Cap_PP_Blue, M_Black.
"""
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import cristaleria_cloruros as c  # noqa: E402

MM = c.MM
arc = c.arc


def mat(name):
    colores = {"M_Glass_Boro": ((1, 1, 1, 1), True, 0.03), "M_Glass_Amber": ((0.55, 0.22, 0.03, 1), True, 0.04),
               "M_HDPE": ((0.9, 0.9, 0.86, 1), False, 0.5), "M_Porcelain": ((0.93, 0.92, 0.88, 1), False, 0.25),
               "M_Metal": ((0.6, 0.6, 0.62, 1), False, 0.3), "M_Cap_PP_Blue": ((0.02, 0.12, 0.55, 1), False, 0.45),
               "M_Black": ((0.02, 0.02, 0.02, 1), False, 0.5)}
    color, vidrio, rugosidad = colores[name]
    return c.material(name, color, glass=vidrio, roughness=rugosidad)


def shell(outer, wall, base):
    """Perfil interior a partir del exterior: misma forma, `wall` mm más estrecha y con fondo de `base` mm."""
    arriba = [(max(0.5, r - wall), z) for r, z in outer if z > base + 0.5]
    r_fondo = max(0.5, c.radius_at(c.by_height(outer), base + 0.5) - wall)
    return list(reversed(arriba)) + [(r_fondo, base), (0.0, base)]


def vessel(name, outer, wall, base, material_name="M_Glass_Boro", marks=None, text=5.0, tick=10.0, spout=None, segments=64):
    inner = shell(outer, wall, base)
    obj = c.lathe(name, outer, inner, segments=segments, spout=spout)
    obj.data.materials.append(mat(material_name))
    c.INNER[name] = inner
    if marks:
        niveles = {ml: c.height_for_ml(inner, ml) for ml in marks}
        c.add_graduations(obj, outer, [(z, -tick - 1.0, tick, 0.5) for z in niveles.values()],
                          [(str(ml), 0.5, z, text) for ml, z in niveles.items()])
    return obj


def solid(name, outer, material_name, segments=32):
    obj = c.lathe(name, outer, [], segments=segments)
    obj.data.materials.append(mat(material_name))
    return obj


def beaker(ml, d, h, marks):
    r = d / 2
    outer = [(0.0, 0.0)] + arc(r - 4, 4, 4, -90, 0) + [(r, h - 4), (r + 1.8, h - 1.5), (r + 2.0, h)]
    return vessel(f"SM_Beaker_{ml}", outer, 1.6, 2.5, marks=marks, text=max(3.2, d * 0.07), tick=d * 0.16,
                  spout=(h - 8.0, 22.0, 4.0, 90.0))


def erlenmeyer(ml, d, h, neck, shoulder, marks):
    r, n = d / 2, neck / 2
    outer = [(0.0, 0.0)] + arc(r - 7, 7, 7, -90, 0) + [(n + 3.0, shoulder - 8), (n + 0.8, shoulder - 2), (n, shoulder + 4),
                                                         (n, h - 8), (n + 1.2, h - 5), (n + 3.2, h - 2.4), (n + 3.4, h)]
    return vessel(f"SM_Erlenmeyer_{ml}", outer, 1.8, 2.8, marks=marks, text=5.5, tick=10.0)


def probeta(ml, d, h, foot, step):
    r = d / 2
    outer = [(0.0, 0.0), (r, 0.0), (r, h - 4), (r + 0.7, h - 1.5), (r + 0.9, h)]
    wall, foot_h = 1.2, 5.0
    inner = [(r - wall + 0.5, h - 2.5), (r - wall, h - 5)] + list(reversed(arc(r - wall - 2.0, foot_h + 3.0, 2.0, -90, 0))) + [(0.0, foot_h + 1.0)]
    name = f"SM_GradCylinder_{ml}"
    tube = c.lathe(name, outer, inner, segments=40, spout=(h - 10.0, 28.0, 3.5, 90.0))
    c.INNER[name] = inner
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=foot / 2 / math.cos(math.radians(30)) * MM, depth=foot_h * MM,
                                        location=(0, 0, foot_h * MM / 2))
    base = bpy.context.object
    bpy.ops.object.select_all(action="DESELECT")
    base.select_set(True)
    tube.select_set(True)
    bpy.context.view_layer.objects.active = tube
    bpy.ops.object.join()
    tube.data.materials.append(mat("M_Glass_Boro"))
    ticks, labels = [], []
    n = int(round(ml / step))
    for i in range(max(1, n // 10), n + 1):
        v = i * step
        z = c.height_for_ml(inner, v)
        mayor = i % 10 == 0 or (n <= 10)
        ticks.append((z, -d * 0.3, d * (0.3 if mayor else 0.16), 0.4 if mayor else 0.28))
        if mayor:
            labels.append((f"{v:g}", 0.8, z, max(2.2, d * 0.13)))
    c.add_graduations(tube, outer, ticks, labels)
    return tube


def aforado(ml, d, h, neck):
    r, n = d / 2, neck / 2
    cuerpo = h * 0.42
    outer = [(0.0, 0.0), (r * 0.55, 0.0)] + arc(0.0, cuerpo * 0.52, r, -55, 62, 10) + [(n + 0.6, cuerpo + 12), (n, cuerpo + 22),
                                                                                         (n, h - 6), (n + 2.2, h - 2), (n + 2.4, h)]
    name = f"SM_VolFlask_{ml}"
    obj = vessel(name, outer, 1.4, 2.2)
    # Enrase: una marca que rodea el cuello a la altura del volumen nominal.
    z = c.height_for_ml(c.INNER[name], ml)
    c.add_graduations(obj, outer, [(z, -math.pi * n, 2 * math.pi * n, 0.35)], [(f"{ml} mL", -9.0, cuerpo * 0.62, 5.0)])
    return obj


def box(bm, centro, medidas):
    escala = Matrix.Diagonal(Vector((medidas[0] * MM, medidas[1] * MM, medidas[2] * MM, 1.0)))
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation(Vector(centro) * MM) @ escala)


def capsule(bm, a, b, radius):
    a, b = Vector(a) * MM, Vector(b) * MM
    eje = b - a
    giro = Vector((0, 0, 1)).rotation_difference(eje.normalized()).to_matrix().to_4x4()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=radius * MM, radius2=radius * MM, depth=eje.length,
                          matrix=Matrix.Translation((a + b) / 2) @ giro)
    for p in (a, b):
        bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=radius * MM, matrix=Matrix.Translation(p))


def from_bmesh(name, bm, material_name):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat(material_name))
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    objs[0].name = objs[0].data.name = name
    return objs[0]


def build():
    piezas = []
    # Vasos de precipitados, forma baja.
    piezas += [beaker(50, 42, 60, (10, 20, 30, 40)), beaker(100, 50, 70, (20, 40, 60, 80)),
               beaker(250, 70, 95, (50, 100, 150, 200)), beaker(500, 85, 120, (100, 200, 300, 400))]
    piezas.append(erlenmeyer(250, 85, 145, 34, 112, (50, 100, 150, 200, 250)))
    piezas += [probeta(10, 13.5, 140, 36, 0.2), probeta(50, 25, 200, 52, 1.0)]
    piezas += [aforado(100, 62, 175, 13), aforado(250, 82, 225, 16)]

    # Tubo de ensayo de 16 x 150 mm.
    tubo = [(0.0, 0.0)] + arc(0.0, 8.0, 8.0, -90, 0, 8)[1:] + [(8.0, 147.0), (8.8, 150.0)]
    piezas.append(vessel("SM_TestTube", tubo, 1.0, 1.0, segments=32))

    # Embudo: cono de 75 mm y vástago; abierto por los dos extremos.
    ext = [(4.0, 0.0), (4.0, 70.0), (37.5, 125.0), (38.5, 127.0)]
    intr = [(37.0, 127.0), (36.0, 125.5), (2.8, 71.0), (2.8, 0.0)]
    embudo = c.lathe("SM_Funnel", ext + intr + [ext[0]], [], segments=48)
    embudo.data.materials.append(mat("M_Glass_Boro"))
    piezas.append(embudo)

    # Vidrio de reloj de 80 mm.
    vr = c.lathe("SM_WatchGlass", [(0.0, 0.0)] + arc(0.0, 105.0, 105.0, -90, -67.6, 8)[1:],
                 list(reversed(arc(0.0, 107.0, 105.0, -90, -68.0, 8)[1:])) + [(0.0, 2.0)], segments=48)
    vr.data.materials.append(mat("M_Glass_Boro"))
    piezas.append(vr)

    # Pipeta graduada de 10 mL, varilla y termómetro: macizos (sin canal interior).
    pipeta = solid("SM_Pipette_10", [(0.0, 0.0), (1.2, 0.0), (4.0, 28.0), (4.0, 330.0), (3.0, 350.0), (3.0, 360.0), (0.0, 360.0)], "M_Glass_Boro")
    c.add_graduations(pipeta, [(4.0, 0.0), (4.0, 360.0)], [(60.0 + i * 24.0, -3.0, 6.0 if i % 5 == 0 else 3.5, 0.3) for i in range(11)],
                      [(str(i), 3.6, 60.0 + (10 - i) * 24.0, 2.6) for i in (0, 5, 10)])
    piezas.append(pipeta)
    piezas.append(solid("SM_StirRod", [(0.0, 0.0)] + arc(0.0, 3.0, 3.0, -90, 0, 4)[1:] + [(3.0, 197.0)] + arc(0.0, 197.0, 3.0, 0, 90, 4)[1:], "M_Glass_Boro"))
    piezas.append(solid("SM_Thermometer", [(0.0, 0.0)] + arc(0.0, 4.0, 4.0, -90, 0, 4)[1:] + [(4.0, 14.0), (3.2, 20.0), (3.2, 297.0), (0.0, 300.0)], "M_Glass_Boro"))

    # Piseta de 500 mL: cuerpo de polietileno, tapa y tubo de salida doblado.
    cuerpo = solid("SM_WashBottle_500", [(0.0, 0.0)] + arc(31.5, 6.0, 6.0, -90, 0) + [(37.5, 120.0), (33.0, 140.0), (17.0, 152.0), (17.0, 160.0), (0.0, 160.0)], "M_HDPE", 48)
    tapa = solid("tapa", [(0.0, 158.0), (19.0, 158.0), (19.0, 174.0), (0.0, 174.0)], "M_Cap_PP_Blue")
    bm = bmesh.new()
    capsule(bm, (0.0, 0.0, 172.0), (0.0, 0.0, 205.0), 2.6)
    capsule(bm, (0.0, 0.0, 205.0), (62.0, 0.0, 180.0), 2.6)
    piezas.append(join([cuerpo, tapa, from_bmesh("tubo", bm, "M_HDPE")], "SM_WashBottle_500"))

    # Mortero de porcelana con su mano.
    mortero = [(0.0, 0.0), (28.0, 0.0)] + arc(0.0, 62.0, 56.0, -62, 0, 8) + [(57.0, 66.0)]
    piezas.append(vessel("SM_Mortar", mortero, 7.0, 9.0, material_name="M_Porcelain"))
    piezas.append(solid("SM_Pestle", [(0.0, 0.0)] + arc(0.0, 12.0, 12.0, -90, 10, 6)[1:] + [(7.0, 40.0), (8.5, 118.0)] + arc(0.0, 118.0, 8.5, 0, 90, 4)[1:], "M_Porcelain"))

    # Mechero Bunsen (sin llave ni manguera).
    piezas.append(solid("SM_Bunsen", [(0.0, 0.0), (36.0, 0.0), (36.0, 6.0), (12.0, 14.0), (9.0, 24.0), (9.0, 30.0), (6.5, 34.0), (6.5, 150.0), (5.0, 150.0), (5.0, 40.0), (0.0, 40.0)], "M_Metal"))

    # Gradilla para tubos: dos pares de barras entre las que se apoyan seis tubos de 16 mm.
    bm = bmesh.new()
    box(bm, (0, 0, 4), (190, 60, 8))
    for x in (-91, 91):
        box(bm, (x, 0, 45), (8, 60, 90))
    for z in (32, 80):
        for y in (-12.5, 12.5):
            box(bm, (0, y, z), (182, 7, 6))
    piezas.append(from_bmesh("SM_TestTubeRack", bm, "M_HDPE"))

    # Frasco cuentagotas de 30 mL (indicadores): vidrio ámbar y tapa con tetina.
    gotero = vessel("SM_DropperBottle_30", [(0.0, 0.0)] + arc(13.5, 3.0, 3.0, -90, 0) + [(16.5, 52.0), (9.0, 62.0), (9.0, 72.0)], 1.5, 2.0, material_name="M_Glass_Amber", segments=40)
    del c.INNER["SM_DropperBottle_30"]
    tetina = solid("tetina", [(0.0, 70.0), (10.5, 70.0), (10.5, 82.0), (6.0, 84.0), (7.5, 96.0), (5.0, 108.0), (0.0, 110.0)], "M_Black")
    piezas.append(join([gotero, tetina], "SM_DropperBottle_30"))

    # Tarro de boca ancha de 250 mL (sólidos): polietileno opaco con tapa.
    tarro = solid("SM_ReagentJar_250", [(0.0, 0.0)] + arc(29.0, 5.0, 5.0, -90, 0) + [(34.0, 82.0), (30.0, 88.0), (30.0, 92.0), (0.0, 92.0)], "M_HDPE", 48)
    tapa_tarro = solid("tapa_tarro", [(0.0, 90.0), (32.5, 90.0), (32.5, 104.0), (30.0, 106.0), (0.0, 106.0)], "M_Cap_PP_Blue", 48)
    piezas.append(join([tarro, tapa_tarro], "SM_ReagentJar_250"))

    # Navecilla de pesar: platillo de plástico de 80 mm.
    piezas.append(vessel("SM_WeighBoat", [(0.0, 0.0), (30.0, 0.0), (40.0, 16.0), (41.0, 18.0)], 1.2, 1.2, material_name="M_HDPE", segments=40))
    del c.INNER["SM_WeighBoat"]

    # Grifo de cuello de cisne para los lavamanos (decorativo).
    bm = bmesh.new()
    capsule(bm, (0, 0, 0), (0, 0, 200), 9.0)
    puntos = [(0, 0, 200)] + [(70 - 70 * math.cos(math.radians(a)), 0, 200 + 70 * math.sin(math.radians(a))) for a in range(15, 181, 15)] + [(140, 0, 170)]
    for a, b in zip(puntos, puntos[1:]):
        capsule(bm, a, b, 8.0)
    capsule(bm, (0, -38, 30), (0, 38, 30), 5.0)
    box(bm, (0, 0, 6), (46, 46, 12))
    piezas.append(from_bmesh("SM_Faucet", bm, "M_Metal"))
    return piezas


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = (Path(args[0]) if args else Path("art/export")).resolve()
    out.mkdir(parents=True, exist_ok=True)
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    piezas = build()
    for obj in piezas:
        for p in obj.data.polygons:
            p.use_smooth = obj.name not in ("SM_TestTubeRack",)
        d = obj.dimensions
        tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
        inner = c.INNER.get(obj.name)
        print(f"PIEZA {obj.name} mm=({d.x*1000:.0f}, {d.y*1000:.0f}, {d.z*1000:.0f}) tris={tris} "
              f"capacidad_ml={'-' if not inner else round(c.capacity_ml(inner), 1)} materiales={[m.name for m in obj.data.materials]}")
        c.export(obj, out)
    # Añade los perfiles interiores nuevos a los que ya escribió cristaleria_cloruros.py.
    ruta = out / "perfiles_interiores.json"
    perfiles = json.loads(ruta.read_text(encoding="utf-8")) if ruta.exists() else {}
    for name, pts in c.INNER.items():
        perfiles[name] = [[round(r, 4), round(z, 4)] for r, z in c.by_height(pts)]
    ruta.write_text(json.dumps(perfiles, indent=1), encoding="utf-8")
    if "--render" in args:
        scene = bpy.context.scene
        for i, obj in enumerate(piezas):
            obj.location = ((i % 6) * 0.13 - 0.33, (i // 6) * 0.16 - 0.24, 0)
            obj.rotation_euler.z = -math.pi / 2
        bpy.ops.mesh.primitive_plane_add(size=4.0)
        bpy.context.object.data.materials.append(c.material("Suelo", (0.03, 0.035, 0.04, 1), glass=False, roughness=0.2))
        world = bpy.data.worlds.new("Mundo")
        world.use_nodes = True
        world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.75, 0.78, 0.8, 1)
        scene.world = world
        luz = bpy.data.objects.new("Luz", bpy.data.lights.new("Luz", "AREA"))
        luz.data.energy, luz.data.size = 150, 1.2
        luz.location, luz.rotation_euler = (0.2, -0.5, 1.0), (math.radians(30), math.radians(10), 0)
        scene.collection.objects.link(luz)
        cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
        cam.data.lens = 40
        cam.location, cam.rotation_euler = (0.0, -1.05, 0.62), (math.radians(64), 0, 0)
        scene.collection.objects.link(cam)
        scene.camera = cam
        scene.render.engine = "CYCLES"
        scene.cycles.samples, scene.cycles.device = 48, "CPU"
        scene.render.resolution_x, scene.render.resolution_y = 1280, 720
        scene.render.filepath = str(out / "instrumentos_preview.png")
        bpy.ops.render.render(write_still=True)
    print("EXPORT_OK")


if __name__ == "__main__":
    main()
