const express = require('express');
const { Project, Member, Requirement, WbsNode, Activity, ChangeRequest, Defect, QualityCheck, Risk } = require('./models');
const { buildSchedule, topoSort, normalize, applyChangeImpact } = require('./utils/scheduler');
const { computeEVM } = require('./utils/evm');
const { riskBand } = require('./utils/risk');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const fail = (msg, status = 400) => {
  const e = new Error(msg);
  e.status = status;
  return e;
};
const money = (n) => 'PKR ' + Math.round(n).toLocaleString('en-US');
const natural = (a, b) => a.code.localeCompare(b.code, undefined, { numeric: true });

const getProject = async () => {
  const p = await Project.findOne();
  if (!p) throw fail('Project charter not created yet. Run "npm run seed" or create the charter first.', 404);
  return p;
};
const parseStatusDate = (q) => {
  const d = q ? new Date(q) : new Date();
  if (isNaN(d)) throw fail('Invalid statusDate');
  return d;
};
const loadActivities = () => Activity.find().populate('assignee', 'name role').sort({ _id: 1 });
const projectedEnd = async (project) => {
  const acts = await Activity.find();
  return acts.length ? buildSchedule(acts, project).projectEnd : null;
};

// Generic CRUD factory
function crud(path, Model, o = {}) {
  const { populate, sort = { _id: 1 }, beforeSave, beforeDelete } = o;
  router.get(path, wrap(async (req, res) => {
    let q = Model.find().sort(sort);
    if (populate) q = q.populate(populate);
    res.json(await q);
  }));
  router.post(path, wrap(async (req, res) => {
    if (beforeSave) await beforeSave(req.body, null);
    res.status(201).json(await Model.create(req.body));
  }));
  router.put(`${path}/:id`, wrap(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) throw fail('Record not found', 404);
    if (beforeSave) await beforeSave(req.body, doc);
    doc.set(req.body);
    await doc.save();
    res.json(doc);
  }));
  router.delete(`${path}/:id`, wrap(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) throw fail('Record not found', 404);
    if (beforeDelete) await beforeDelete(doc);
    await doc.deleteOne();
    res.json({ deleted: true });
  }));
}

// =====================  MODULE 1: PROJECT  =====================
router.get('/project', wrap(async (req, res) => res.json(await getProject())));

router.post('/project', wrap(async (req, res) => {
  if (await Project.findOne()) throw fail('Project charter already exists. Update it instead.', 409);
  const b = req.body;
  if (new Date(b.deadline) <= new Date(b.startDate)) throw fail('Deadline must be after the start date');
  const p = await Project.create({ ...b, originalBudget: b.approvedBudget, originalDeadline: b.deadline });
  res.status(201).json(p);
}));

router.put('/project', wrap(async (req, res) => {
  const p = await getProject();
  const b = { ...req.body };
  ['changeLog', 'originalBudget', 'originalDeadline', 'closure'].forEach((k) => delete b[k]);
  const start = new Date(b.startDate || p.startDate);
  const dl = new Date(b.deadline || p.deadline);
  if (dl <= start) throw fail('Deadline must be after the start date');
  if (b.approvedBudget !== undefined) {
    const acts = await Activity.find();
    const total = acts.reduce((s, a) => s + a.plannedCost, 0);
    if (Number(b.approvedBudget) < total)
      throw fail(`Approved budget cannot be lower than total planned activity cost (${money(total)})`);
  }
  if (b.status === 'Closed') throw fail('Use the project closure action to close the project');
  p.set(b);
  await p.save();
  res.json(p);
}));

router.post('/project/close', wrap(async (req, res) => {
  const p = await getProject();
  const problems = [];
  const acts = await Activity.find();
  const incomplete = acts.filter((a) => a.percentComplete < 100);
  if (incomplete.length) problems.push(`${incomplete.length} activities are not 100% complete`);
  const crit = await Defect.countDocuments({ severity: 'Critical', status: { $in: ['Open', 'In Progress'] } });
  if (crit) problems.push(`${crit} critical defects are unresolved`);
  const pend = await ChangeRequest.countDocuments({ status: 'Pending' });
  if (pend) problems.push(`${pend} change requests are still pending`);
  if (problems.length) throw fail('Cannot close project: ' + problems.join('; '), 409);
  p.status = 'Closed';
  p.closure = {
    closedAt: new Date(),
    deliverablesAccepted: !!req.body.deliverablesAccepted,
    lessonsLearned: req.body.lessonsLearned || '',
    finalNotes: req.body.finalNotes || '',
  };
  await p.save();
  res.json(p);
}));

