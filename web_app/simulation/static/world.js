import * as THREE from '/vendor/three.module.js';
import { heightAt } from './terrain.js';

const material = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.95, ...extra });
function mesh(parent, geometry, color, x = 0, y = 0, z = 0, extra = {}) {
  const item = new THREE.Mesh(geometry, material(color, extra));
  item.position.set(x, y, z);
  item.castShadow = true;
  item.receiveShadow = true;
  parent.add(item);
  return item;
}
function box(parent, w, h, d, color, x, y, z) {
  return mesh(parent, new THREE.BoxGeometry(w, h, d), color, x, y, z);
}
function tag(parent, text, x, y, z, size = 2.5) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 100;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f6f5eb';
  ctx.fillRect(0, 0, 512, 100);
  ctx.fillStyle = '#293b2b';
  ctx.font = '600 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 256, 62);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      toneMapped: false,
    }),
  );
  sprite.position.set(x, y, z);
  sprite.scale.set(size, (size * 100) / 512, 1);
  parent.add(sprite);
  return sprite;
}
function dispose(group) {
  group.traverse((item) => {
    item.geometry?.dispose();
    for (const mat of Array.isArray(item.material)
      ? item.material
      : item.material
        ? [item.material]
        : []) {
      mat.map?.dispose();
      mat.dispose();
    }
  });
  group.removeFromParent();
}

