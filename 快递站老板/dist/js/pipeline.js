/** Persistent physical pipeline. A parcel has exactly one queue or worker owner. */
export const PIPELINE_LAYOUT = {
  width: 390, height: 520, speed: 100,
  belt: { left: 40, right: 350, y: 460 },
  roles: {
    sort: { pickup: { x: 65, y: 446 }, work: { x: 84, y: 348 }, drop: { x: 155, y: 310 } },
    pack: { pickup: { x: 155, y: 310 }, work: { x: 195, y: 292 }, drop: { x: 270, y: 250 } },
    load: { pickup: { x: 270, y: 250 }, work: { x: 305, y: 230 }, drop: { x: 195, y: 120 } },
  },
  trucks: [{ x: 65, y: 120 }, { x: 195, y: 120 }, { x: 325, y: 120 }],
};
const ROLES = ['sort', 'pack', 'load'];
const PHASES = ['idle', 'pickup', 'work', 'deliver', 'return', 'transfer'];
const plain = value => !!value && Object.getPrototypeOf(value) === Object.prototype;
const keys = (value, names) => plain(value) && Object.keys(value).every(key => names.includes(key));
const finite = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const role = value => ROLES.includes(value);
const staffTotal = state => 3 + (state.upgrades.worker || 0);
const validStaff = (staff, total) => keys(staff, ROLES) && ROLES.every(key => Number.isInteger(staff[key]) && staff[key] >= 0 && staff[key] <= total) && ROLES.reduce((sum, key) => sum + staff[key], 0) === total;
/** Stable physical bench positions keep multiple employees visibly separate. */
export function pipelineWorkerPoint(assigned, id, spread = false) {
  const center = PIPELINE_LAYOUT.roles[assigned].work;
  const slot = id - 1;
  return { x: center.x + (1 - slot % 3) * (spread ? 54 : 28), y: center.y + Math.floor(slot / 3) * (spread ? 60 : 38) };
}
const makeWorker = (id, assigned) => ({ id, role: assigned, targetRole: assigned, ...pipelineWorkerPoint(assigned, id), phase: 'idle', parcel: null, job: null, progress: 0 });
function assignTargets(workers, staff) {
  const vacancies = { ...staff }, unassigned = [];
  for (const worker of workers) {
    if (vacancies[worker.targetRole] > 0) vacancies[worker.targetRole]--;
    else unassigned.push(worker);
  }
  for (const worker of unassigned) {
    const target = ROLES.find(key => vacancies[key] > 0);
    vacancies[target]--;
    worker.targetRole = target;
    if (!worker.parcel) worker.phase = worker.role === target ? 'return' : 'transfer';
  }
}
function plannedWorkers(state) {
  const workers = Array.from({ length: staffTotal(state) }, (_, index) => makeWorker(index + 1, index === 0 ? 'sort' : index === 1 ? 'pack' : 'load'));
  if (state.management.assignments) {
    for (const worker of workers) worker.targetRole = state.management.assignments[worker.id - 1].targetRole;
  } else assignTargets(workers, state.management.staff);
  // Before opening, assignments are already in place. Running reassignments
  // use assignTargets alone and therefore retain their current physical point.
  for (const worker of workers) { worker.role = worker.targetRole; worker.phase = 'idle'; Object.assign(worker, pipelineWorkerPoint(worker.role, worker.id)); }
  return workers;
}
// Preserve the historical scene's rack-aisle route. Its sprites used a 195×260
// top-left coordinate; persistent pipeline positions use 390×520 feet anchors.
function legacyPosition(worker) {
  const center = 32.5 + worker.dest * 65, progress = worker.progress;
  const lane = worker.dest === 0 ? 57 : 122, start = center - 7;
  const floorStart = worker.dest === 1 ? 127 : start;
  let x, y;
  if (progress < 0.2) { x = floorStart + (lane - floorStart) * progress / 0.2; y = 146 - progress / 0.2 * 18; }
  else if (progress < 0.75) { x = lane; y = 128 - (progress - 0.2) / 0.55 * 58; }
  else { x = lane + (start - lane) * (progress - 0.75) / 0.25; y = 70 - (progress - 0.75) / 0.25 * 6; }
  return { x: (x + 8) * 2, y: (y + 18) * 2 };
}