router.post('/project/reopen', wrap(async (req, res) => {
  const p = await getProject();
  p.status = 'Executing';
  p.closure = {};
  await p.save();
  res.json(p);
}));

// =====================  TEAM  =====================
crud('/members', Member, {
  beforeDelete: async (doc) => {
    const n = await Activity.countDocuments({ assignee: doc._id });
    if (n) throw fail(`Cannot delete: member is assigned to ${n} activities`, 409);
  },
});

// =====================  MODULE 2: SCOPE  =====================
crud('/requirements', Requirement, {
  sort: { code: 1 },
  populate: 'changeRequest',
  beforeSave: async (b, doc) => {
    if (b.title !== undefined && !String(b.title).trim()) throw fail('Requirement title is required');
    if (b.status === 'Approved' && (!doc || doc.status !== 'Approved')) {
      const crId = b.changeRequest || (doc && doc.changeRequest);
      if (crId) {
        const cr = await ChangeRequest.findById(crId);
        if (cr && cr.status !== 'Approved')
          throw fail('This requirement belongs to a change request. It can only be approved by approving the change request.');
      }
    }
    if (doc && doc.status === 'Approved' && b.status && b.status !== 'Approved') {
      const n = await Activity.countDocuments({ requirement: doc._id });
      if (n) throw fail(`Cannot remove approval: ${n} activities depend on this requirement`, 409);
    }
  },
  beforeDelete: async (doc) => {
    const n = await Activity.countDocuments({ requirement: doc._id });
    if (n) throw fail(`Cannot delete: ${n} activities are linked to this requirement`, 409);
  },
});

router.get('/wbs/tree', wrap(async (req, res) => {
  const [nodes, acts, project] = await Promise.all([WbsNode.find(), Activity.find(), getProject()]);
  const costByWp = {};
  acts.forEach((a) => {
    if (a.wbs) costByWp[String(a.wbs)] = (costByWp[String(a.wbs)] || 0) + a.plannedCost;
  });
  const deliverables = nodes
    .filter((n) => n.type === 'Deliverable')
    .sort(natural)
    .map((d) => {
      const children = nodes
        .filter((w) => String(w.parent) === String(d._id))
        .sort(natural)
        .map((w) => ({
          id: w._id,
          code: w.code,
          name: w.name,
          type: w.type,
          cost: costByWp[String(w._id)] || 0,
          activities: acts.filter((a) => String(a.wbs) === String(w._id)).map((a) => a.name),
        }));
      return { id: d._id, code: d.code, name: d.name, type: d.type, cost: children.reduce((s, c) => s + c.cost, 0), children };
    });
  res.json({ id: 'root', code: '0', name: project.name, type: 'Project', cost: deliverables.reduce((s, d) => s + d.cost, 0), children: deliverables });
}));

crud('/wbs', WbsNode, {
  sort: { code: 1 },
  beforeSave: async (b, doc) => {
    const m = { ...(doc ? doc.toObject() : {}), ...b };
    if (m.type === 'Deliverable' && m.parent) throw fail('A deliverable is top-level and cannot have a parent');
    if (m.type === 'WorkPackage') {
      if (!m.parent) throw fail('A work package must belong to a deliverable');
      const parent = await WbsNode.findById(m.parent);
      if (!parent || parent.type !== 'Deliverable') throw fail('Work package parent must be a deliverable');
    }
  },
  beforeDelete: async (doc) => {
    const kids = await WbsNode.countDocuments({ parent: doc._id });
    if (kids) throw fail(`Cannot delete: ${kids} work packages exist under this deliverable`, 409);
    const acts = await Activity.countDocuments({ wbs: doc._id });
    if (acts) throw fail(`Cannot delete: ${acts} activities are linked to this work package`, 409);
  },
});

