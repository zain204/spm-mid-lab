// Schedule engine: forward pass, backward pass (critical path), delay propagation
const DAY = 86400000;
const addDays = (d, n) => new Date(new Date(d).getTime() + n * DAY);
const diffDays = (a, b) => Math.round((new Date(a).getTime() - new Date(b).getTime()) / DAY);
const fail = (msg, status = 400) => {
  const e = new Error(msg);
  e.status = status;
  return e;
};

function normalize(a) {
  return {
    id: String(a.id || a._id),
    name: a.name,
    assignee: a.assignee && a.assignee.name ? a.assignee.name : null,
    durationDays: Number(a.durationDays) || 0,
    delayDays: Number(a.delayDays) || 0,
    predecessors: (a.predecessors || []).map((p) => String(p._id || p)),
    plannedCost: Number(a.plannedCost) || 0,
    actualCost: Number(a.actualCost) || 0,
    percentComplete: Number(a.percentComplete) || 0,
  };
}

// Topological sort with cycle detection
function topoSort(list) {
  const ids = new Set(list.map((a) => a.id));
  const indeg = new Map();
  const succ = new Map();
  list.forEach((a) => {
    indeg.set(a.id, 0);
    succ.set(a.id, []);
  });
  list.forEach((a) =>
    a.predecessors.forEach((p) => {
      if (p === a.id) throw fail(`Activity "${a.name}" cannot depend on itself`);
      if (!ids.has(p)) throw fail(`Activity "${a.name}" has an unknown predecessor`);
      indeg.set(a.id, indeg.get(a.id) + 1);
      succ.get(p).push(a.id);
    })
  );
  const queue = [...indeg].filter(([, d]) => d === 0).map(([id]) => id);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    succ.get(id).forEach((s) => {
      indeg.set(s, indeg.get(s) - 1);
      if (indeg.get(s) === 0) queue.push(s);
    });
  }
  if (order.length !== list.length) throw fail('Circular dependency detected between activities');
  return { order, succ };
}

// Finish-to-start forward pass. useDelay=false gives the baseline schedule.
function forwardPass(list, order, projectStart, useDelay) {
  const byId = new Map(list.map((a) => [a.id, a]));
  const res = new Map();
  order.forEach((id) => {
    const a = byId.get(id);
    let start = new Date(projectStart);
    a.predecessors.forEach((p) => {
      const e = res.get(p).end;
      if (e > start) start = e;
    });
    const dur = a.durationDays + (useDelay ? a.delayDays : 0);
    res.set(id, { start, end: addDays(start, dur) });
  });
  return res;
}

function buildSchedule(rawList, project, statusDate = new Date()) {
  const list = rawList.map(normalize);
  const deadline = project.deadline ? new Date(project.deadline) : null;
  const at = new Date(statusDate);
  if (!list.length) {
    return { activities: [], projectEnd: null, baselineEnd: null, deadline, totalSlipDays: 0, daysBeyondDeadline: 0, deadlineMissed: false, delayedCount: 0 };
  }
  const { order, succ } = topoSort(list);
  const byId = new Map(list.map((a) => [a.id, a]));
  const base = forwardPass(list, order, project.startDate, false);
  const cur = forwardPass(list, order, project.startDate, true);
  const maxEnd = (m) => new Date(Math.max(...[...m.values()].map((v) => v.end.getTime())));
  const projectEnd = maxEnd(cur);
  const baselineEnd = maxEnd(base);

  // Backward pass -> float & critical path
  const LF = new Map();
  [...order].reverse().forEach((id) => {
    const s = succ.get(id);
    let lf = projectEnd;
    if (s.length) {
      lf = new Date(
        Math.min(...s.map((x) => addDays(LF.get(x), -(byId.get(x).durationDays + byId.get(x).delayDays)).getTime()))
      );
    }
    LF.set(id, lf);
  });

  // Delay propagation: which delayed activities cause each activity's slip
  const causes = new Map();
  order.forEach((id) => {
    const a = byId.get(id);
    const c = new Set();
    if (a.delayDays > 0) c.add(id);
    const s = cur.get(id).start;
    if (diffDays(s, base.get(id).start) > 0) {
      a.predecessors.forEach((p) => {
        if (cur.get(p).end.getTime() === s.getTime() && diffDays(cur.get(p).end, base.get(p).end) > 0) {
          causes.get(p).forEach((x) => c.add(x));
        }
      });
    }
    causes.set(id, c);
  });

  const activities = list.map((a) => {
    const c = cur.get(a.id);
    const b = base.get(a.id);
    const slipDays = diffDays(c.end, b.end);
    const floatDays = diffDays(LF.get(a.id), c.end);
    const delayed = a.delayDays > 0;
    const overdue = a.percentComplete < 100 && c.end < at;
    let status = 'Not Started';
    if (a.percentComplete >= 100) status = 'Completed';
    else if (delayed || slipDays > 0 || overdue) status = 'Delayed';
    else if (at >= c.start) status = 'In Progress';
    return {
      id: a.id,
      name: a.name,
      assignee: a.assignee,
      durationDays: a.durationDays,
      delayDays: a.delayDays,
      predecessors: a.predecessors,
      predecessorNames: a.predecessors.map((p) => byId.get(p).name),
      plannedCost: a.plannedCost,
      actualCost: a.actualCost,
      percentComplete: a.percentComplete,
      baselineStart: b.start,
      baselineEnd: b.end,
      start: c.start,
      end: c.end,
      slipDays,
      floatDays,
      critical: floatDays === 0,
      delayed,
      overdue,
      status,
      causedBy: [...causes.get(a.id)].filter((x) => x !== a.id).map((x) => byId.get(x).name),
      impactedActivities: list
        .filter((x) => x.id !== a.id && causes.get(x.id).has(a.id))
        .map((x) => x.name),
    };
  });

  const beyond = deadline ? diffDays(projectEnd, deadline) : 0;
  return {
    activities,
    projectEnd,
    baselineEnd,
    deadline,
    totalSlipDays: diffDays(projectEnd, baselineEnd),
    daysBeyondDeadline: Math.max(0, beyond),
    deadlineMissed: beyond > 0,
    delayedCount: activities.filter((a) => a.delayed || a.overdue).length,
  };
}

// Effect of an APPROVED change request on budget + deadline
function applyChangeImpact(budget, deadline, costImpact, scheduleImpactDays) {
  return { budget: Number(budget) + Number(costImpact), deadline: addDays(deadline, Number(scheduleImpactDays)) };
}

module.exports = { addDays, diffDays, normalize, topoSort, buildSchedule, applyChangeImpact };