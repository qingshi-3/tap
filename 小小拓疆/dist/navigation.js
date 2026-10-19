const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

const appendUnique = (points, point) => {
  const last = points.at(-1);
  if (!last || distance(last, point) > 0.001) points.push({ x: point.x, y: point.y });
};

export class RoadNavigation {
  constructor(level) {
    this.nodes = new Map(level.nodes.map((node) => [node.id, node]));
    this.roads = new Map();
    this.links = new Map(level.nodes.map((node) => [node.id, []]));
    for (const source of level.roads) {
      const points = source.points.map((point) => ({ ...point }));
      const cumulative = [0];
      for (let index = 1; index < points.length; index += 1) cumulative.push(cumulative.at(-1) + distance(points[index - 1], points[index]));
      const road = { ...source, points, cumulative, length: cumulative.at(-1) };
      this.roads.set(road.id, road);
      this.links.get(road.a)?.push({ nodeId: road.b, roadId: road.id, forward: true, length: road.length });
      this.links.get(road.b)?.push({ nodeId: road.a, roadId: road.id, forward: false, length: road.length });
    }
  }

  project(x, y, roadId = null) {
    const roads = roadId ? [this.roads.get(roadId)].filter(Boolean) : [...this.roads.values()];
    let best = null;
    for (const road of roads) {
      for (let index = 0; index < road.points.length - 1; index += 1) {
        const a = road.points[index];
        const b = road.points[index + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lengthSquared = dx * dx + dy * dy;
        const t = lengthSquared ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / lengthSquared)) : 0;
        const point = { x: a.x + dx * t, y: a.y + dy * t };
        const inputDistance = Math.hypot(x - point.x, y - point.y);
        if (!best || inputDistance < best.distanceToInput) {
          best = {
            x: point.x,
            y: point.y,
            roadId: road.id,
            distanceFromA: road.cumulative[index] + distance(a, point),
            distanceToInput: inputDistance,
            segmentIndex: index,
            segmentT: t,
          };
        }
      }
    }
    return best;
  }

  atNode(nodeId) {
    const link = this.links.get(nodeId)?.[0];
    const node = this.nodes.get(nodeId);
    if (!node || !link) return null;
    const road = this.roads.get(link.roadId);
    return { x: node.x, y: node.y, roadId: road.id, distanceFromA: road.a === nodeId ? 0 : road.length, distanceToInput: 0 };
  }

  route(start, target) {
    if (!start || !target) return null;
    if (start.roadId === target.roadId) {
      return this._materialize(start, target, []);
    }
    const startRoad = this.roads.get(start.roadId);
    const targetRoad = this.roads.get(target.roadId);
    if (!startRoad || !targetRoad) return null;
    let best = null;
    for (const startEnd of [
      { nodeId: startRoad.a, cost: start.distanceFromA },
      { nodeId: startRoad.b, cost: startRoad.length - start.distanceFromA },
    ]) {
      for (const targetEnd of [
        { nodeId: targetRoad.a, cost: target.distanceFromA },
        { nodeId: targetRoad.b, cost: targetRoad.length - target.distanceFromA },
      ]) {
        const middle = this._dijkstra(startEnd.nodeId, targetEnd.nodeId);
        if (!middle) continue;
        const cost = startEnd.cost + middle.cost + targetEnd.cost;
        if (!best || cost < best.cost) best = { cost, startEnd, targetEnd, middle };
      }
    }
    if (!best) return null;
    const traversals = [{ roadId: startRoad.id, from: start.distanceFromA, to: startRoad.a === best.startEnd.nodeId ? 0 : startRoad.length }];
    traversals.push(...best.middle.edges.map((edge) => ({ roadId: edge.roadId, from: edge.forward ? 0 : this.roads.get(edge.roadId).length, to: edge.forward ? this.roads.get(edge.roadId).length : 0 })));
    traversals.push({ roadId: targetRoad.id, from: targetRoad.a === best.targetEnd.nodeId ? 0 : targetRoad.length, to: target.distanceFromA });
    return this._materialize(start, target, traversals.filter((item) => Math.abs(item.to - item.from) > 0.001));
  }

  _dijkstra(startId, targetId) {
    if (startId === targetId) return { cost: 0, edges: [] };
    const costs = new Map([[startId, 0]]);
    const previous = new Map();
    const open = new Set([startId]);
    while (open.size) {
      let current = null;
      for (const id of open) if (current === null || costs.get(id) < costs.get(current)) current = id;
      open.delete(current);
      if (current === targetId) break;
      for (const edge of this.links.get(current) || []) {
        const nextCost = costs.get(current) + edge.length;
        if (nextCost >= (costs.get(edge.nodeId) ?? Infinity)) continue;
        costs.set(edge.nodeId, nextCost);
        previous.set(edge.nodeId, { from: current, edge });
        open.add(edge.nodeId);
      }
    }
    if (!costs.has(targetId)) return null;
    const edges = [];
    for (let id = targetId; id !== startId;) {
      const step = previous.get(id);
      if (!step) return null;
      edges.unshift(step.edge);
      id = step.from;
    }
    return { cost: costs.get(targetId), edges };
  }

  _materialize(start, target, traversals) {
    const items = traversals.length ? traversals : [{ roadId: start.roadId, from: start.distanceFromA, to: target.distanceFromA }];
    const points = [];
    appendUnique(points, start);
    for (const item of items) for (const point of this._slice(this.roads.get(item.roadId), item.from, item.to)) appendUnique(points, point);
    appendUnique(points, target);
    let length = 0;
    for (let index = 1; index < points.length; index += 1) length += distance(points[index - 1], points[index]);
    return { points, length, start: { ...start }, target: { ...target } };
  }

  _slice(road, from, to) {
    if (!road) return [];
    const forward = to >= from;
    const low = Math.min(from, to);
    const high = Math.max(from, to);
    const middle = [];
    for (let index = 1; index < road.points.length - 1; index += 1) {
      const at = road.cumulative[index];
      if (at > low && at < high) middle.push(road.points[index]);
    }
    if (!forward) middle.reverse();
    return [this._sample(road, from), ...middle, this._sample(road, to)];
  }

  _sample(road, at) {
    const value = Math.max(0, Math.min(road.length, at));
    for (let index = 0; index < road.points.length - 1; index += 1) {
      const end = road.cumulative[index + 1];
      if (value > end) continue;
      const start = road.cumulative[index];
      const t = end === start ? 0 : (value - start) / (end - start);
      const a = road.points[index];
      const b = road.points[index + 1];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    return { ...road.points.at(-1) };
  }
}