// ---- Change requests ----
function validateCR(b) {
  if (!b.title || !String(b.title).trim()) throw fail('Change request title is required');
  if (!b.justification || !String(b.justification).trim()) throw fail('Justification is required');
  const cost = Number(b.costImpact);
  const days = Number(b.scheduleImpactDays);
  if (isNaN(cost) || cost < 0) throw fail('Cost impact must be a non-negative number');
  if (!Number.isInteger(days) || days < 0) throw fail('Schedule impact must be a non-negative whole number of days');
  const pa = b.proposedActivities || [];
  if (pa.length && !b.requirement) throw fail('A change request with proposed activities must be linked to a requirement');
  const sum = pa.reduce((s, a) => s + Number(a.plannedCost || 0), 0);
  if (sum > cost) throw fail(`Proposed activity cost ${money(sum)} exceeds the declared cost impact ${money(cost)}`);
}

router.get('/changes', wrap(async (req, res) => {
  res.json(await ChangeRequest.find().populate('requirement', 'code title').sort({ _id: 1 }));
}));
router.post('/changes', wrap(async (req, res) => {
  validateCR(req.body);
  const cr = await ChangeRequest.create({ ...req.body, status: 'Pending' });
  if (cr.requirement) await Requirement.findByIdAndUpdate(cr.requirement, { changeRequest: cr._id });
  res.status(201).json(cr);
}));
router.put('/changes/:id', wrap(async (req, res) => {
  const cr = await ChangeRequest.findById(req.params.id);
  if (!cr) throw fail('Change request not found', 404);
  if (cr.status !== 'Pending') throw fail(`A ${cr.status} change request cannot be edited`, 409);
  const b = { ...req.body };
  delete b.status;
  validateCR({ ...cr.toObject(), ...b });
  cr.set(b);
  await cr.save();
  res.json(cr);
}));
router.delete('/changes/:id', wrap(async (req, res) => {
  const cr = await ChangeRequest.findById(req.params.id);
  if (!cr) throw fail('Change request not found', 404);
  if (cr.status !== 'Pending') throw fail(`A ${cr.status} change request cannot be deleted`, 409);
  await cr.deleteOne();
  res.json({ deleted: true });
}));

// Approve / reject: approval updates scope, schedule and budget
router.put('/changes/:id/decision', wrap(async (req, res) => {
  const { status, note } = req.body;
  if (!['Approved', 'Rejected'].includes(status)) throw fail('Decision must be "Approved" or "Rejected"');
  const cr = await ChangeRequest.findById(req.params.id);
  if (!cr) throw fail('Change request not found', 404);
  if (cr.status !== 'Pending') throw fail(`Change request is already ${cr.status}`, 409);

  const project = await getProject();
  const before = { budget: project.approvedBudget, deadline: project.deadline, projectedEnd: await projectedEnd(project) };
  const added = [];
  let requirementApproved = null;

  if (status === 'Approved') {
    if (cr.requirement) {
      const r = await Requirement.findByIdAndUpdate(cr.requirement, { status: 'Approved' }, { new: true });
      requirementApproved = r ? `${r.code} - ${r.title}` : null;
    }
    const upd = applyChangeImpact(project.approvedBudget, project.deadline, cr.costImpact, cr.scheduleImpactDays);
    project.approvedBudget = upd.budget;
    project.deadline = upd.deadline;
    project.changeLog.push({ date: new Date(), crTitle: cr.title, costImpact: cr.costImpact, scheduleImpactDays: cr.scheduleImpactDays });
    await project.save();

    if (cr.proposedActivities.length) {
      let holder = await WbsNode.findOne({ code: 'D-CR' });
      if (!holder) holder = await WbsNode.create({ code: 'D-CR', name: 'Approved Change Requests', type: 'Deliverable' });
      const all = await Activity.find();
      const byName = new Map(all.map((a) => [a.name, a._id]));
      let n = await WbsNode.countDocuments({ parent: holder._id });
      for (const pa of cr.proposedActivities) {
        const preds = (pa.predecessorNames || []).map((nm) => byName.get(nm)).filter(Boolean);
        n += 1;
        const wp = await WbsNode.create({ code: `D-CR.${n}`, name: pa.name, type: 'WorkPackage', parent: holder._id });
        const act = await Activity.create({
          name: pa.name,
          requirement: cr.requirement,
          assignee: pa.assignee,
          durationDays: pa.durationDays,
          plannedCost: pa.plannedCost,
          predecessors: preds,
          wbs: wp._id,
          changeRequest: cr._id,
        });
        byName.set(act.name, act._id);
        added.push(act.name);
      }
    }
  }

  cr.status = status;
  cr.decidedAt = new Date();
  cr.decisionNote = note || '';
  await cr.save();

  const p2 = await getProject();
  const after = { budget: p2.approvedBudget, deadline: p2.deadline, projectedEnd: await projectedEnd(p2) };
  res.json({
    changeRequest: cr,
    impact: {
      decision: status,
      scope: { requirementApproved, activitiesAdded: added },
      budget: { before: before.budget, after: after.budget, delta: after.budget - before.budget },
      deadline: { before: before.deadline, after: after.deadline, deltaDays: cr.status === 'Approved' ? cr.scheduleImpactDays : 0 },
      projectedEnd: { before: before.projectedEnd, after: after.projectedEnd },
    },
  });
}));

