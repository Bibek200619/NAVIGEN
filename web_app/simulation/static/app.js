import * as THREE from '/vendor/three.module.js';
const $ = (selector) => document.querySelector(selector);
const TOKEN = 'navigen-local-simulation';
let state = null,
  connected = false,
  busy = false;
let graphicsError = false;
let scene,
  renderer,
  camera,
  rover,
  obstacleMesh,
  trail,
  detour,
  markers = [],
  wheels = [],
  beacon;
let view = 'overview',
  orbit = 0.78,
  elevation = 1.04,
  zoom = 31;
const world = $('#world');
const names = {
  idle: 'Ready',
  running: 'Inspecting',
  avoiding: 'Avoiding obstacle',
  paused: 'Paused',
  blocked: 'Obstacle detected',
  emergency_stop: 'E-stop active',
  completed: 'Complete',
};

function material(color, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.8,
    metalness: 0.12,
    ...extra,
  });
}
function box(w, h, d, color, x = 0, y = 0, z = 0, parent = scene) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function label(text, size = 2.4) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.fillStyle = '#f7f9f1';
  context.fillRect(0, 0, 512, 128);
  context.strokeStyle = '#bac9aa';
  context.lineWidth = 3;
  context.strokeRect(2, 2, 508, 124);
  context.fillStyle = '#40552f';
  context.font = '500 36px sans-serif';
  context.textAlign = 'center';
  context.fillText(text, 256, 78);
  const texture = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      toneMapped: false,
    }),
  );
  mesh.scale.set(size, size / 4, 1);
  return mesh;
}
function setupScene(initial) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#e2e9d9');
  camera = new THREE.PerspectiveCamera(43, 1, 0.1, 120);
  renderer = new THREE.WebGLRenderer({ canvas: $('#scene'), antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  scene.add(new THREE.HemisphereLight('#ffffff', '#8a9975', 2.5));
  const sun = new THREE.DirectionalLight('#fff7e8', 3.2);
  sun.position.set(-9, 20, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -17;
  sun.shadow.camera.right = 17;
  sun.shadow.camera.top = 17;
  sun.shadow.camera.bottom = -17;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  box(25, 0.18, 21, '#bfcbb0', 0, -0.14, 0);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 20),
    material('#d3ddc5'),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(24, 24, '#bac8aa', '#c4d1b5');
  grid.position.y = 0.008;
  scene.add(grid);
  box(24, 0.6, 0.16, '#a5b595', 0, 0.3, -10);
  box(0.16, 0.6, 20, '#a5b595', -12, 0.3, 0);
  box(0.16, 0.6, 20, '#a5b595', 12, 0.3, 0);
  for (const [x, z, w, d, h, color, kind] of initial.objects) {
    if (kind === 'rack') {
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          box(
            0.09,
            h,
            0.09,
            '#55684a',
            x + sx * (w / 2 - 0.06),
            h / 2,
            z + sz * (d / 2 - 0.06),
          );
      for (const y of [0.16, 1.2, 2.42]) box(w, 0.1, d, '#8c9e79', x, y, z);
      for (const y of [0.55, 1.65])
        for (const sx of [-0.58, 0.58]) {
          box(0.92, 0.72, 1.7, sx < 0 ? '#b4a67f' : '#bcad89', x + sx, y, z);
          box(0.08, 0.73, 1.71, '#d1c4a2', x + sx, y, z);
        }
    } else {
      box(w, h, d, color, x, h / 2, z);
      box(w + 0.03, 0.05, 0.08, '#dccaa3', x, h * 0.55, z + d / 2);
    }
  }
  // Mark the docking area, route, and inspection checkpoints.
  const dock = box(2.5, 0.025, 2.4, '#8ea976', -7, 0.02, -6);
  dock.receiveShadow = true;
  const dockLabel = label('CHARGING DOCK', 3);
  dockLabel.position.set(-7, 0.18, -8.2);
  scene.add(dockLabel);
  const storageLabel = label('STORAGE / A', 3.2);
  storageLabel.position.set(0, 3.2, 0);
  scene.add(storageLabel);
  const points = [
    new THREE.Vector3(-7, 0.035, -6),
    ...initial.waypoints.map((p) => new THREE.Vector3(p.x, 0.035, p.y)),
  ];
  const route = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineDashedMaterial({
      color: '#779b51',
      dashSize: 0.35,
      gapSize: 0.2,
    }),
  );
  route.computeLineDistances();
  scene.add(route);
  for (let i = 0; i < points.length - 1; i++) {
    const curve = new THREE.LineCurve3(points[i], points[i + 1]);
    const path = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 1, 0.035, 6, false),
      new THREE.MeshBasicMaterial({ color: '#769749' }),
    );
    scene.add(path);
  }
  initial.waypoints.forEach((p, i) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.43, 0.52, 40),
      new THREE.MeshBasicMaterial({ color: '#739652', side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.x, 0.04, p.y);
    scene.add(ring);
    markers.push(ring);
    const tag = label(String(i + 1), 0.7);
    tag.position.set(p.x, 1, p.y);
    scene.add(tag);
  });
  trail = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: '#476732' }),
  );
  scene.add(trail);
  detour = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineDashedMaterial({
      color: '#a86013',
      dashSize: 0.22,
      gapSize: 0.1,
    }),
  );
  scene.add(detour);
  rover = new THREE.Group();
  scene.add(rover);
  box(1.35, 0.3, 0.87, '#364b2a', 0, 0.42, 0, rover);
  box(1.12, 0.14, 0.8, '#71894f', -0.06, 0.64, 0, rover);
  box(0.68, 0.24, 0.65, '#50673d', -0.15, 0.83, 0, rover);
  box(0.16, 0.8, 0.13, '#36472d', -0.38, 1.12, 0, rover);
  box(0.26, 0.17, 0.48, '#26331f', -0.38, 1.52, 0, rover);
  for (const side of [-1, 1])
    for (const x of [-0.43, 0.43]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 0.22, 20),
        material('#283025'),
      );
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.28, side * 0.53);
      rover.add(wheel);
      wheels.push(wheel);
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.13, 0.23, 16),
        material('#94a77d'),
      );
      hub.rotation.x = Math.PI / 2;
      hub.position.copy(wheel.position);
      rover.add(hub);
    }
  for (const z of [-0.25, 0.25]) {
    box(0.045, 0.08, 0.13, '#d2e7b1', 0.685, 0.5, z, rover);
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.04, 16),
      material('#151c11'),
    );
    lens.rotation.z = Math.PI / 2;
    lens.position.set(0.7, 0.64, z);
    rover.add(lens);
  }
  beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 16, 12),
    material('#b0d866', { emissive: '#73983e', emissiveIntensity: 0.7 }),
  );
  beacon.position.set(-0.38, 1.67, 0);
  rover.add(beacon);
  const name = label('NAVIGEN 01', 1.7);
  name.position.set(0, 2.1, 0);
  rover.add(name);
  obstacleMesh = new THREE.Group();
  box(1.1, 0.65, 1.1, '#c48642', 0, 0.325, 0, obstacleMesh);
  box(1.12, 0.15, 1.12, '#e5b259', 0, 0.73, 0, obstacleMesh);
  const obstacleTag = label('TEST OBSTACLE', 2.2);
  obstacleTag.position.set(0, 1.5, 0);
  obstacleMesh.add(obstacleTag);
  obstacleMesh.visible = false;
  scene.add(obstacleMesh);
  rover.position.set(initial.position_x, 0, initial.position_y);
  const resize = () => {
    const width = world.clientWidth,
      height = world.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(world);
  resize();
  let dragging = false,
    lastX = 0,
    lastY = 0;
  $('#scene').addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    $('#scene').setPointerCapture(e.pointerId);
  });
  $('#scene').addEventListener('pointerup', () => (dragging = false));
  $('#scene').addEventListener('pointercancel', () => (dragging = false));
  $('#scene').addEventListener('pointermove', (e) => {
    if (dragging && view === 'overview') {
      orbit -= (e.clientX - lastX) * 0.006;
      elevation = Math.max(
        0.35,
        Math.min(1.4, elevation + (e.clientY - lastY) * 0.004),
      );
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });
  $('#scene').addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zoom = Math.max(15, Math.min(42, zoom + e.deltaY * 0.015));
    },
    { passive: false },
  );
  requestAnimationFrame(render);
}
let previousFrame = 0;
function render(time) {
  const dt = Math.min(0.1, (time - previousFrame) / 1000);
  previousFrame = time;
  if (state && rover) {
    const blend = 1 - Math.exp(-14 * dt);
    rover.position.x += (state.position_x - rover.position.x) * blend;
    rover.position.z += (state.position_y - rover.position.z) * blend;
    let angle = (-state.yaw - rover.rotation.y + Math.PI) % (Math.PI * 2);
    if (angle < 0) angle += Math.PI * 2;
    angle -= Math.PI;
    rover.rotation.y += angle * blend;
    for (const wheel of wheels)
      wheel.rotation.y -= (state.linear_velocity * dt) / 0.28;
    const stopped = state.status === 'emergency_stop',
      blocked = ['blocked', 'avoiding'].includes(state.status);
    beacon.material.color.set(
      stopped ? '#dd6445' : blocked ? '#e7b54f' : '#a9d865',
    );
    beacon.material.emissive.set(
      stopped ? '#983b22' : blocked ? '#ac7429' : '#73983e',
    );
    const x = rover.position.x,
      z = rover.position.z;
    rover.visible = view !== 'driver';
    if (view === 'follow') {
      camera.position.lerp(
        new THREE.Vector3(
          x - Math.cos(state.yaw) * 6,
          4.5,
          z - Math.sin(state.yaw) * 6,
        ),
        blend,
      );
      camera.lookAt(x, 0.7, z);
    } else if (view === 'driver') {
      camera.position.set(
        x + Math.cos(state.yaw) * 0.8,
        0.95,
        z + Math.sin(state.yaw) * 0.8,
      );
      camera.lookAt(
        x + Math.cos(state.yaw) * 10,
        0.85,
        z + Math.sin(state.yaw) * 10,
      );
    } else {
      camera.position.set(
        Math.cos(orbit) * zoom * Math.cos(elevation),
        zoom * Math.sin(elevation),
        Math.sin(orbit) * zoom * Math.cos(elevation),
      );
      camera.lookAt(0, 0, 0);
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(render);
}
let lastEvent = '';
function update(next) {
  state = next;
  $('#status').textContent = names[state.status] || state.status;
  $('#status').className = `status ${state.status}`;
  const descriptions = {
    idle: 'Four checkpoints. One autonomous inspection. Start the guided demo to see the complete sequence.',
    running: `Navigating to ${state.waypoints[state.target_index]?.name || 'the dock'}. Tracking the inspection route.`,
    avoiding:
      'Turning around the obstacle, then rejoining the inspection route. The obstacle stays in place.',
    blocked: 'No clear detour to the checkpoint. Clear the path to continue.',
    paused: 'Inspection paused. Resume when you are ready.',
    emergency_stop:
      'The simulated emergency stop is active. Reset the simulation to begin again.',
    completed:
      'All four checkpoints reached. The vehicle is back at the dock. Inspection complete.',
  };
  $('#mission-description').textContent = descriptions[state.status];
  $('#speed').innerHTML =
    `${state.linear_velocity.toFixed(2)} <small>m/s</small>`;
  $('#battery').innerHTML =
    `${state.battery_level_pct.toFixed(0)} <small>%</small>`;
  $('#distance').innerHTML = `${state.distance_m.toFixed(1)} <small>m</small>`;
  $('#elapsed').textContent = `${Math.floor(state.elapsed_seconds / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(state.elapsed_seconds % 60)
    .toString()
    .padStart(2, '0')}`;
  $('#position').textContent =
    `${state.position_x.toFixed(2)}, ${state.position_y.toFixed(2)} m`;
  $('#heading').textContent =
    `${(((state.yaw * 180) / Math.PI + 360) % 360).toFixed(0)}°`;
  $('#safety').textContent = state.safety_state.replaceAll('_', ' ');
  $('#progress').value = state.progress_pct;
  $('#progress-number').textContent = `${Math.round(state.progress_pct)}%`;
  $('#progress-label').textContent = `${state.target_index} of 4 checkpoints`;
  $('#guided').disabled = busy || !connected || state.auto_demo;
  $('#start').disabled =
    busy || !connected || !['idle', 'paused'].includes(state.status);
  $('#pause').disabled =
    busy ||
    !connected ||
    !['running', 'avoiding', 'blocked'].includes(state.status);
  $('#obstacle').disabled =
    busy || !connected || state.status !== 'running' || !!state.obstacle;
  $('#clear').disabled = busy || !connected || !state.obstacle;
  $('#estop').disabled =
    busy || !connected || state.status === 'emergency_stop';
  document.querySelector('[data-command=reset]').disabled = busy || !connected;
  $('#waypoints').replaceChildren(
    ...state.waypoints.map((waypoint, i) => {
      const item = document.createElement('div');
      item.className = `waypoint ${i < state.target_index ? 'done' : i === state.target_index ? 'active' : ''}`;
      const number = document.createElement('span');
      number.className = 'number';
      number.textContent = i < state.target_index ? '✓' : String(i + 1);
      const title = document.createElement('span');
      title.textContent = waypoint.name;
      const small = document.createElement('small');
      small.textContent =
        i < state.target_index
          ? 'Reached'
          : i === state.target_index
            ? 'Next checkpoint'
            : 'Queued';
      title.append(small);
      item.append(number, title);
      return item;
    }),
  );
  const notice = $('#world-notice');
  notice.hidden =
    !graphicsError &&
    !['avoiding', 'blocked', 'emergency_stop', 'completed'].includes(
      state.status,
    );
  notice.textContent = graphicsError
    ? '3D rendering unavailable. Enable WebGL or try Chrome.'
    : state.status === 'avoiding'
      ? 'Avoiding obstacle · Following amber detour'
      : state.status === 'blocked'
        ? 'No clear detour · Clear path to continue'
        : state.status === 'emergency_stop'
          ? 'Simulated E-stop · Motion halted'
          : 'Inspection complete · Returned to dock';
  if (state.events[0]?.id !== lastEvent) {
    lastEvent = state.events[0]?.id;
    $('#events').replaceChildren(
      ...state.events.slice(0, 4).map((event) => {
        const li = document.createElement('li');
        li.className = event.level;
        const time = document.createElement('time');
        time.textContent = new Date(event.recorded_at).toLocaleTimeString();
        const text = document.createElement('span');
        text.textContent = event.message;
        li.append(time, text);
        return li;
      }),
    );
  }
  if (obstacleMesh) {
    obstacleMesh.visible = !!state.obstacle;
    if (state.obstacle)
      obstacleMesh.position.set(state.obstacle.x, 0, state.obstacle.y);
    markers.forEach((marker, i) =>
      marker.material.color.set(
        i < state.target_index
          ? '#a7bd8b'
          : i === state.target_index
            ? '#456a2c'
            : '#8faba0',
      ),
    );
    const geometry = new THREE.BufferGeometry().setFromPoints(
      state.trail.map(([x, y]) => new THREE.Vector3(x, 0.05, y)),
    );
    trail.geometry.dispose();
    trail.geometry = geometry;
    const detourPoints = state.avoidance_path || [];
    detour.visible = detourPoints.length > 0;
    detour.geometry.dispose();
    detour.geometry = new THREE.BufferGeometry().setFromPoints(
      [[state.position_x, state.position_y], ...detourPoints].map(
        ([x, y]) => new THREE.Vector3(x, 0.09, y),
      ),
    );
    detour.computeLineDistances();
  }
}
async function command(action) {
  if (busy || !connected) return;
  busy = true;
  $('#feedback').textContent = '';
  if (state) update(state);
  try {
    const response = await fetch('/simulation/commands', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action }),
      signal: AbortSignal.timeout(5000),
    });
    const body = await response.json();
    if (!response.ok)
      throw new Error(body.error?.message || 'Command could not be applied.');
    update(body);
  } catch (error) {
    $('#feedback').textContent = error.message;
  } finally {
    busy = false;
    if (state) update(state);
  }
}
document
  .querySelectorAll('[data-command]')
  .forEach((button) =>
    button.addEventListener('click', () => command(button.dataset.command)),
  );
