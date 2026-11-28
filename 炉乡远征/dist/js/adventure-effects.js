import { assetImage, assetFetch } from "./asset-loading.js";
const copyCell = (cell) =>
  cell && Number.isFinite(cell.x) && Number.isFinite(cell.y)
    ? { x: cell.x, y: cell.y }
    : null;
const centerOf = (cells) =>
  cells?.length
    ? {
        x: cells.reduce((s, c) => s + c.x, 0) / cells.length,
        y: cells.reduce((s, c) => s + c.y, 0) / cells.length,
      }
    : null;
const clamp = (n) => Math.max(0, Math.min(1, n));
export function hasAdventureSteps(action, state) {
  return (
    !!state?.adventure &&
    Array.isArray(action?.steps) &&
    action.steps.some((s) =>
      [
        "cast",
        "chain",
        "beam",
        "meteor",
        "event",
        "move",
        "hit",
        "charge",
        "phase",
        "reserve",
        "absorb",
      ].includes(s.kind),
    )
  );
}
/** Presentation only: use committed sequence and amounts, never re-run targeting or gameplay. */
export function compileAdventureTimeline(
  action,
  beforeUnits = [],
  afterUnits = [],
) {
  const entries = [],
    moves = new Map(),
    hits = new Map(),
    charges = new Map();
  let cursor = 180,
    impact = 180,
    gravityAt = null,
    round = -1,
    moveOrdinal = 0,
    sourceId = action.sourceId ?? action.unitId;
  const append = (name, cell, at, duration, extra = {}) => {
    if (cell)
      entries.push({
        kind: "adventure-fx",
        name,
        cell: copyCell(cell),
        at,
        duration,
        ...extra,
      });
  };
  for (const s of action.steps ?? []) {
    if (s.kind === "cast") {
      sourceId = s.unitId ?? sourceId;
      if (s.abilityId === "black-hole") {
        gravityAt = cursor;
        append("gravity", s.cell, gravityAt, 1000);
      }
      continue;
    }
    if (s.kind === "chain") {
      append("chain", s.to, cursor, 480, { from: copyCell(s.from) });
      impact = cursor + 75;
      cursor += 155;
      continue;
    }
    if (s.kind === "beam") {
      const end = [...(s.cells ?? [])].sort(
        (a, b) =>
          Math.abs(b.x - s.from.x) +
          Math.abs(b.y - s.from.y) -
          (Math.abs(a.x - s.from.x) + Math.abs(a.y - s.from.y)),
      )[0];
      if (end) append("beam", end, cursor, 850, { from: copyCell(s.from) });
      impact = cursor + 130;
      cursor += 160;
      continue;
    }
    if (s.kind === "meteor") {
      append("meteor", s.cell, cursor, 1500);
      impact = cursor + 540;
      cursor += 570;
      continue;
    }
    if (s.kind === "event") {
      gravityAt = null;
      round = -1;
      moveOrdinal = 0;
      const cell = copyCell(s.center) ?? centerOf(s.cells);
      if (s.eventKind === "gravity") {
        gravityAt = cursor;
        append("gravity", cell, gravityAt, 1000);
        impact = cursor + 160;
      } else if (s.eventKind === "meteor") {
        append("meteor", cell, cursor, 1500);
        impact = cursor + 540;
        cursor += 570;
      } else {
        for (const target of s.cells ?? [])
          append("chain", target, cursor, 480, {
            from: { x: target.x, y: target.y - 1.8 },
          });
        impact = cursor + 75;
        cursor += 155;
      }
      continue;
    }
    if (s.kind === "move") {
      if (gravityAt === null) {
        gravityAt = cursor;
        const cast = (action.steps ?? []).find((x) => x.kind === "cast");
        append("gravity", cast?.cell ?? s.to, gravityAt, 1000);
      }
      if (s.round !== round) {
        round = s.round;
        cursor = Math.max(cursor, gravityAt + 160 + round * 270);
        moveOrdinal = 0;
      }
      const at = cursor + moveOrdinal++ * 12,
        list = moves.get(s.unitId) ?? [];
      list.push({
        from: copyCell(s.from),
        to: copyCell(s.to),
        at,
        duration: 220,
      });
      moves.set(s.unitId, list);
      impact = Math.max(impact, at + 220);
      continue;
    }
    if (s.kind === "hit") {
      const list = hits.get(s.unitId) ?? [];
      list.push({
        at: impact,
        amount: Math.max(0, Number(s.amount) || 0),
        cell: copyCell(s.cell),
      });
      hits.set(s.unitId, list);
      continue;
    }
    if (s.kind === "charge" || s.kind === "absorb") {
      charges.set(s.unitId, impact);
      append(
        "phase",
        s.cell ??
          afterUnits.find((u) => u.unitId === s.unitId) ??
          beforeUnits.find((u) => u.unitId === s.unitId),
        impact,
        300,
      );
      continue;
    }
    if (s.kind === "reserve") {
      append("phase", s.cell, Math.max(impact, 180), 350);
      continue;
    }
    if (s.kind === "phase") {
      append(
        "phase",
        s.cell ??
          afterUnits.find((u) => u.unitId === s.unitId) ??
          beforeUnits.find((u) => u.unitId === s.unitId),
        impact,
        450,
      );
    }
  }
  // Hold the actor through wind-up and reveal even indirect deaths after their causal batch.
  const lastImpact = Math.max(
    180,
    ...[...hits.values()].flat().map((h) => h.at),
    ...[...moves.values()].flat().map((m) => m.at + m.duration),
  );
  return {
    entries,
    moves,
    hits,
    charges,
    sourceId,
    lastImpact,
    duration: Math.max(
      lastImpact + 400,
      700,
      ...entries.map((e) => e.at + e.duration),
    ),
  };
}
export function adventureDisplayUnit(playback, unit, elapsed) {
  if (playback.staticOnly)
    return playback.byAfter.get(unit.unitId) ?? { ...unit, health: 0 };
  const before = playback.byBefore.get(unit.unitId),
    after = playback.byAfter.get(unit.unitId),
    timeline = playback.adventureTimeline;
  let result = { ...(after ?? before ?? unit) };
  const hits = timeline.hits.get(unit.unitId) ?? [];
  const last = hits.at(-1)?.at ?? timeline.lastImpact;
  if (before && elapsed < last) {
    result = { ...before };
    result.health = Math.max(
      0,
      before.health -
        hits
          .filter((h) => elapsed >= h.at)
          .reduce((sum, h) => sum + h.amount, 0),
    );
  } else if (!after) result.health = 0;
  const moves = timeline.moves.get(unit.unitId) ?? [];
  if (moves.length) {
    result.x = moves[0].from.x;
    result.y = moves[0].from.y;
    for (const move of moves) {
      if (elapsed < move.at) break;
      const t = clamp((elapsed - move.at) / move.duration),
        ease = 1 - (1 - t) ** 3;
      result.x = move.from.x + (move.to.x - move.from.x) * ease;
      result.y = move.from.y + (move.to.y - move.from.y) * ease;
    }
  }
  return result;
}
export class AdventureEffects {
  constructor(renderer) {
    this.renderer = renderer;
    this.sheets = new Map();
    this.pending = null;
    this.error = "";
  }
  async load() {
    if (this.sheets.size === 5) return true;
    if (this.pending) return this.pending;
    this.pending = (async () => {
      try {
        const response = await assetFetch("./assets/adventure/manifest.json", {
          priority: 1,
        });
        if (!response.ok) throw Error("冒险特效未能加载");
        const manifest = JSON.parse(await response.text());
        if (manifest.version !== 1) throw Error("冒险特效版本不支持");
        for (const [key, spec] of Object.entries(manifest.sheets)) {
          if (this.sheets.has(key)) continue;
          const image = await assetImage(spec.image, { priority: 1 });
          if (!image) throw Error("冒险特效图片未能加载");
          this.sheets.set(key, { ...spec, image });
        }
        this.error = "";
        return true;
      } catch (error) {
        this.error = error.message;
        return false;
      } finally {
        this.pending = null;
      }
    })();
    return this.pending;
  }
  draw(ctx, metrics, entry, elapsed, pass, staticOnly = false) {
    if (entry.name === "gravity") {
      this.drawSheet(
        ctx,
        metrics,
        entry,
        elapsed,
        pass === "back" ? "gravity-back" : "gravity-front",
        staticOnly,
      );
      return;
    }
    if (pass === "back") return;
    this.drawSheet(ctx, metrics, entry, elapsed, entry.name, staticOnly);
  }
  drawSheet(ctx, metrics, entry, elapsed, key, staticOnly) {
    const sheet = this.sheets.get(key),
      cell = this.renderer.cellGeometry(metrics, entry.cell.x, entry.cell.y),
      scale = cell.width / 80;
    const target = {
      x: cell.center.x,
      y: cell.center.y - (entry.name === "gravity" ? 0 : cell.height * 0.3),
    };
    if (!sheet) {
      if (key === "gravity-front") return;
      this.fallback(
        ctx,
        target,
        cell.width,
        entry.name,
        elapsed / entry.duration,
      );
      return;
    }
    const fraction = staticOnly
        ? entry.name === "meteor"
          ? 0.38
          : entry.name === "chain"
            ? 0.26
            : 0.45
        : clamp(elapsed / entry.duration),
      index = Math.min(sheet.frames - 1, Math.floor(fraction * sheet.frames)),
      sx = (index % sheet.columns) * sheet.width,
      sy = Math.floor(index / sheet.columns) * sheet.height;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (entry.from) {
      const source = this.renderer.cellGeometry(
          metrics,
          entry.from.x,
          entry.from.y,
        ),
        start = {
          x: source.center.x,
          y: source.center.y - source.height * 0.3,
        },
        dx = target.x - start.x,
        dy = target.y - start.y,
        length = Math.hypot(dx, dy);
      ctx.translate(start.x, start.y);
      ctx.rotate(Math.atan2(dy, dx));
      const sourceLength = sheet.end[0] - sheet.pivot[0],
        stretch = length / sourceLength;
      // Beam body stretches between endpoints; source and impact flares keep their authored shape.
      if (entry.name === "beam") {
        const left = sheet.pivot[0] + 12,
          right = sheet.end[0] - 14,
          top = -sheet.pivot[1] * scale,
          height = sheet.height * scale;
        ctx.drawImage(
          sheet.image,
          sx,
          sy,
          left,
          sheet.height,
          -sheet.pivot[0] * scale,
          top,
          left * scale,
          height,
        );
        const bodyStart = 12 * scale,
          bodyEnd = length - 14 * scale;
        if (bodyEnd > bodyStart)
          ctx.drawImage(
            sheet.image,
            sx + left,
            sy,
            right - left,
            sheet.height,
            bodyStart,
            top,
            bodyEnd - bodyStart,
            height,
          );
        ctx.drawImage(
          sheet.image,
          sx + right,
          sy,
          sheet.width - right,
          sheet.height,
          length - 14 * scale,
          top,
          (sheet.width - right) * scale,
          height,
        );
      } else
        ctx.drawImage(
          sheet.image,
          sx,
          sy,
          sheet.width,
          sheet.height,
          -sheet.pivot[0] * stretch,
          -sheet.pivot[1] * scale,
          sheet.width * stretch,
          sheet.height * scale,
        );
    } else {
      const s =
        entry.name === "gravity"
          ? (cell.width * 1.75) / 120
          : entry.name === "meteor"
            ? (cell.width * 2.25) / 210
            : scale;
      ctx.drawImage(
        sheet.image,
        sx,
        sy,
        sheet.width,
        sheet.height,
        target.x - sheet.pivot[0] * s,
        target.y - sheet.pivot[1] * s,
        sheet.width * s,
        sheet.height * s,
      );
    }
    ctx.restore();
  }
  fallback(ctx, p, width, name, progress) {
    const alpha = Math.max(0.15, Math.sin(Math.PI * clamp(progress)));
    ctx.save();
    const r = width * (name === "gravity" ? 0.75 : 0.42),
      glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    glow.addColorStop(
      0,
      name === "meteor"
        ? `rgba(255,233,168,${alpha})`
        : `rgba(178,220,255,${alpha})`,
    );
    glow.addColorStop(
      0.5,
      name === "meteor"
        ? `rgba(245,124,35,${alpha * 0.65})`
        : `rgba(95,111,245,${alpha * 0.65})`,
    );
    glow.addColorStop(1, "rgba(70,100,180,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    ctx.restore();
  }
}