// =====================  MODULE 3: ACTIVITIES / SCHEDULE  =====================
async function validateActivity(b, doc) {
  const m = { ...(doc ? doc.toObject() : {}), ...b };
  if (!m.name || !String(m.name).trim()) throw fail('Activity name is required');
  const dur = Number(m.durationDays);
  if (!Number.isInteger(dur) || dur < 1) throw fail('Duration must be a whole number of days (minimum 1)');
  if (isNaN(Number(m.plannedCost)) || Number(m.plannedCost) < 0) throw fail('Planned cost must be a non-negative number');
  if (isNaN(Number(m.actualCost || 0)) || Number(m.actualCost || 0) < 0) throw fail('Actual cost must be a non-negative number');
  if (Number(m.percentComplete || 0) < 0 || Number(m.percentComplete || 0) > 100) throw fail('Percent complete must be between 0 and 100');
  if (Number(m.delayDays || 0) < 0) throw fail('Delay cannot be negative');
  if (!m.requirement) throw fail('Every activity must be linked to an approved requirement');

  const reqDoc = await Requirement.findById(m.requirement);
  if (!reqDoc) throw fail('Linked requirement not found');
  if (reqDoc.status !== 'Approved')
    throw fail(`Requirement ${reqDoc.code} is "${reqDoc.status}". Unapproved requirements cannot be included in the approved scope - raise and approve a change request first.`);
  if (m.assignee && !(await Member.findById(m.assignee))) throw fail('Assigned team member not found');

  const others = await Activity.find(doc ? { _id: { $ne: doc._id } } : {});
  const tempId = doc ? String(doc._id) : '__new__';
  const preds = (m.predecessors || []).map(String);
  const list = [...others.map(normalize), { id: tempId, name: m.name, predecessors: preds, durationDays: dur, delayDays: 0 }];
  topoSort(list); // throws on cycle / self dependency / unknown predecessor

  const project = await getProject();
  const total = others.reduce((s, a) => s + a.plannedCost, 0) + Number(m.plannedCost);
  if (total > project.approvedBudget)
    throw fail(`Total planned cost ${money(total)} would exceed the approved budget ${money(project.approvedBudget)}. Raise a change request.`);
}

crud('/activities', Activity, {
  populate: [{ path: 'assignee', select: 'name role' }, { path: 'requirement', select: 'code title status' }],
  beforeSave: validateActivity,
  beforeDelete: async (doc) => {
    const n = await Activity.countDocuments({ predecessors: doc._id });
    if (n) throw fail(`Cannot delete: ${n} activities depend on this activity`, 409);
  },
});

router.get('/schedule', wrap(async (req, res) => {
  const project = await getProject();
  const statusDate = parseStatusDate(req.query.statusDate);
  const sched = buildSchedule(await loadActivities(), project, statusDate);
  res.json({ statusDate, startDate: project.startDate, milestones: project.milestones, ...sched });
}));