export function initializePipeline(state) {
  const shift = state.shift;
  if (!shift || shift.flow) return;
  const workers = plannedWorkers(state);
  // Historical sorted freight has already completed its old preparation rules.
  shift.flow = { version: 1, pack: [], load: shift.queues.flat().splice(0), workers };
  shift.queues.forEach(queue => queue.length = 0);
  const old = shift.workers.filter(worker => worker.parcel);
  for (let i = 0; i < old.length; i++) {
    const source = old[i], worker = workers[workers.length - 1 - i];
    worker.role = 'load';
    Object.assign(worker, legacyPosition(source));
    worker.phase = 'work';
    worker.parcel = source.parcel;
    const duration = 2.4;
    worker.job = { stage: 'load', duration, remaining: Math.max(1e-9, duration * (1 - source.progress)), legacy: true };
    worker.progress = source.progress;
    source.parcel = null;
    source.progress = 0;
  }
  setStaff(state, state.management.staff);
}

export function enableManagement(state, workerSeconds) {
  if (state.management) return false;
  state.management = { version: 1, staff: { sort: 1, pack: 1, load: 1 + (state.upgrades.worker || 0) } };
  // Migration computes the original job's remaining seconds, including large freight.
  if (state.shift) {
    const original = state.shift.workers.map(worker => ({ ...worker }));
    initializePipeline(state);
    original.filter(worker => worker.parcel).forEach((source, index) => {
      const worker = state.shift.flow.workers.at(-1 - index);
      const duration = workerSeconds * (source.parcel.kind === 'large' && !state.upgrades.widegate ? 2.125 : 1);
      worker.job.duration = duration;
      worker.job.remaining = Math.max(1e-9, duration * (1 - source.progress));
    });
  }
  return true;
}

// Legacy saves lack assignments. Capture running identities before removing a shift.
export function preserveAssignments(state) {
  if (!state.management) return;
  const workers = state.shift?.flow?.workers || plannedWorkers(state);
  state.management.assignments = workers.map(({ id, targetRole }) => ({ id, targetRole }));
}
export function hireWorker(state) {
  // Called after the upgrade count increments; obtain the old roster first.
  if (!state.management.assignments) {
    const previous = { ...state, upgrades: { ...state.upgrades, worker: state.upgrades.worker - 1 } };
    state.management.assignments = plannedWorkers(previous).map(({ id, targetRole }) => ({ id, targetRole }));
  }
  state.management.staff.load++;
  state.management.assignments.push({ id: staffTotal(state), targetRole: 'load' });
}
export function moveWorker(state, workerId, targetRole) {
  if (!state.management || !Number.isInteger(workerId) || !role(targetRole)) return false;
  const workers = state.shift?.flow?.workers || plannedWorkers(state);
  const worker = workers.find(item => item.id === workerId);
  if (!worker) return false;
  state.management.staff[worker.targetRole]--;
  state.management.staff[targetRole]++;
  worker.targetRole = targetRole;
  if (!worker.parcel) worker.phase = worker.role === targetRole ? (worker.phase === 'idle' ? 'idle' : 'return') : 'transfer';
  state.management.assignments = workers.map(({ id, targetRole }) => ({ id, targetRole }));
  return true;
}

export function setStaff(state, staff) {
  if (!state.management || !validStaff(staff, staffTotal(state))) return false;
  const workers = state.shift?.flow?.workers || plannedWorkers(state);
  state.management.staff = { ...staff };
  // Retain assignments where possible. Only excess staff physically transfer.
  assignTargets(workers, staff);
  state.management.assignments = workers.map(({ id, targetRole }) => ({ id, targetRole }));
  return true;
}

