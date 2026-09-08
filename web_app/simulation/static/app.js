import { OffroadWorld } from './world.js';
const $ = (selector) => document.querySelector(selector);
const TOKEN = 'navigen-local-simulation';
let state = null,
  connected = false,
  busy = false,
  graphicsError = false;
let worldRenderer = null;
let lastEnvironmentRevision = null;
const names = {
  idle: 'Ready',
  running: 'Patrolling',
  avoiding: 'Avoiding obstacle',
  paused: 'Paused',
  blocked: 'Route blocked',
  emergency_stop: 'E-stop active',
  completed: 'Complete',
};
let lastEvent = '';
function update(next) {
  state = next;
  if (worldRenderer) worldRenderer.update(state);
  if (lastEnvironmentRevision !== state.environment_revision) {
    lastEnvironmentRevision = state.environment_revision;
    $('#environment-title').textContent = state.environment.name;
    $('#terrain-summary').textContent = state.environment.description;
    $('#active-weather').textContent = state.environment.config.weather;
    document.querySelectorAll('[data-environment]').forEach((button) => {
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.environment === state.environment.id),
      );
    });
    $('#custom-editor').hidden = state.environment.id !== 'custom';
    if (state.environment.id === 'custom') fillCustom(state.environment.config);
  }
  $('#altitude').textContent = `${state.position_z.toFixed(1)} m`;
  $('#pitch').textContent = `${((state.pitch * 180) / Math.PI).toFixed(1)}°`;
  $('#roll').textContent = `${((state.roll * 180) / Math.PI).toFixed(1)}°`;
  $('#traction').textContent = `${state.traction_pct}%`;
  document
    .querySelectorAll('[data-environment], #apply-environment')
    .forEach((button) => (button.disabled = busy || !connected));
  $('#status').textContent = names[state.status] || state.status;
  $('#status').className = `status ${state.status}`;
  const descriptions = {
    idle: 'Four checkpoints across uneven ground. Start the guided demo to see the complete sequence.',
    running: `Navigating to ${state.waypoints[state.target_index]?.name || 'base camp'}. Tracking the patrol route.`,
    avoiding:
      'Turning around the obstacle, then rejoining the patrol route. The obstacle stays in place.',
    blocked: 'No clear detour to the checkpoint. Clear the path to continue.',
    paused: 'Patrol paused. Resume when you are ready.',
    emergency_stop:
      'The simulated emergency stop is active. Reset the simulation to begin again.',
    completed:
      'All four checkpoints reached. The vehicle is back at base camp. Patrol complete.',
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
          : 'Patrol complete · Returned to base camp';
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
}
async function send(path, payload) {
  if (busy || !connected) return;
  busy = true;
  $('#feedback').textContent = '';
  if (state) update(state);
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    const body = await response.json();
    if (!response.ok)
      throw new Error(
        body.error?.message ||
          body.detail?.[0]?.msg ||
          'Command could not be applied.',
      );
    update(body);
    return body;
  } catch (error) {
    $('#feedback').textContent = error.message;
  } finally {
    busy = false;
    if (state) update(state);
  }
}
function command(action) {
  return send('/simulation/commands', { action });
}

const customForm = $('#custom-form');
function customConfig() {
  const values = Object.fromEntries(new FormData(customForm));
  for (const key of ['relief', 'roughness', 'density', 'grip', 'seed'])
    values[key] = Number(values[key]);
  return values;
}
function fillCustom(config) {
  for (const [key, value] of Object.entries(config)) {
    const input = customForm.elements.namedItem(key);
    if (input) input.value = String(value);
  }
  updateOutputs();
}
function updateOutputs() {
  for (const input of customForm.querySelectorAll('input[type=range]')) {
    const output = document.querySelector(`output[for="${input.id}"]`);
    output.textContent =
      input.name === 'relief'
        ? `${input.value} m`
        : ['grip', 'roughness'].includes(input.name)
          ? `${Math.round(Number(input.value) * 100)}%`
          : input.value;
  }
}
customForm.addEventListener('input', updateOutputs);
customForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const config = customConfig();
  const result = await send('/simulation/environment', {
    environment_id: 'custom',
    config,
  });
  if (result) {
    try {
      localStorage.setItem('navigen.custom-terrain', JSON.stringify(config));
    } catch {
      /* Form remains usable without storage. */
    }
  }
});
document.querySelectorAll('[data-environment]').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.environment === 'custom') {
      $('#custom-editor').hidden = false;
      $('#custom-name').focus();
    } else {
      void send('/simulation/environment', {
        environment_id: button.dataset.environment,
      });
    }
  });
});
$('#save-environment').addEventListener('click', () => {
  if (!customForm.reportValidity()) return;
  const blob = new Blob(
    [JSON.stringify({ version: 1, config: customConfig() }, null, 2)],
    { type: 'application/json' },
  );
  const url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = 'navigen-terrain.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('#load-environment').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 16384)
      throw new Error('Choose a NAVIGEN terrain settings file under 16 KB.');
    const data = JSON.parse(await file.text());
    if (data.version !== 1 || !data.config)
      throw new Error('Choose an exported NAVIGEN terrain settings file.');
    const result = await send('/simulation/environment', {
      environment_id: 'custom',
      config: data.config,
    });
    if (result) fillCustom(result.environment.config);
  } catch (error) {
    $('#feedback').textContent = error.message;
  }
  event.target.value = '';
});
try {
  const saved = JSON.parse(localStorage.getItem('navigen.custom-terrain'));
  if (saved) fillCustom(saved);
} catch {
  /* Invalid saved drafts are ignored. */
}
updateOutputs();
document
  .querySelectorAll('[data-command]')
  .forEach((button) =>
    button.addEventListener('click', () => command(button.dataset.command)),
  );
document.querySelectorAll('[data-view]').forEach((button) =>
  button.addEventListener('click', () => {
    if (worldRenderer) worldRenderer.view = button.dataset.view;
    document
      .querySelectorAll('[data-view]')
      .forEach((item) =>
        item.setAttribute('aria-pressed', String(item === button)),
      );
  }),
);
document.addEventListener('keydown', (e) => {
  if (
    ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(
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
    if (!worldRenderer && !graphicsError) {
      try {
        worldRenderer = new OffroadWorld($('#scene'), $('#world'));
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
