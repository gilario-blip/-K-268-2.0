import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { jerseyTexture } from './textures.js';

// Edi: vorbereiteter, stilisierter Avatar im manuellen Rollstuhl (68 × 110 cm).
// Vorwärts = +z. Ursprung am Boden in der Mitte des Rollstuhls.

const SKIN = 0xe8c2a0;
const WHEEL_R = 0.3;

const mat = (color, rough = 0.6, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

function tube(a, b, r, m, seg = 8) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.translate(0, len / 2, 0);
  const mesh = new THREE.Mesh(g, m);
  mesh.position.copy(a);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

function limb(len, r, m) {
  // Glied, das vom Ursprung nach unten (-y) zeigt
  const g = new THREE.CapsuleGeometry(r, len, 4, 10);
  g.translate(0, -len / 2, 0);
  return new THREE.Mesh(g, m);
}

function wheel(m) {
  const group = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R - 0.018, 0.02, 10, 40), m.rubber);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R - 0.045, 0.01, 6, 40), m.alu);
  const push = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R - 0.03, 0.008, 6, 40), m.chrome);
  push.position.z = 0.035;
  const spokes = [];
  for (let i = 0; i < 12; i++) {
    const g = new THREE.CylinderGeometry(0.0025, 0.0025, WHEEL_R - 0.05, 4);
    g.translate(0, (WHEEL_R - 0.05) / 2, 0);
    g.rotateZ((i / 12) * Math.PI * 2);
    spokes.push(g);
  }
  const spokeMesh = new THREE.Mesh(mergeGeometries(spokes), m.chrome);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 12).rotateX(Math.PI / 2), m.alu);
  group.add(tire, rim, push, spokeMesh, hub);
  // Rad steht in der YZ-Ebene: um Y drehen, damit die Achse auf X liegt
  group.rotation.y = Math.PI / 2;
  const holder = new THREE.Group();
  holder.add(group);
  holder.userData.spin = group;
  return holder;
}

function hairCurls(colors, count, seed = 1) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const byColor = colors.map(() => []);
  for (let i = 0; i < count; i++) {
    // obere und hintere Kopfhälfte
    const u = rand() * Math.PI * 2;
    const v = Math.acos(1 - rand() * 1.15);
    const dir = new THREE.Vector3(Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u));
    if (dir.z > 0.55 && dir.y < 0.55) continue; // Gesicht freilassen
    const r = 0.022 + rand() * 0.013;
    const g = new THREE.IcosahedronGeometry(r, 1);
    const p = dir.multiplyScalar(0.1 + r * 0.45);
    g.translate(p.x, p.y * 1.08, p.z);
    byColor[Math.floor(rand() * colors.length)].push(g);
  }
  const group = new THREE.Group();
  byColor.forEach((geos, i) => {
    if (geos.length) group.add(new THREE.Mesh(mergeGeometries(geos), mat(colors[i], 0.75)));
  });
  return group;
}