export function managementView(state, workerSeconds = 2.4) {
  const workers = state.shift?.flow?.workers || (state.management ? plannedWorkers(state) : []);
  // Preparation previews spread touch targets without changing paid work routes.
  if (!state.shift) for (const worker of workers) Object.assign(worker, pipelineWorkerPoint(worker.role, worker.id, true));
  const roles = {};
  for (const key of ROLES) roles[key] = {
    assigned: state.management?.staff[key] || 0,
    active: workers.filter(worker => worker.role === key && worker.phase !== 'transfer').length,
    busy: workers.filter(worker => worker.role === key && worker.parcel).length,
    pending: key === 'sort' ? (state.shift?.parcels.length || 0) : (state.shift?.flow?.[key].length || 0),
  };
  for(const key of ROLES) {
    const queue=key==='sort' ? [...(state.shift?.arrivals?.waiting || []),...(state.shift?.parcels || [])] : (state.shift?.flow?.[key] || []);
    const busy=workers.filter(w=>w.role===key && w.parcel);
    const seconds=workerSeconds;
    const loads=queue.map(p=>({p,seconds:durationFor(state,key,p,seconds)+3})).concat(busy.map(w=>({p:w.parcel,seconds:w.job.remaining+1.5})));
    const r=roles[key]; r.workSeconds=loads.reduce((n,l)=>n+l.seconds,0);
    const kinds={}; for(const l of loads) kinds[l.p.kind]=(kinds[l.p.kind]||0)+l.seconds;
    r.dominantKind=Object.keys(kinds).sort((a,b)=>kinds[b]-kinds[a])[0] || null;
    const urgent=loads.filter(l=>l.p.kind==='urgent');
    r.oldestUrgentRemaining=urgent.length ? Math.max(0,25-Math.max(...urgent.map(l=>l.p.age))) : null;
    r.pressure=!loads.length ? 'idle' : !r.assigned ? 'blocked' : r.workSeconds/Math.max(1,r.active)>16 ? 'busy' : 'steady';
  }
  return { total: staffTotal(state), roles, workers };
}

export function pipelineParcels(shift) {
  return shift.flow ? [...shift.flow.pack, ...shift.flow.load, ...shift.flow.workers.map(worker => worker.parcel).filter(Boolean)] : [];
}

export function beltParcels(shift) {
  return [...shift.parcels, ...(shift.flow?.workers || []).filter(worker => worker.role === 'sort' && worker.phase === 'pickup').map(worker => worker.parcel)];
}

function move(worker, point, dt) {
  const dx = point.x - worker.x, dy = point.y - worker.y, distance = Math.hypot(dx, dy);
  const amount = PIPELINE_LAYOUT.speed * dt;
  if (distance <= amount + 1e-9) { worker.x = point.x; worker.y = point.y; return true; }
  worker.x += dx / distance * amount;
  worker.y += dy / distance * amount;
  return false;
}
export function durationFor(state, stage, parcel, workerSeconds) {
  if (state.shift?.flow?.rules === 2) {
    if(stage==='sort') return (state.upgrades.sorter ? 0.4 : 0.9) + (parcel.kind==='exception' ? (state.upgrades.scanner ? 3 : 10) : 0);
    if(stage==='pack') return 0.8 + (parcel.kind==='fragile' ? (state.upgrades.packer ? 2.5 : state.day < 7 ? 4 : 10) : parcel.kind==='large' ? 1.2 : 0);
    return workerSeconds*0.45 + (parcel.kind==='large' ? (state.upgrades.widegate ? 3 : 10) : 0);
  }
  if (stage === 'sort') return state.upgrades.sorter ? 0.32 : 1;
  if (stage === 'load') return workerSeconds * 0.55 * (parcel.kind === 'large' && !state.upgrades.widegate ? 2.125 : 1);
  const special = { fragile: 3, large: 3.5, exception: 4 }[parcel.kind] || 0;
  const equipment = parcel.kind === 'fragile' && state.upgrades.packer || parcel.kind === 'large' && state.upgrades.widegate || parcel.kind === 'exception' && state.upgrades.scanner;
  return 1.2 + (parcel.prepared || equipment ? 0 : special);
}
function take(state, worker, workerSeconds) {
  const shift = state.shift;
  const queue = worker.role === 'sort' ? shift.parcels : shift.flow[worker.role];
  const candidates = queue.filter(parcel => parcel.id !== shift.processing?.id).sort((a, b) => Number(b.kind === 'urgent') - Number(a.kind === 'urgent') || b.age - a.age || a.id - b.id);
  if (!candidates.length) return;
  const parcel = candidates[0];
  queue.splice(queue.indexOf(parcel), 1);
  worker.parcel = parcel;
  const duration = durationFor(state, worker.role, parcel, workerSeconds);
  worker.job = { stage: worker.role, remaining: duration, duration };
  worker.progress = 0;
  worker.phase = 'pickup';
}

