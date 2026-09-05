// Same continuous height field as environments.height_at on the simulator.
export function heightAt(config, x, y) {
  const phase = (config.seed % 97) / 17;
  const rolling =
    0.15 * Math.sin(x * 0.16 + phase) + 0.12 * Math.cos(y * 0.18 - phase);
  let land;
  if (config.profile === 'mountain') {
    land = 1.5 * Math.exp(-((x + 3) ** 2 / 75 + (y - 2) ** 2 / 65));
    land += 0.8 * Math.exp(-((x - 18) ** 2 / 55 + (y + 16) ** 2 / 85));
  } else if (config.profile === 'rocky') {
    land = 0.55 * Math.sin(x * 0.18) * Math.cos(y * 0.16) + 0.6;
  } else {
    land = 0.4 * Math.sin(x * 0.1 + y * 0.13) + 0.5;
  }
  const bumps =
    0.16 * Math.sin(x * 1.3 + phase) * Math.cos(y * 1.1) +
    0.08 * Math.sin(x * 2.4 - y * 1.7);
  return config.relief * (0.32 + rolling + land) + config.roughness * bumps;
}
