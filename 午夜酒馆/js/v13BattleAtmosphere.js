// Canvas adaptation of pixelfx weather/rain, weather/fog and weather/fireflies.
// MIT, Copyright (c) 2026 Patch and Hugo Duprez. See assets/vfx/PIXELFX-LICENSE.txt.
(function () {
  'use strict';

  const MT = (window.MT = window.MT || {});
  const WEATHER = ['rain', 'mist', 'fireflies'];
  const RAIN_DEPTHS = [
    { count: 33, length: 4, speed: 37, tail: '#85a1d3', head: '#bdd9ff', alpha: 0.38 },
    { count: 27, length: 7, speed: 57, tail: '#8aaee4', head: '#d0e9ff', alpha: 0.56 },
    { count: 21, length: 11, speed: 83, tail: '#9ec5fa', head: '#e4f5ff', alpha: 0.82 }
  ];
  let previousWeather = -1;

  function sample(index, seed) {
    let hash = Math.imul(index + 19, 374761393) ^ Math.imul(seed + 31, 668265263);
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
    return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
  }

  class BattleWeather {
    constructor() {
      const choices = previousWeather < 0 ? WEATHER.length : WEATHER.length - 1;
      const roll = Math.floor(Math.random() * choices);
      previousWeather = roll >= previousWeather && previousWeather >= 0 ? roll + 1 : roll;
      this.weather = WEATHER[previousWeather];
      this.seed = Math.floor(Math.random() * 100000);
      this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
      this.disposed = false;
    }

    draw(ctx, elapsed) {
      if (this.disposed) return;
      const time = this.reducedMotion.matches ? 0 : elapsed;
      ctx.save();
      ctx.scale(4, 4);
      ctx.beginPath();
      ctx.rect(0, 0, 320, 104);
      ctx.clip();
      switch (this.weather) {
        case 'rain':
          this.drawRain(ctx, time);
          break;
        case 'mist':
          this.drawMist(ctx, time);
          break;
        case 'fireflies':
          this.drawFireflies(ctx, time);
          break;
      }
      ctx.restore();
    }

    drawRain(ctx, time) {
      for (const [depth, layer] of RAIN_DEPTHS.entries()) {
        const seed = this.seed + depth * 71;
        ctx.globalAlpha = layer.alpha;
        for (let i = 0; i < layer.count; i++) {
          const travel = sample(i, seed) * 128 + time * layer.speed;
          const pass = Math.floor(travel / 128);
          const y = (travel % 128) - 11;
          const x = sample(i + pass * layer.count + 100, seed) * 350 - y * 0.24 - 1;
          const length = layer.length + Math.floor(sample(i + 200, seed) * 3);
          ctx.fillStyle = layer.tail;
          for (let step = 2; step < length; step++) {
            ctx.fillRect(Math.round(x + step * 0.24), Math.round(y) - step, 1, 1);
          }
          ctx.fillStyle = layer.head;
          ctx.fillRect(Math.round(x), Math.round(y) - 1, 1, 2);
        }
      }
    }

    drawMist(ctx, time) {
      // Broad, staggered fog banks remain above the hand dock on short screens.
      const phase = (this.seed % 97) * 0.07;
      const banks = [
        { line: 59, drift: -0.26, height: 23, tint: '163, 179, 218', strength: 0.34 },
        { line: 72, drift: 0.43, height: 21, tint: '200, 211, 235', strength: 0.40 },
        { line: 86, drift: -0.57, height: 18, tint: '216, 225, 242', strength: 0.43 }
      ];

      for (const [index, bank] of banks.entries()) {
        const gradient = ctx.createLinearGradient(0, bank.line - 10, 0, bank.line + bank.height + 9);
        gradient.addColorStop(0, `rgba(${bank.tint}, 0)`);
        gradient.addColorStop(0.45, `rgba(${bank.tint}, ${bank.strength})`);
        gradient.addColorStop(0.67, `rgba(${bank.tint}, ${bank.strength * 0.72})`);
        gradient.addColorStop(1, `rgba(${bank.tint}, 0)`);
        ctx.fillStyle = gradient;

        for (let x = 0; x < 320; x += 2) {
          const drift = time * bank.drift;
          const wave = Math.sin(x * 0.042 + phase + index * 1.7 + drift) * 7;
          const curl = Math.sin(x * 0.079 - phase + drift * 0.54) * 3;
          ctx.fillRect(x, bank.line + Math.round(wave + curl), 2, bank.height);
        }
      }
    }

    drawFireflies(ctx, time) {
      const count = 32;
      for (let i = 0; i < count; i++) {
        const random = (salt) => sample(i + salt * count, this.seed);
        const phase = random(3) * Math.PI * 2;
        const x = Math.round(8 + i * 9.7 + random(1) * 8 + Math.sin(time * 1.1 + phase) * 8);
        const y = Math.round(30 + random(2) * 64 + Math.sin(time * 0.87 + phase) * 5);
        const pulse = Math.pow(0.5 + 0.5 * Math.sin(time * (1.9 + random(4)) + phase), 3);
        const light = 0.38 + pulse * 0.62;
        const near = i % 3 === 0;
        const radius = near ? 7 : 4;
        const halo = ctx.createRadialGradient(x + 0.5, y + 0.5, 0, x + 0.5, y + 0.5, radius);
        halo.addColorStop(0, `rgba(255, 221, 109, ${light * 0.54})`);
        halo.addColorStop(1, 'rgba(255, 221, 109, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(x - radius, y - radius, radius * 2 + 1, radius * 2 + 1);
        ctx.globalAlpha = light;
        ctx.fillStyle = near ? '#fff4b7' : '#fbe587';
        ctx.fillRect(x, y, near ? 2 : 1, near ? 2 : 1);
        ctx.globalAlpha = 1;
      }
    }

    dispose() {
      this.disposed = true;
    }
  }

  MT.V13BattleAtmosphere = { create: () => new BattleWeather() };
})();