export class OffroadWorld {
  constructor(canvas, container) {
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.camera = new THREE.PerspectiveCamera(43, 1, 0.08, 280);
    this.scene.add(new THREE.HemisphereLight('#edf3ed', '#69705b', 2.3));
    this.sun = new THREE.DirectionalLight('#fff4dc', 3);
    this.sun.position.set(-25, 45, 10);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -35,
      right: 35,
      top: 35,
      bottom: -35,
    });
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun);
    this.view = 'overview';
    this.orbit = 0.8;
    this.elevation = 0.9;
    this.zoom = 75;
    this.revision = null;
    this.lastTime = 0;
    new ResizeObserver(() => {
      this.renderer.setSize(
        container.clientWidth,
        container.clientHeight,
        false,
      );
      this.camera.aspect = container.clientWidth / container.clientHeight;
      this.camera.updateProjectionMatrix();
    }).observe(container);
    let dragging = false,
      lastX = 0,
      lastY = 0;
    canvas.addEventListener('pointerdown', (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointerup', () => (dragging = false));
    canvas.addEventListener('pointercancel', () => (dragging = false));
    canvas.addEventListener('pointermove', (e) => {
      if (dragging && this.view === 'overview') {
        this.orbit -= (e.clientX - lastX) * 0.006;
        this.elevation = Math.max(
          0.25,
          Math.min(1.4, this.elevation + (e.clientY - lastY) * 0.004),
        );
      }
      lastX = e.clientX;
      lastY = e.clientY;
    });
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoom = Math.max(24, Math.min(105, this.zoom + e.deltaY * 0.025));
      },
      { passive: false },
    );
    requestAnimationFrame((time) => this.render(time));
  }
  ground(x, z) {
    return heightAt(this.environment.config, x, z);
  }
  line(points, color, dashed = false) {
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map(([x, z]) => new THREE.Vector3(x, this.ground(x, z) + 0.09, z)),
    );
    const item = new THREE.Line(
      geometry,
      dashed
        ? new THREE.LineDashedMaterial({ color, dashSize: 0.4, gapSize: 0.25 })
        : new THREE.LineBasicMaterial({ color }),
    );
    if (dashed) item.computeLineDistances();
    this.group.add(item);
    return item;
  }
  ribbon(points, width, color, opacity = 1) {
    const vertices = [];
    for (let i = 1; i < points.length; i++) {
      const [ax, az] = points[i - 1],
        [bx, bz] = points[i];
      const length = Math.hypot(bx - ax, bz - az),
        steps = Math.max(1, Math.ceil(length / 0.45));
      const nx = ((-(bz - az) / (length || 1)) * width) / 2,
        nz = (((bx - ax) / (length || 1)) * width) / 2;
      for (let step = 0; step < steps; step++) {
        const quad = [];
        for (const [t, side] of [
          [step / steps, -1],
          [step / steps, 1],
          [(step + 1) / steps, 1],
          [(step + 1) / steps, -1],
        ]) {
          const x = ax + (bx - ax) * t + nx * side,
            z = az + (bz - az) * t + nz * side;
          quad.push([x, this.ground(x, z) + 0.045, z]);
        }
        for (const index of [0, 1, 2, 0, 2, 3]) vertices.push(...quad[index]);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.computeVertexNormals();
    const item = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: opacity < 1,
        opacity,
      }),
    );
    this.group.add(item);
    return item;
  }
  build(state) {
    if (this.group) dispose(this.group);
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.environment = state.environment;
    this.revision = state.environment_revision;
    const { config, colors, bounds } = this.environment;
    this.scene.background = new THREE.Color(colors.sky);
    this.scene.fog = new THREE.Fog(
      colors.sky,
      config.weather === 'mist' ? 30 : 65,
      config.weather === 'mist' ? 105 : 170,
    );
    this.sun.intensity = config.weather === 'rain' ? 1.2 : 3;
    const geometry = new THREE.PlaneGeometry(
      bounds[0] * 2,
      bounds[1] * 2,
      96,
      80,
    );
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position,
      shades = [];
    const low = new THREE.Color(colors.ground),
      high = new THREE.Color(colors.high);
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        z = positions.getZ(i),
        h = this.ground(x, z);
      positions.setY(i, h);
      const shade = low
        .clone()
        .lerp(
          high,
          Math.max(0, Math.min(0.9, h / (config.relief * 1.8 + 0.5))),
        );
      shade.multiplyScalar(
        0.96 + 0.055 * Math.sin(x * 13.37 + z * 7.13 + config.seed),
      );
      shades.push(shade.r, shade.g, shade.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(shades, 3));
    geometry.computeVertexNormals();
    const ground = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        flatShading: true,
      }),
    );
    ground.receiveShadow = true;
    this.group.add(ground);
    // A closed earth section makes the height field read as terrain, not a floating sheet.
    const skirt = [];
    for (const [ax, az, bx, bz] of [
      [-24, -20, 24, -20],
      [24, -20, 24, 20],
      [24, 20, -24, 20],
      [-24, 20, -24, -20],
    ]) {
      for (let i = 0; i < 96; i++) {
        const x = ax + ((bx - ax) * i) / 96,
          z = az + ((bz - az) * i) / 96,
          nx = ax + ((bx - ax) * (i + 1)) / 96,
          nz = az + ((bz - az) * (i + 1)) / 96;
        const p = [
          [x, -2, z],
          [x, this.ground(x, z), z],
          [nx, this.ground(nx, nz), nz],
          [nx, -2, nz],
        ];
        for (const j of [0, 1, 2, 0, 2, 3]) skirt.push(...p[j]);
      }
    }
    const skirtGeometry = new THREE.BufferGeometry();
    skirtGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(skirt, 3),
    );
    skirtGeometry.computeVertexNormals();
    mesh(
      this.group,
      skirtGeometry,
      config.profile === 'rocky' ? '#8e775d' : '#626853',
      0,
      0,
      0,
      { side: THREE.DoubleSide },
    );
    for (const [x, z, w, d, h, color, kind] of state.objects) {
      const y = this.ground(x, z);
      if (kind === 'tree') {
        mesh(
          this.group,
          new THREE.CylinderGeometry(w * 0.1, w * 0.14, h * 0.7, 6),
          '#66563f',
          x,
          y + h * 0.35,
          z,
        );
        for (const [scale, level] of [
          [1, 0.53],
          [0.78, 0.73],
        ])
          mesh(
            this.group,
            new THREE.ConeGeometry(w * 0.7 * scale, h * 0.65, 7),
            level > 0.6 ? '#3b5940' : '#304b34',
            x,
            y + h * level,
            z,
          );
      } else {
        const rock = mesh(
          this.group,
          new THREE.DodecahedronGeometry(1, 0),
          color,
          x,
          y + h * 0.43,
          z,
        );
        rock.scale.set(w * 0.5, h * 0.6, d * 0.5);
        rock.rotation.y = Math.sin(x * 4 + z) * 0.25;
      }
    }
    // Low vegetation is decorative; every tree and boulder above is collision geometry.
    if (config.profile === 'forest') {
      for (let i = 0; i < 180; i++) {
        const x = Math.sin(i * 132.4 + config.seed) * 23,
          z = Math.cos(i * 47.5) * 19;
        mesh(
          this.group,
          new THREE.ConeGeometry(0.16, 0.3, 3),
          '#647845',
          x,
          this.ground(x, z) + 0.1,
          z,
        );
      }
    }
    const route = [
      this.environment.start,
      ...state.waypoints.map((p) => [p.x, p.y]),
    ];
    this.ribbon(route, 2.5, colors.trail, 0.45);
    this.ribbon(route, 0.09, '#f1e6bd');
    this.markers = [];
    state.waypoints.forEach((p, i) => {
      const height = this.ground(p.x, p.y);
      const ring = mesh(
        this.group,
        new THREE.TorusGeometry(0.65, 0.045, 5, 32),
        '#e5dab5',
        p.x,
        height + 0.12,
        p.y,
      );
      ring.rotation.x = -Math.PI / 2;
      this.markers.push(ring);
      mesh(
        this.group,
        new THREE.CylinderGeometry(0.035, 0.035, 1.6, 5),
        '#e9e6d6',
        p.x,
        height + 0.8,
        p.y,
      );
      tag(this.group, String(i + 1), p.x, height + 2, p.y, 1.05);
    });
    const [sx, sz] = this.environment.start;
    tag(this.group, 'BASE CAMP', sx, this.ground(sx, sz) + 0.6, sz - 2.8, 3.4);
    this.trail = this.line([], '#304a31');
    this.detour = null;
    this.obstacle = mesh(
      this.group,
      new THREE.DodecahedronGeometry(0.7, 0),
      '#c18a4b',
      0,
      0,
      0,
    );
    this.obstacle.visible = false;
    this.rover = new THREE.Group();
    this.group.add(this.rover);
    this.body = new THREE.Group();
    this.rover.add(this.body);
    box(this.body, 1.35, 0.28, 0.87, '#354633', 0, 0.5, 0);
    box(this.body, 1.12, 0.14, 0.8, '#899373', -0.06, 0.71, 0);
    box(this.body, 0.62, 0.18, 0.62, '#506147', -0.15, 0.87, 0);
    for (const x of [-0.72, 0.72])
      box(this.body, 0.09, 0.1, 1.02, '#252f26', x, 0.45, 0);
    for (const z of [-0.27, 0.27])
      box(this.body, 0.035, 0.09, 0.17, '#e5ecca', 0.78, 0.61, z);
    box(this.body, 0.07, 0.66, 0.07, '#30392f', -0.38, 1.17, 0);
    box(this.body, 0.22, 0.17, 0.4, '#273329', -0.38, 1.52, 0);
    mesh(
      this.body,
      new THREE.CylinderGeometry(0.06, 0.06, 0.06, 12),
      '#182322',
      -0.25,
      1.53,
      0,
    ).rotation.z = Math.PI / 2;
    this.beacon = mesh(
      this.body,
      new THREE.SphereGeometry(0.075, 12, 8),
      '#a4d566',
      -0.38,
      1.67,
      0,
      { emissive: '#6b913b', emissiveIntensity: 0.6 },
    );
    tag(this.rover, 'NAVIGEN 01', 0, 2.2, 0, 2.7);
    this.wheels = [];
    for (const side of [-1, 1])
      for (const x of [-0.43, 0.43]) {
        const assembly = new THREE.Group();
        this.rover.add(assembly);
        assembly.position.set(x, 0.3, side * 0.53);
        const tire = mesh(
          assembly,
          new THREE.CylinderGeometry(0.3, 0.3, 0.24, 16),
          '#272b26',
          0,
          0,
          0,
        );
        tire.rotation.x = Math.PI / 2;
        mesh(
          assembly,
          new THREE.CylinderGeometry(0.13, 0.13, 0.255, 12),
          '#8c947e',
          0,
          0,
          0,
        ).rotation.x = Math.PI / 2;
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2;
          const tread = box(
            assembly,
            0.1,
            0.06,
            0.255,
            '#33382e',
            Math.cos(angle) * 0.3,
            Math.sin(angle) * 0.3,
            0,
          );
          tread.rotation.z = angle - Math.PI / 2;
        }
        this.wheels.push({ assembly, x, z: side * 0.53 });
      }
    this.rover.position.set(
      state.position_x,
      state.position_z,
      state.position_y,
    );
    const rainGeometry = new THREE.BufferGeometry(),
      rain = [];
    for (let i = 0; i < 500; i++)
      rain.push(
        Math.sin(i * 12.8) * 24,
        Math.cos(i * 8.1) * 8 + 15,
        Math.sin(i * 7.3) * 20,
      );
    rainGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(rain, 3),
    );
    this.rain = new THREE.Points(
      rainGeometry,
      new THREE.PointsMaterial({
        color: '#d3e0df',
        size: 0.07,
        transparent: true,
        opacity: 0.6,
      }),
    );
    this.rain.visible = config.weather === 'rain';
    this.group.add(this.rain);
  }
  update(state) {
    this.state = state;
    if (this.revision !== state.environment_revision) this.build(state);
    this.obstacle.visible = !!state.obstacle;
    if (state.obstacle)
      this.obstacle.position.set(
        state.obstacle.x,
        this.ground(state.obstacle.x, state.obstacle.y) + 0.4,
        state.obstacle.y,
      );
    this.trail.geometry.dispose();
    this.trail.geometry = new THREE.BufferGeometry().setFromPoints(
      state.trail.map(
        ([x, z]) => new THREE.Vector3(x, this.ground(x, z) + 0.1, z),
      ),
    );
    if (this.detour) dispose(this.detour);
    this.detour = state.avoidance_path.length
      ? this.ribbon(
          [[state.position_x, state.position_y], ...state.avoidance_path],
          0.17,
          '#e9a32b',
        )
      : null;
    this.markers.forEach((marker, i) =>
      marker.material.color.set(
        i < state.target_index
          ? '#6c9864'
          : i === state.target_index
            ? '#f7d779'
            : '#ded8b8',
      ),
    );
  }
  render(time) {
    const dt = Math.min(0.1, (time - this.lastTime) / 1000);
    this.lastTime = time;
    const s = this.state;
    if (s && this.rover) {
      const blend = 1 - Math.exp(-12 * dt);
      this.rover.position.lerp(
        new THREE.Vector3(s.position_x, s.position_z, s.position_y),
        blend,
      );
      let angle =
        THREE.MathUtils.euclideanModulo(
          -s.yaw - this.rover.rotation.y + Math.PI,
          Math.PI * 2,
        ) - Math.PI;
      this.rover.rotation.y += angle * blend;
      this.body.rotation.z += (s.pitch - this.body.rotation.z) * blend;
      this.body.rotation.x += (-s.roll - this.body.rotation.x) * blend;
      const { x, z } = this.rover.position,
        alt = this.rover.position.y;
      for (const wheel of this.wheels) {
        const wx = x + Math.cos(s.yaw) * wheel.x - Math.sin(s.yaw) * wheel.z;
        const wz = z + Math.sin(s.yaw) * wheel.x + Math.cos(s.yaw) * wheel.z;
        wheel.assembly.position.y = this.ground(wx, wz) - alt + 0.3;
        wheel.assembly.rotation.z -= (s.linear_velocity * dt) / 0.3;
      }
      this.beacon.material.color.set(
        s.status === 'emergency_stop'
          ? '#e96e47'
          : s.status === 'avoiding'
            ? '#e7b94f'
            : '#a4d566',
      );
      this.rover.visible = this.view !== 'driver';
      if (this.view === 'follow') {
        this.camera.position.lerp(
          new THREE.Vector3(
            x - Math.cos(s.yaw) * 8,
            alt + 5.5,
            z - Math.sin(s.yaw) * 8,
          ),
          blend,
        );
        this.camera.lookAt(x, alt + 0.8, z);
      } else if (this.view === 'driver') {
        this.camera.position.set(
          x + Math.cos(s.yaw) * 0.8,
          alt + 1.25,
          z + Math.sin(s.yaw) * 0.8,
        );
        this.camera.up.set(
          -Math.sin(s.yaw) * Math.sin(s.roll),
          Math.cos(s.roll),
          Math.cos(s.yaw) * Math.sin(s.roll),
        );
        this.camera.lookAt(
          x + Math.cos(s.yaw) * 12,
          alt + 1.25 + Math.tan(s.pitch) * 12,
          z + Math.sin(s.yaw) * 12,
        );
      } else {
        this.camera.position.set(
          Math.cos(this.orbit) * this.zoom * Math.cos(this.elevation),
          this.zoom * Math.sin(this.elevation) + 3,
          Math.sin(this.orbit) * this.zoom * Math.cos(this.elevation),
        );
        this.camera.lookAt(0, 3, 0);
      }
      if (this.view !== 'driver') this.camera.up.set(0, 1, 0);
      if (this.rain.visible) {
        const positions = this.rain.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          let y = positions.getY(i) - dt * 9;
          if (y < 0) y = 25;
          positions.setY(i, y);
        }
        positions.needsUpdate = true;
      }
      this.renderer.render(this.scene, this.camera);
    }
    requestAnimationFrame((next) => this.render(next));
  }
}