export function createEdi() {
  const m = {
    rubber: mat(0x16171a, 0.85),
    alu: mat(0x2b3442, 0.35, 0.8),
    chrome: mat(0xd3d8de, 0.2, 1),
    frame: mat(0x1d4fa8, 0.35, 0.7),
    seat: mat(0x16181d, 0.8),
    skin: mat(SKIN, 0.65),
    pants: mat(0x1c1e25, 0.8),
    shoes: mat(0xf2f2f2, 0.5),
    jersey: new THREE.MeshStandardMaterial({ map: jerseyTexture('EDI', '18', '#cf1f2a', '#121212'), roughness: 0.7 }),
    red: mat(0xcf1f2a, 0.7),
    dark: mat(0x121212, 0.6),
  };
  const root = new THREE.Group();
  root.name = 'edi';
  const chair = new THREE.Group();
  root.add(chair);

  // Hinterräder (aussen 68 cm)
  const wheels = [];
  for (const sx of [-1, 1]) {
    const w = wheel(m);
    w.position.set(sx * 0.3, WHEEL_R, -0.25);
    w.rotation.y = sx > 0 ? 0 : Math.PI;
    w.rotation.z = sx * 0.04; // leichter Sturz
    chair.add(w);
    w.userData.spin.userData.sign = sx; // beide Räder drehen in Fahrtrichtung
    wheels.push(w.userData.spin);
  }
  // Lenkräder vorne
  const casters = [];
  for (const sx of [-1, 1]) {
    const c = new THREE.Group();
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.03, 16).rotateZ(Math.PI / 2), m.rubber);
    wh.position.y = 0.072;
    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.02), m.alu);
    fork.position.y = 0.13;
    c.add(wh, fork);
    c.position.set(sx * 0.19, 0, 0.36);
    chair.add(c);
    casters.push(wh);
  }
  // Rahmen
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  for (const sx of [-1, 1]) {
    chair.add(tube(V(sx * 0.2, 0.48, -0.3), V(sx * 0.2, 0.47, 0.32), 0.014, m.frame));
    chair.add(tube(V(sx * 0.2, 0.47, 0.32), V(sx * 0.17, 0.14, 0.45), 0.013, m.frame));
    chair.add(tube(V(sx * 0.19, 0.2, 0.36), V(sx * 0.2, 0.47, 0.3), 0.012, m.frame));
    chair.add(tube(V(sx * 0.2, 0.48, -0.3), V(sx * 0.21, 0.98, -0.36), 0.013, m.frame));
    chair.add(tube(V(sx * 0.2, 0.3, -0.25), V(sx * 0.2, 0.48, -0.25), 0.012, m.frame));
  }
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.17), m.alu);
  foot.position.set(0, 0.13, 0.47);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.42), m.seat);
  seat.position.set(0, 0.52, 0.0);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.04), m.seat);
  back.position.set(0, 0.77, -0.3);
  back.rotation.x = -0.1;
  chair.add(foot, seat, back);

  // Körper
  const body = new THREE.Group();
  root.add(body);
  for (const sx of [-1, 1]) {
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.33, 4, 10).rotateX(Math.PI / 2), m.pants);
    thigh.position.set(sx * 0.1, 0.62, 0.13);
    const shin = limb(0.36, 0.062, m.pants);
    shin.position.set(sx * 0.1, 0.6, 0.33);
    shin.rotation.x = 0.18;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.24), m.shoes);
    shoe.position.set(sx * 0.1, 0.18, 0.47);
    body.add(thigh, shin, shoe);
  }
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.24, 6, 16), m.jersey);
  torso.scale.set(1.12, 1, 0.74);
  torso.position.set(0, 0.79, -0.12);
  torso.rotation.x = 0.05;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 16).rotateX(Math.PI / 2), m.dark);
  collar.position.set(0, 1.035, -0.12);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 12), m.skin);
  neck.position.set(0, 1.05, -0.11);
  body.add(torso, collar, neck);

  // Kopf mit blonden Locken
  const head = new THREE.Group();
  head.position.set(0, 1.15, -0.1);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 18), m.skin);
  skull.scale.set(0.95, 1.1, 1);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), m.skin);
  nose.position.set(0, -0.005, 0.1);
  const eyeMat = mat(0x2a2320, 0.4);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), eyeMat);
    eye.position.set(sx * 0.035, 0.02, 0.091);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), m.skin);
    ear.position.set(sx * 0.094, 0.0, -0.005);
    ear.scale.set(0.5, 1, 0.8);
    head.add(eye, ear);
  }
  head.add(skull, nose, hairCurls([0xd9b25c, 0xc99f45, 0xe8c675], 190, 7));
  body.add(head);

  // Arme mit Greifbewegung an den Greifreifen
  const arms = [];
  for (const sx of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(sx * 0.2, 0.98, -0.12);
    const upper = limb(0.2, 0.05, m.skin);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.058, 0.13, 12), m.red);
    sleeve.position.y = -0.05;
    const elbow = new THREE.Group();
    elbow.position.y = -0.26;
    const fore = limb(0.2, 0.043, m.skin);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), m.skin);
    hand.position.y = -0.26;
    elbow.add(fore, hand);
    shoulder.add(upper, sleeve, elbow);
    shoulder.rotation.z = sx * 0.32;
    body.add(shoulder);
    arms.push({ shoulder, elbow, sx });
  }

  // Weicher Schatten
  root.add(blobShadow(0.9, 1.3));

  let phase = 0;
  let wheelAngle = 0;
  const api = {
    root,
    head,
    // bewegt Räder und Arme passend zur gefahrenen Strecke
    move(distance) {
      wheelAngle += distance / WHEEL_R;
      for (const w of wheels) w.rotation.z = wheelAngle * w.userData.sign;
      for (const c of casters) c.rotation.x += distance / 0.072;
      phase += distance * 2.4;
    },
    update(dt, moving) {
      const k = moving ? 1 : 0;
      for (const a of arms) {
        const target = -0.25 + Math.sin(phase) * 0.45 * k;
        a.shoulder.rotation.x += (target - a.shoulder.rotation.x) * Math.min(1, dt * 10);
        const el = 0.55 + Math.cos(phase) * 0.35 * k;
        a.elbow.rotation.x = el;
      }
    },
    setHeadVisible(v) {
      head.visible = v;
    },
  };
  api.update(0, false);
  return api;
}

