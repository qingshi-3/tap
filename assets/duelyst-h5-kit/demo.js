(() => {
  'use strict';

  const EFFECT_KEY = 'fxClawSlash';
  const manualStage = document.getElementById('manual-stage');
  const combatStage = document.getElementById('combat-stage');
  const position = document.getElementById('position');
  const combatState = document.getElementById('combat-state');
  const loadStatus = document.getElementById('load-status');
  const playEffect = document.getElementById('play-effect');

  function drawTarget(ctx, x, y, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.moveTo(x - 16, y);
    ctx.lineTo(x - 7, y);
    ctx.moveTo(x + 7, y);
    ctx.lineTo(x + 16, y);
    ctx.moveTo(x, y - 16);
    ctx.lineTo(x, y - 7);
    ctx.moveTo(x, y + 7);
    ctx.lineTo(x, y + 16);
    ctx.stroke();
  }

  function drawLabel(ctx, name, x) {
    ctx.fillStyle = '#b5c5cf';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(name, x, 198);
  }

  function createEffectPlayer(kit, ctx, asset) {
    let burst = null;
    return {
      play(x, y, startedAt = performance.now()) {
        burst = { x, y, startedAt };
      },
      render(now) {
        if (!burst) return;
        const { x, y, startedAt } = burst;
        if (now < startedAt) return;
        if (!kit.draw(ctx, asset.clip, asset.image, now - startedAt, x, y, { scale: 2 })) {
          burst = null;
        }
      },
    };
  }

  async function start() {
    const kit = DuelystH5.create();
    const manualCtx = manualStage.getContext('2d');
    const combatCtx = combatStage.getContext('2d');
    manualCtx.imageSmoothingEnabled = false;
    combatCtx.imageSmoothingEnabled = false;

    async function load(clip, label) {
      if (!clip) throw new Error(`素材索引缺少 ${label}`);
      return { clip, image: await kit.image(clip) };
    }

    async function loadActor(id, name, buttonId, x) {
      const [idle, attack] = await Promise.all([
        load(kit.unit(id, 'idle'), `${id}/idle`),
        load(kit.unit(id, 'attack'), `${id}/attack`),
      ]);
      return { name, button: document.getElementById(buttonId), x, idle, attack };
    }

    const [claw, skyfall, alchemist] = await Promise.all([
      load(kit.effect(EFFECT_KEY), EFFECT_KEY),
      loadActor('boss_skyfalltyrant', 'Skyfall', 'attack-skyfall', 68),
      loadActor('neutral_bloodstonealchemist', '炼金师', 'attack-alchemist', 174),
    ]);
    const actors = [skyfall, alchemist];
    const manualEffect = createEffectPlayer(kit, manualCtx, claw);
    const combatEffect = createEffectPlayer(kit, combatCtx, claw);
    const target = { x: 293, y: 114 };
    const marker = { x: 180, y: 110 };
    let attack = null;
    const idleStartedAt = performance.now();

    function moveMarker(x, y) {
      marker.x = Math.max(0, Math.min(manualStage.width - 1, Math.round(x)));
      marker.y = Math.max(0, Math.min(manualStage.height - 1, Math.round(y)));
      position.textContent = `落点 (${marker.x}, ${marker.y})`;
    }

    manualStage.addEventListener('click', event => {
      const bounds = manualStage.getBoundingClientRect();
      moveMarker(
        (event.clientX - bounds.left) * manualStage.width / bounds.width,
        (event.clientY - bounds.top) * manualStage.height / bounds.height,
      );
    });

    const directions = {
      ArrowLeft: [-8, 0],
      ArrowRight: [8, 0],
      ArrowUp: [0, -8],
      ArrowDown: [0, 8],
    };
    manualStage.addEventListener('keydown', event => {
      if (!Object.hasOwn(directions, event.key)) return;
      event.preventDefault();
      const [dx, dy] = directions[event.key];
      moveMarker(marker.x + dx, marker.y + dy);
    });
    playEffect.addEventListener('click', () => manualEffect.play(marker.x, marker.y));
    playEffect.disabled = false;

    for (const actor of actors) {
      actor.button.addEventListener('click', () => {
        const startedAt = performance.now();
        const duration = kit.duration(actor.attack.clip);
        // This sample uses the middle of the clip as its hit cue. In a game,
        // call the same effect player from the game's own hit event.
        attack = { actor, startedAt, hitAt: startedAt + duration / 2, endsAt: startedAt + duration };
        combatState.textContent = `${actor.name} · Attack`;
      });
      actor.button.disabled = false;
    }

    function render(now) {
      if (attack?.hitAt != null && now >= attack.hitAt) {
        combatEffect.play(target.x, target.y, attack.hitAt);
        attack.hitAt = null;
      }
      if (attack && now >= attack.endsAt) {
        attack = null;
        combatState.textContent = '双方待机 · Idle';
      }

      manualCtx.clearRect(0, 0, manualStage.width, manualStage.height);
      drawTarget(manualCtx, marker.x, marker.y, '#81ebd1');
      manualEffect.render(now);

      combatCtx.clearRect(0, 0, combatStage.width, combatStage.height);
      drawTarget(combatCtx, target.x, target.y, '#ffb17d');
      for (const actor of actors) {
        const active = attack?.actor === actor;
        const asset = active ? actor.attack : actor.idle;
        const elapsed = now - (active ? attack.startedAt : idleStartedAt);
        kit.draw(combatCtx, asset.clip, asset.image, elapsed, actor.x, target.y, { loop: !active });
        drawLabel(combatCtx, actor.name, actor.x);
      }
      drawLabel(combatCtx, '受击目标', target.x);
      combatEffect.render(now);
      requestAnimationFrame(render);
    }

    moveMarker(marker.x, marker.y);
    combatState.textContent = '双方待机 · Idle';
    loadStatus.hidden = true;
    requestAnimationFrame(render);
  }

  start().catch(error => {
    loadStatus.textContent = '素材加载失败。请确认 demo.html 与 assets 目录、duelyst-h5.js 位于同一个接入包中。';
    console.error(error);
  });
})();