// =====================  MODULE 4: EVM  =====================
router.get('/evm', wrap(async (req, res) => {
  const project = await getProject();
  const statusDate = parseStatusDate(req.query.statusDate);
  const sched = buildSchedule(await loadActivities(), project, statusDate);
  const evm = computeEVM(sched.activities, statusDate, project.thresholds, project.approvedBudget);
  res.json({ approvedBudget: project.approvedBudget, ...evm });
}));

// =====================  MODULE 5: QUALITY & RISK  =====================
crud('/defects', Defect, {
  populate: [{ path: 'assignedTo', select: 'name role' }, { path: 'activity', select: 'name' }],
  beforeSave: async (b) => {
    if (b.title !== undefined && !String(b.title).trim()) throw fail('Defect title is required');
    if (b.assignedTo && !(await Member.findById(b.assignedTo))) throw fail('Assigned person not found');
  },
});

crud('/quality', QualityCheck, {
  beforeSave: async (b) => {
    if (b.deliverable !== undefined && !String(b.deliverable).trim()) throw fail('Deliverable name is required');
  },
});

crud('/risks', Risk, { populate: { path: 'owner', select: 'name' }, sort: { score: -1 } });

router.get('/risks/matrix', wrap(async (req, res) => {
  const risks = await Risk.find().sort({ score: -1 });
  const grid = [];
  for (let l = 5; l >= 1; l--)
    for (let i = 1; i <= 5; i++)
      grid.push({
        likelihood: l,
        impact: i,
        score: l * i,
        band: riskBand(l * i),
        risks: risks.filter((r) => r.likelihood === l && r.impact === i).map((r) => ({ id: r._id, title: r.title })),
      });
  res.json({
    ranked: risks.map((r, idx) => ({ rank: idx + 1, id: r._id, title: r.title, category: r.category, likelihood: r.likelihood, impact: r.impact, score: r.score, band: r.band, status: r.status })),
    grid,
  });
}));

// PDPC: Objective -> Problem -> Preventive action -> Trigger -> Corrective action
router.get('/risks/pdpc', wrap(async (req, res) => {
  const project = await getProject();
  const risks = await Risk.find().sort({ score: -1 });
  const groups = {};
  risks.forEach((r) => {
    (groups[r.category] = groups[r.category] || []).push({
      id: r._id,
      problem: r.title,
      score: r.score,
      band: r.band,
      status: r.status,
      preventiveAction: r.preventiveAction,
      trigger: r.trigger,
      correctiveAction: r.correctiveAction,
    });
  });
  res.json({
    objective: `Deliver ${project.name} on time and within budget`,
    categories: Object.entries(groups).map(([category, problems]) => ({ category, problems })),
  });
}));

// =====================  MODULE 6: INTEGRATION / DASHBOARD  =====================
router.get('/consistency', wrap(async (req, res) => {
  const project = await getProject();
  const [reqs, acts, crs, defects] = await Promise.all([Requirement.find(), Activity.find(), ChangeRequest.find(), Defect.find()]);
  const issues = [];
  const covered = new Set(acts.map((a) => String(a.requirement)));
  reqs.filter((r) => r.status === 'Approved' && !covered.has(String(r._id)))
    .forEach((r) => issues.push({ level: 'warning', message: `Approved requirement ${r.code} has no activity` }));
  acts.forEach((a) => {
    const r = reqs.find((x) => String(x._id) === String(a.requirement));
    if (!r || r.status !== 'Approved') issues.push({ level: 'error', message: `Activity "${a.name}" is linked to a non-approved requirement` });
    if (!a.wbs) issues.push({ level: 'info', message: `Activity "${a.name}" is not linked to a WBS work package` });
  });
  const total = acts.reduce((s, a) => s + a.plannedCost, 0);
  if (total > project.approvedBudget) issues.push({ level: 'error', message: `Planned cost ${money(total)} exceeds approved budget ${money(project.approvedBudget)}` });
  crs.filter((c) => c.status === 'Approved' && c.requirement).forEach((c) => {
    const r = reqs.find((x) => String(x._id) === String(c.requirement));
    if (r && r.status !== 'Approved') issues.push({ level: 'error', message: `Approved CR "${c.title}" has a requirement that is not approved` });
  });
  if (project.status === 'Closed' && defects.some((d) => d.severity === 'Critical' && ['Open', 'In Progress'].includes(d.status)))
    issues.push({ level: 'error', message: 'Project is closed but critical defects are unresolved' });
  res.json({ consistent: !issues.some((i) => i.level === 'error'), issues });
}));