export function blobShadow(w, d) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
  );
  m.position.y = 0.012;
  m.renderOrder = 1;
  return m;
}

/* ---------- Weitere Personen ---------- */
// Sitzende Person (z. B. Maxim auf dem Begleitsitz). Ursprung am Boden vor dem Sitz.
export function createSeatedPerson({ shirt = 0x1f5fbf, pants = 0x22252c, hair = 0x16130f, skin = SKIN, straightHair = true } = {}) {
  const g = new THREE.Group();
  const m = { shirt: mat(shirt, 0.7), pants: mat(pants, 0.8), skin: mat(skin, 0.65), hair: mat(hair, 0.8), shoes: mat(0x2a2a2a, 0.6) };
  for (const sx of [-1, 1]) {
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.32, 4, 10).rotateX(Math.PI / 2), m.pants);
    thigh.position.set(sx * 0.1, 0.5, 0.12);
    const shin = limb(0.36, 0.06, m.pants);
    shin.position.set(sx * 0.1, 0.5, 0.32);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.24), m.shoes);
    shoe.position.set(sx * 0.1, 0.05, 0.38);
    g.add(thigh, shin, shoe);
  }
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.28, 6, 14), m.shirt);
  torso.scale.set(1.1, 1, 0.72);
  torso.position.set(0, 0.74, -0.05);
  g.add(torso);
  for (const sx of [-1, 1]) {
    const arm = limb(0.36, 0.05, m.shirt);
    arm.position.set(sx * 0.21, 0.96, -0.05);
    arm.rotation.x = -0.5;
    arm.rotation.z = sx * 0.1;
    g.add(arm);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), m.skin);
  head.scale.set(0.95, 1.1, 1);
  head.position.set(0, 1.13, -0.04);
  g.add(head);
  if (straightHair) {
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.108, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), m.hair);
    hairCap.scale.set(0.98, 1.1, 1.04);
    hairCap.position.set(0, 1.14, -0.045);
    const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.05, 0.04), m.hair);
    fringe.position.set(0, 1.205, 0.06);
    fringe.rotation.x = 0.4;
    g.add(hairCap, fringe);
  }
  return g;
}

// Stehende Person (Personal, Fans auf dem Vorplatz). Ursprung am Boden.
export function createStandingPerson({ shirt = 0x334466, pants = 0x22252c, hair = 0x2a2018, skin = SKIN, vest = null } = {}) {
  const g = new THREE.Group();
  const m = { shirt: mat(shirt, 0.7), pants: mat(pants, 0.8), skin: mat(skin, 0.65), hair: mat(hair, 0.8) };
  for (const sx of [-1, 1]) {
    const leg = limb(0.72, 0.07, m.pants);
    leg.position.set(sx * 0.1, 0.86, 0);
    g.add(leg);
  }
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.36, 6, 14), vest ? mat(vest, 0.5) : m.shirt);
  torso.scale.set(1.1, 1, 0.7);
  torso.position.y = 1.2;
  g.add(torso);
  for (const sx of [-1, 1]) {
    const arm = limb(0.5, 0.05, m.shirt);
    arm.position.set(sx * 0.24, 1.43, 0);
    arm.rotation.z = sx * 0.12;
    g.add(arm);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 12), m.skin);
  head.scale.set(0.95, 1.1, 1);
  head.position.y = 1.62;
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.112, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), m.hair);
  hairCap.position.y = 1.64;
  g.add(head, hairCap);
  if (vest) {
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.195, 0.04, 16), mat(0xdfe3e8, 0.3, 0.3));
    stripe.scale.set(1.08, 1, 0.72);
    stripe.position.y = 1.12;
    g.add(stripe);
  }
  return g;
}