export function stepPipeline(state, dt, workerSeconds, events) {
  const shift = state.shift;
  // Reserved cartons remain physical belt obstacles until the worker reaches
  // them. The hopper must never spawn another carton through a claimed one.
  let ahead = 1.16;
  for (const parcel of beltParcels(shift).sort((a, b) => a.id - b.id)) {
    parcel.x = Math.min(0.96, ahead - 0.2, parcel.x + dt / 8);
    ahead = parcel.x;
  }
  for (const worker of shift.flow.workers) {
    if (worker.job?.legacy) {
      // Existing paid work keeps its old clock and aisle route, rather than
      // being carried back to the new workstation for another delivery trip.
      worker.job.remaining = Math.max(0, worker.job.remaining - dt);
      worker.progress = 1 - worker.job.remaining / worker.job.duration;
      Object.assign(worker, legacyPosition({ dest: worker.parcel.dest, progress: worker.progress }));
      if (worker.job.remaining <= 1e-8) {
        const parcel = worker.parcel;
        shift.loading[parcel.dest].push(parcel);
        events.push({ type: 'loaded', id: parcel.id, dest: parcel.dest }, { type: 'pipelineDone', stage: 'load', id: parcel.id });
        worker.parcel = null; worker.job = null; worker.progress = 0;
        worker.phase = worker.role === worker.targetRole ? 'return' : 'transfer';
      }
      continue;
    }
    if (!worker.parcel && worker.role !== worker.targetRole) worker.phase = 'transfer';
    if (worker.phase === 'transfer') {
      if (move(worker, pipelineWorkerPoint(worker.targetRole, worker.id), dt)) { worker.role = worker.targetRole; worker.phase = 'idle'; }
    } else if (worker.phase === 'return') {
      if (move(worker, pipelineWorkerPoint(worker.role, worker.id), dt)) worker.phase = 'idle';
    } else if (worker.phase === 'idle') take(state, worker, workerSeconds);
    else if (worker.phase === 'pickup') {
      const point = worker.role === 'sort' ? { x: 40 + worker.parcel.x * 310, y: 460 } : PIPELINE_LAYOUT.roles[worker.role].pickup;
      if (move(worker, point, dt)) worker.phase = 'work';
    } else if (worker.phase === 'work') {
      if (!move(worker, pipelineWorkerPoint(worker.role, worker.id), dt)) continue;
      worker.job.remaining = Math.max(0, worker.job.remaining - dt);
      worker.progress = 1 - worker.job.remaining / worker.job.duration;
      if (worker.job.remaining <= 1e-8) { worker.job.remaining = 0; worker.progress = 1; worker.phase = 'deliver'; }
    } else if (worker.phase === 'deliver') {
      const point = worker.role === 'load' ? PIPELINE_LAYOUT.trucks[worker.parcel.dest] : PIPELINE_LAYOUT.roles[worker.role].drop;
      if (!move(worker, point, dt)) continue;
      const parcel = worker.parcel;
      if (worker.role === 'sort') shift.flow.pack.push(parcel);
      else if (worker.role === 'pack') { parcel.prepared = true; shift.flow.load.push(parcel); }
      else { shift.loading[parcel.dest].push(parcel); events.push({ type: 'loaded', id: parcel.id, dest: parcel.dest }); }
      events.push({ type: 'pipelineDone', stage: worker.role, id: parcel.id });
      worker.parcel = null; worker.job = null; worker.progress = 0;
      worker.phase = worker.role === worker.targetRole ? 'return' : 'transfer';
    }
  }
}