router.get('/dashboard', wrap(async (req, res) => {
  const project = await getProject();
  const statusDate = new Date();
  const [acts, reqs, crs, defects, risks] = await Promise.all([
    loadActivities(),
    Requirement.find(),
    ChangeRequest.find().populate('requirement', 'code title').sort({ _id: -1 }),
    Defect.find().populate('assignedTo', 'name'),
    Risk.find().sort({ score: -1 }),
  ]);
  const sched = buildSchedule(acts, project, statusDate);
  const evm = computeEVM(sched.activities, statusDate, project.thresholds, project.approvedBudget);
  const delayed = sched.activities.filter((a) => a.delayed || a.overdue);
  const unresolved = defects.filter((d) => ['Open', 'In Progress'].includes(d.status));
  const critical = unresolved.filter((d) => d.severity === 'Critical');
  const pending = crs.filter((c) => c.status === 'Pending');

  const warnings = [...evm.warnings];
  if (sched.deadlineMissed) warnings.push({ type: 'DEADLINE_AT_RISK', level: 'danger', message: `Projected completion is ${sched.daysBeyondDeadline} days beyond the deadline` });
  if (critical.length) warnings.push({ type: 'CRITICAL_DEFECTS', level: 'danger', message: `${critical.length} critical defects are unresolved` });
  if (pending.length) warnings.push({ type: 'PENDING_CR', level: 'caution', message: `${pending.length} change requests are awaiting a decision` });

  const budgetStatus = evm.AC > project.approvedBudget ? 'Exceeded' : evm.EAC > project.approvedBudget ? 'Forecast overrun' : 'Within budget';

  res.json({
    project: {
      name: project.name,
      status: project.status,
      startDate: project.startDate,
      deadline: project.deadline,
      originalDeadline: project.originalDeadline,
      approvedBudget: project.approvedBudget,
      originalBudget: project.originalBudget,
      changeLog: project.changeLog,
    },
    progress: {
      percentComplete: evm.percentComplete,
      percentPlanned: evm.percentPlanned,
      activitiesTotal: sched.activities.length,
      activitiesCompleted: sched.activities.filter((a) => a.status === 'Completed').length,
    },
    schedule: {
      projectedEnd: sched.projectEnd,
      baselineEnd: sched.baselineEnd,
      deadline: project.deadline,
      totalSlipDays: sched.totalSlipDays,
      daysBeyondDeadline: sched.daysBeyondDeadline,
      deadlineMissed: sched.deadlineMissed,
      delayedActivities: delayed.map((a) => ({ name: a.name, delayDays: a.delayDays, slipDays: a.slipDays, impactedActivities: a.impactedActivities })),
    },
    budget: {
      approved: project.approvedBudget,
      planned: evm.BAC,
      actual: evm.AC,
      remaining: project.approvedBudget - evm.AC,
      forecast: evm.EAC,
      status: budgetStatus,
    },
    evm,
    changeRequests: {
      pending: pending.map((c) => ({ id: c._id, title: c.title, costImpact: c.costImpact, scheduleImpactDays: c.scheduleImpactDays })),
      approved: crs.filter((c) => c.status === 'Approved').length,
      rejected: crs.filter((c) => c.status === 'Rejected').length,
    },
    requirements: {
      approved: reqs.filter((r) => r.status === 'Approved').length,
      proposed: reqs.filter((r) => r.status === 'Proposed').length,
      rejected: reqs.filter((r) => r.status === 'Rejected').length,
    },
    defects: {
      total: defects.length,
      unresolved: unresolved.length,
      bySeverity: ['Critical', 'Major', 'Minor'].map((s) => ({ severity: s, unresolved: unresolved.filter((d) => d.severity === s).length })),
      criticalUnresolved: critical.map((d) => ({ id: d._id, title: d.title, status: d.status, assignedTo: d.assignedTo ? d.assignedTo.name : null })),
    },
    topRisks: risks.slice(0, 3).map((r) => ({ title: r.title, score: r.score, band: r.band })),
    warnings,
  });
}));

module.exports = router;