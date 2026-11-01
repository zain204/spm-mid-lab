require('dotenv').config();
const mongoose = require('mongoose');
const M = require('./models');
const { addDays } = require('./utils/scheduler');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all(Object.values(M).map((m) => m.deleteMany({})));
  await Promise.all(Object.values(M).map((m) => m.syncIndexes()));

  // Project started 8 weeks ago so the project is mid-way today (EVM is time based)
  const t = new Date();
  const today = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()));
  const start = addDays(today, -56);

  await M.Project.create({
    name: 'Smart Healthcare Project Management and Monitoring System',
    objectives: [
      'Deliver an integrated system for appointments, lab reports, doctor schedules, online consultations and billing',
      'Complete the project within 16 weeks and PKR 5,000,000',
      'Roll out to all five hospitals with zero critical defects at go-live',
    ],
    stakeholders: [
      { name: 'Hospital Management Board', role: 'Sponsor', interest: 'Approves budget, scope and changes' },
      { name: 'Doctors and Nurses', role: 'End user', interest: 'Scheduling and consultation workflow' },
      { name: 'Laboratory Staff', role: 'End user', interest: 'Lab report management' },
      { name: 'Billing Department', role: 'End user', interest: 'Accurate invoicing' },
      { name: 'Patients', role: 'End user', interest: 'Easy appointment booking' },
    ],
    scopeIn: ['Patient appointments', 'Doctor schedules', 'Laboratory reports', 'Online consultations', 'Hospital billing', 'Multi-hospital support (5 hospitals)'],
    scopeOut: ['Pharmacy inventory', 'Hardware procurement', 'Insurance claim integration'],
    approvedBudget: 5000000,
    originalBudget: 5000000,
    startDate: start,
    deadline: addDays(start, 112),
    originalDeadline: addDays(start, 112),
    status: 'Executing',
    plan: {
      scope: 'Eight approved requirements (R-001 to R-008) decomposed into a 3-deliverable WBS. Changes only through the change request process.',
      schedule: '16 weeks (112 days), finish-to-start dependencies, critical path tracked automatically.',
      cost: 'Budget at completion PKR 5,000,000, tracked with EVM. Warning thresholds CPI < 0.90 and SPI < 0.90.',
      quality: 'Checklist-based inspection per deliverable, defect tracking by severity, no go-live with open critical defects.',
    },
    milestones: [
      { name: 'Requirements and design baselined', date: addDays(start, 28), status: 'Achieved' },
      { name: 'Core modules complete', date: addDays(start, 49), status: 'Missed' },
      { name: 'Integration complete', date: addDays(start, 77), status: 'Pending' },
      { name: 'Go-live at all five hospitals', date: addDays(start, 112), status: 'Pending' },
    ],
    responsibilities: [
      { member: 'Ayesha Khan', role: 'Project Manager', responsibility: 'Planning, monitoring, stakeholder communication, change control' },
      { member: 'Ali Raza', role: 'Backend Developer', responsibility: 'Appointments, doctor schedules, consultation services' },
      { member: 'Hamza Ahmed', role: 'Backend Developer', responsibility: 'Lab reports, billing, integration' },
      { member: 'Sara Malik', role: 'Frontend Developer', responsibility: 'Patient and appointment screens' },
      { member: 'Kamran Ali', role: 'Frontend Developer', responsibility: 'Lab, billing and consultation screens' },
      { member: 'Usman Tariq', role: 'Database Developer', responsibility: 'Schema design, performance, data migration' },
      { member: 'Noor Fatima', role: 'QA Engineer', responsibility: 'Test planning, defect verification, release sign-off' },
    ],
    thresholds: { cpi: 0.9, spi: 0.9 },
  });

  const [pm, be1, be2, fe1, fe2, dbd, qa] = await M.Member.insertMany([
    { name: 'Ayesha Khan', role: 'Project Manager' },
    { name: 'Ali Raza', role: 'Backend Developer' },
    { name: 'Hamza Ahmed', role: 'Backend Developer' },
    { name: 'Sara Malik', role: 'Frontend Developer' },
    { name: 'Kamran Ali', role: 'Frontend Developer' },
    { name: 'Usman Tariq', role: 'Database Developer' },
    { name: 'Noor Fatima', role: 'QA Engineer' },
  ]);

  const reqList = await M.Requirement.insertMany([
    { code: 'R-001', title: 'Patient appointment booking', priority: 'High', status: 'Approved', description: 'Patients book, reschedule and cancel appointments' },
    { code: 'R-002', title: 'Doctor schedule management', priority: 'High', status: 'Approved', description: 'Doctors define availability and shifts' },
    { code: 'R-003', title: 'Laboratory report management', priority: 'High', status: 'Approved', description: 'Lab staff upload and share reports' },
    { code: 'R-004', title: 'Online consultation', priority: 'Medium', status: 'Approved', description: 'Video or chat consultation' },
    { code: 'R-005', title: 'Hospital billing and invoicing', priority: 'High', status: 'Approved', description: 'Invoices, payments, receipts' },
    { code: 'R-006', title: 'Multi-hospital support and role-based access', priority: 'High', status: 'Approved', description: 'Five hospitals, role permissions' },
    { code: 'R-007', title: 'Patient record management', priority: 'High', status: 'Approved', description: 'Create, update and secure patient records' },
    { code: 'R-008', title: 'Reporting and notifications', priority: 'Low', status: 'Approved', description: 'SMS/email reminders and summary reports' },
    { code: 'R-009', title: 'AI-based preliminary diagnosis module', priority: 'Medium', status: 'Proposed', description: 'Requested by hospital management after development began' },
    { code: 'R-010', title: 'Patient mobile application', priority: 'Medium', status: 'Proposed', description: 'Requested by hospital management after development began' },
  ]);
  const R = Object.fromEntries(reqList.map((r) => [r.code, r]));

  // WBS
  const d1 = await M.WbsNode.create({ code: '1', name: 'Planning and Design', type: 'Deliverable' });
  const d2 = await M.WbsNode.create({ code: '2', name: 'Core Healthcare Modules', type: 'Deliverable' });
  const d3 = await M.WbsNode.create({ code: '3', name: 'Integration, Testing and Deployment', type: 'Deliverable' });
  const wp = async (code, name, parent) => M.WbsNode.create({ code, name, type: 'WorkPackage', parent: parent._id });
  const w11 = await wp('1.1', 'Requirements Analysis', d1);
  const w12 = await wp('1.2', 'System and Database Design', d1);
  const w21 = await wp('2.1', 'Appointment and Doctor Schedule Backend', d2);
  const w22 = await wp('2.2', 'Lab Reports and Billing Backend', d2);
  const w23 = await wp('2.3', 'Patient and Appointment UI', d2);
  const w24 = await wp('2.4', 'Lab, Billing and Consultation UI', d2);
  const w25 = await wp('2.5', 'Online Consultation Module', d2);
  const w31 = await wp('3.1', 'System Integration', d3);
  const w32 = await wp('3.2', 'System Testing', d3);
  const w33 = await wp('3.3', 'Deployment and Training', d3);

  // Activities (original scope = exactly PKR 5,000,000 / 112 days)
  const A = {};
  const act = async (key, name, reqCode, member, dur, cost, preds, wbs, extra = {}) => {
    A[key] = await M.Activity.create({
      name, requirement: R[reqCode]._id, assignee: member._id, durationDays: dur, plannedCost: cost,
      predecessors: preds.map((p) => A[p]._id), wbs: wbs._id, ...extra,
    });
  };
  await act('a1', 'Requirements Analysis', 'R-006', pm, 14, 300000, [], w11, { percentComplete: 100, actualCost: 320000 });
  await act('a2', 'System and Database Design', 'R-007', dbd, 14, 400000, ['a1'], w12, { percentComplete: 100, actualCost: 410000 });
  await act('a3', 'Backend: Appointments and Doctor Schedules', 'R-001', be1, 21, 650000, ['a2'], w21, { percentComplete: 90, actualCost: 720000, delayDays: 10, delayReason: 'Slot-conflict logic rework after critical defect' });
  await act('a4', 'Backend: Lab Reports and Billing', 'R-005', be2, 21, 650000, ['a2'], w22, { percentComplete: 80, actualCost: 640000, delayDays: 7, delayReason: 'Lab report format change' });
  await act('a5', 'Frontend: Patient and Appointment UI', 'R-002', fe1, 21, 550000, ['a2'], w23, { percentComplete: 100, actualCost: 560000 });
  await act('a6', 'Frontend: Lab, Billing and Consultation UI', 'R-003', fe2, 21, 550000, ['a2'], w24, { percentComplete: 90, actualCost: 520000 });
  await act('a7', 'Online Consultation Module', 'R-004', be1, 14, 450000, ['a3'], w25, { percentComplete: 20, actualCost: 120000 });
  await act('a8', 'System Integration', 'R-008', be2, 14, 450000, ['a4', 'a5', 'a6', 'a7'], w31);
  await act('a9', 'System Testing', 'R-008', qa, 21, 500000, ['a8'], w32);
  await act('a10', 'Deployment and Training', 'R-006', pm, 14, 500000, ['a9'], w33);

  // Change requests (pending): approving them demonstrates scope + schedule + budget impact
  const cr1 = await M.ChangeRequest.create({
    title: 'Add AI-based preliminary diagnosis module',
    description: 'Hospital management requests an AI module that suggests a preliminary diagnosis from symptoms.',
    justification: 'Reduces consultation time and supports doctors in triage across all five hospitals.',
    requirement: R['R-009']._id,
    costImpact: 450000,
    scheduleImpactDays: 10,
    requestedBy: 'Hospital Management Board',
    proposedActivities: [{ name: 'AI Diagnosis Module', assignee: be2._id, durationDays: 10, plannedCost: 450000, predecessorNames: ['Deployment and Training'] }],
  });
  const cr2 = await M.ChangeRequest.create({
    title: 'Add patient mobile application',
    description: 'Mobile app for patients to book appointments and view lab reports.',
    justification: 'Most patients use smartphones; the app increases adoption and reduces front-desk load.',
    requirement: R['R-010']._id,
    costImpact: 350000,
    scheduleImpactDays: 11,
    requestedBy: 'Hospital Management Board',
    proposedActivities: [{ name: 'Mobile Application', assignee: fe1._id, durationDays: 11, plannedCost: 350000, predecessorNames: ['Deployment and Training', 'AI Diagnosis Module'] }],
  });
  await M.Requirement.findByIdAndUpdate(R['R-009']._id, { changeRequest: cr1._id });
  await M.Requirement.findByIdAndUpdate(R['R-010']._id, { changeRequest: cr2._id });

  // Defects
  await M.Defect.insertMany([
    { title: 'Appointment double-booking when two patients select the same slot', description: 'Race condition in slot reservation', severity: 'Critical', status: 'Open', assignedTo: be1._id, activity: A.a3._id },
    { title: 'Patient record overwritten on concurrent update', description: 'Last write wins, clinical notes lost', severity: 'Critical', status: 'In Progress', assignedTo: be2._id, activity: A.a2._id },
    { title: 'Doctor schedule shows wrong timezone offset', severity: 'Major', status: 'Open', assignedTo: fe1._id, activity: A.a5._id },
    { title: 'Lab report PDF header misaligned', severity: 'Minor', status: 'Resolved', assignedTo: fe2._id, activity: A.a6._id },
  ]);

  // Quality checklists
  await M.QualityCheck.create([
    { deliverable: 'Appointment Scheduling Module', inspector: 'Noor Fatima', testingNotes: 'Double-booking test failed under concurrent load', items: [
      { text: 'Slot availability validation', result: 'Pass' },
      { text: 'Double-booking prevention', result: 'Fail', notes: 'Defect logged (Critical)' },
      { text: 'Reminder notifications', result: 'Pass' } ] },
    { deliverable: 'Patient Record Management', inspector: 'Noor Fatima', items: [
      { text: 'Create and update records', result: 'Pass' },
      { text: 'Concurrent edit safety', result: 'Fail', notes: 'Defect logged (Critical)' },
      { text: 'Audit trail', result: 'Pending' } ] },
    { deliverable: 'Billing Module', inspector: 'Noor Fatima', items: [
      { text: 'Invoice total calculation', result: 'Pass' },
      { text: 'Tax and discount rules', result: 'Pass' } ] },
  ]);

  // Risks
  await M.Risk.create([
    { title: 'Concurrent bookings cause duplicate appointments', category: 'Technical', likelihood: 4, impact: 5, owner: be1._id, status: 'Occurred',
      preventiveAction: 'Unique DB index on doctor+slot and optimistic locking', trigger: 'Duplicate booking reported', correctiveAction: 'Hotfix release and manual reconciliation of affected appointments' },
    { title: 'Scope creep from hospital management', category: 'Scope', likelihood: 4, impact: 4, owner: pm._id, status: 'Occurred',
      preventiveAction: 'Strict change control with sponsor sign-off', trigger: 'New requirement raised outside CR process', correctiveAction: 'Re-baseline cost and schedule after CR approval' },
    { title: 'AI diagnosis accuracy and regulatory concerns', category: 'Technical', likelihood: 3, impact: 5, owner: be2._id, status: 'Open',
      preventiveAction: 'Doctor-in-the-loop design and clinical validation', trigger: 'Validation accuracy below target', correctiveAction: 'Restrict AI to suggestion-only mode' },
    { title: 'Patient data privacy breach', category: 'Security', likelihood: 2, impact: 5, owner: dbd._id, status: 'Open',
      preventiveAction: 'Encryption, role-based access, audit logging', trigger: 'Suspicious access detected', correctiveAction: 'Incident response plan and hospital notification' },
    { title: 'Legacy data migration from five hospitals', category: 'Schedule', likelihood: 3, impact: 3, owner: dbd._id, status: 'Mitigating',
      preventiveAction: 'Migration dry-runs on sample data', trigger: 'Migration error rate above 2%', correctiveAction: 'Add temporary migration support resource' },
    { title: 'Key developer unavailable', category: 'Resource', likelihood: 2, impact: 4, owner: pm._id, status: 'Open',
      preventiveAction: 'Pair work and documentation', trigger: 'Developer absent more than 3 days', correctiveAction: 'Reassign tasks and re-plan critical path' },
    { title: 'Mobile platform compatibility issues', category: 'Technical', likelihood: 3, impact: 2, owner: fe1._id, status: 'Open',
      preventiveAction: 'Test on a device matrix early', trigger: 'Device-specific bug count rising', correctiveAction: 'Limit supported OS versions' },
  ]);

  console.log('Seed complete. Start date:', start.toISOString().slice(0, 10));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});