document.querySelectorAll('[data-view]').forEach((button) =>
  button.addEventListener('click', () => {
    view = button.dataset.view;
    document
      .querySelectorAll('[data-view]')
      .forEach((item) =>
        item.setAttribute('aria-pressed', String(item === button)),
      );
  }),
);
document.addEventListener('keydown', (e) => {
  if (
    ['INPUT', 'TEXTAREA', 'BUTTON', 'A'].includes(
      document.activeElement.tagName,
    ) ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey
  )
    return;
  if (e.code === 'Space') {
    e.preventDefault();
    command(
      ['running', 'avoiding', 'blocked'].includes(state?.status)
        ? 'pause'
        : 'start',
    );
  }
  if (e.code === 'KeyR') command('reset');
});
let retry;
function connect() {
  const socket = new WebSocket(
    `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/simulation`,
  );
  socket.onopen = () => {
    connected = true;
    $('#connection').textContent = 'Simulator connected';
    $('#connection').classList.remove('offline');
  };
  socket.onmessage = (event) => {
    const next = JSON.parse(event.data);
    if (!scene) {
      try {
        setupScene(next);
      } catch (error) {
        graphicsError = true;
        $('#world-notice').hidden = false;
        $('#world-notice').textContent =
          '3D rendering unavailable. Enable WebGL in your browser.';
        console.error(error);
      }
    }
    update(next);
  };
  socket.onclose = () => {
    connected = false;
    $('#connection').textContent = 'Simulator disconnected';
    $('#connection').classList.add('offline');
    if (state) update(state);
    retry = setTimeout(connect, 1500);
  };
  window.addEventListener(
    'pagehide',
    () => {
      clearTimeout(retry);
      socket.onclose = null;
      socket.close();
    },
    { once: true },
  );
}
async function refreshCamera() {
  try {
    const response = await fetch(`/simulation/camera.jpg`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error();
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const image = $('#camera');
    const old = image.src;
    image.src = url;
    if (old.startsWith('blob:')) URL.revokeObjectURL(old);
    $('#camera-state').textContent = '';
  } catch {
    $('#camera-state').textContent = 'Camera unavailable';
  }
  setTimeout(refreshCamera, 150);
}
connect();
refreshCamera();