export function clearPipeline(shift) {
  if (!shift.flow) return;
  shift.flow.pack.length = 0; shift.flow.load.length = 0;
  for (const worker of shift.flow.workers) { worker.parcel = null; worker.job = null; worker.progress = 0; worker.phase = 'idle'; worker.role = worker.targetRole; }
}

export function validManagement(state, workerSeconds) {
  if (state.management === undefined) return state.shift?.flow === undefined;
  if (!keys(state.management, ['version', 'staff', 'assignments']) || state.management.version !== 1 || !validStaff(state.management.staff, staffTotal(state))) return false;
  if (Object.hasOwn(state.management, 'assignments')) {
    const assignments = state.management.assignments;
    if (!Array.isArray(assignments) || assignments.length !== staffTotal(state) || !assignments.every((item, index) => keys(item, ['id', 'targetRole']) && item.id === index + 1 && role(item.targetRole))) return false;
    if (!ROLES.every(key => assignments.filter(item => item.targetRole === key).length === state.management.staff[key])) return false;
  }
  if (!state.shift) return true;
  const flow = state.shift.flow;
  if (!keys(flow, ['version', 'pack', 'load', 'workers', 'rules']) || flow.version !== 1 || (flow.rules !== undefined && flow.rules !== 2) || !Array.isArray(flow.pack) || !Array.isArray(flow.load) || !Array.isArray(flow.workers) || flow.workers.length !== staffTotal(state)) return false;
  if (!Array.isArray(state.shift.queues) || !state.shift.queues.every(Array.isArray) || !Array.isArray(state.shift.workers) || state.shift.queues.some(queue => queue.length) || state.shift.workers.some(worker => !plain(worker) || worker.parcel || worker.progress !== 0)) return false;
  const targets = { sort: 0, pack: 0, load: 0 };
  for (const [index, worker] of flow.workers.entries()) {
    if (!keys(worker, ['id', 'role', 'targetRole', 'x', 'y', 'phase', 'parcel', 'job', 'progress']) || worker.id !== index + 1 || !role(worker.role) || !role(worker.targetRole) || !finite(worker.x, 0, 390) || !finite(worker.y, 0, 520) || !PHASES.includes(worker.phase) || !finite(worker.progress, 0, 1)) return false;
    if (state.management.assignments && state.management.assignments[index].targetRole !== worker.targetRole) return false;
    targets[worker.targetRole]++;
    const busy = ['pickup', 'work', 'deliver'].includes(worker.phase);
    if (busy !== !!worker.parcel || busy !== !!worker.job) return false;
    if (!busy && (worker.parcel !== null || worker.job !== null || worker.progress !== 0)) return false;
    if (busy) {
      const job = worker.job;
      if (!keys(job, ['stage', 'remaining', 'duration', 'legacy']) || job.stage !== worker.role || !finite(job.duration, 0.01, 30) || !finite(job.remaining, 0, job.duration) || Math.abs(worker.progress - (1 - job.remaining / job.duration)) > 1e-7) return false;
      if ((worker.phase === 'deliver') !== (job.remaining === 0) || (worker.phase === 'pickup' && worker.progress !== 0)) return false;
      if (!plain(worker.parcel)) return false;
      const expected = durationFor(state, worker.role, worker.parcel, workerSeconds);
      const legacy = workerSeconds * (worker.parcel.kind === 'large' && !state.upgrades.widegate ? 2.125 : 1);
      if (job.legacy !== undefined) {
        if (job.legacy !== true || worker.role !== 'load' || worker.phase !== 'work' || Math.abs(job.duration - legacy) > 1e-7) return false;
        const point = legacyPosition({ dest: worker.parcel.dest, progress: worker.progress });
        if (Math.hypot(worker.x - point.x, worker.y - point.y) > 1e-7) return false;
      } else if (Math.abs(job.duration - expected) > 1e-7) return false;
    }
    if (worker.phase === 'idle' && worker.role !== worker.targetRole) return false;
  }
  return ROLES.every(key => targets[key] === state.management.staff[key]);
}
