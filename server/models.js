const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema.Types;
const { riskScore, riskBand } = require('./utils/risk');

const opts = { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } };

// ---------- Module 1: Project charter + plan + status + closure ----------
const ProjectSchema = new Schema(
  {
    name: { type: String, required: [true, 'Project name is required'], trim: true },
    objectives: [String],
    stakeholders: [{ name: { type: String, required: true }, role: String, interest: String }],
    scopeIn: [String],
    scopeOut: [String],
    approvedBudget: { type: Number, required: [true, 'Approved budget is required'], min: [1, 'Budget must be positive'] },
    originalBudget: Number,
    startDate: { type: Date, required: [true, 'Start date is required'] },
    deadline: { type: Date, required: [true, 'Deadline is required'] },
    originalDeadline: Date,
    status: { type: String, enum: ['Initiation', 'Planning', 'Executing', 'Monitoring', 'Closed'], default: 'Planning' },
    plan: { scope: String, schedule: String, cost: String, quality: String },
    milestones: [
      {
        name: { type: String, required: true },
        date: { type: Date, required: true },
        status: { type: String, enum: ['Pending', 'Achieved', 'Missed'], default: 'Pending' },
      },
    ],
    responsibilities: [{ member: String, role: String, responsibility: String }],
    thresholds: { cpi: { type: Number, default: 0.9 }, spi: { type: Number, default: 0.9 } },
    closure: { closedAt: Date, deliverablesAccepted: Boolean, lessonsLearned: String, finalNotes: String },
    changeLog: [{ date: Date, crTitle: String, costImpact: Number, scheduleImpactDays: Number }],
  },
  opts
);

const MemberSchema = new Schema(
  { name: { type: String, required: [true, 'Member name is required'], trim: true }, role: { type: String, required: [true, 'Role is required'] } },
  opts
);

// ---------- Module 2: Scope ----------
const RequirementSchema = new Schema(
  {
    code: { type: String, required: [true, 'Requirement code is required'], unique: true, trim: true },
    title: { type: String, required: [true, 'Requirement title is required'], trim: true },
    description: String,
    priority: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
    status: { type: String, enum: ['Proposed', 'Approved', 'Rejected'], default: 'Proposed' },
    changeRequest: { type: ObjectId, ref: 'ChangeRequest' },
  },
  opts
);

const WbsNodeSchema = new Schema(
  {
    code: { type: String, required: [true, 'WBS code is required'], unique: true, trim: true },
    name: { type: String, required: [true, 'WBS name is required'], trim: true },
    type: { type: String, enum: ['Deliverable', 'WorkPackage'], required: true },
    parent: { type: ObjectId, ref: 'WbsNode', default: null },
  },
  opts
);

const ChangeRequestSchema = new Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true },
    description: String,
    justification: { type: String, required: [true, 'Justification is required'] },
    requirement: { type: ObjectId, ref: 'Requirement' },
    costImpact: { type: Number, required: true, min: [0, 'Cost impact cannot be negative'], default: 0 },
    scheduleImpactDays: { type: Number, required: true, min: [0, 'Schedule impact cannot be negative'], default: 0 },
    requestedBy: String,
    proposedActivities: [
      {
        name: { type: String, required: true },
        assignee: { type: ObjectId, ref: 'Member' },
        durationDays: { type: Number, required: true, min: 1 },
        plannedCost: { type: Number, required: true, min: 0 },
        predecessorNames: [String],
      },
    ],
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    decidedAt: Date,
    decisionNote: String,
  },
  opts
);

// ---------- Module 3 & 4: Activities (schedule + cost) ----------
const ActivitySchema = new Schema(
  {
    name: { type: String, required: [true, 'Activity name is required'], trim: true },
    description: String,
    requirement: { type: ObjectId, ref: 'Requirement', required: [true, 'Activity must be linked to an approved requirement'] },
    assignee: { type: ObjectId, ref: 'Member' },
    wbs: { type: ObjectId, ref: 'WbsNode' },
    changeRequest: { type: ObjectId, ref: 'ChangeRequest' },
    durationDays: { type: Number, required: [true, 'Duration is required'], min: [1, 'Duration must be at least 1 day'] },
    predecessors: [{ type: ObjectId, ref: 'Activity' }],
    plannedCost: { type: Number, required: true, min: [0, 'Planned cost cannot be negative'], default: 0 },
    actualCost: { type: Number, min: [0, 'Actual cost cannot be negative'], default: 0 },
    percentComplete: { type: Number, min: [0, 'Percent must be 0-100'], max: [100, 'Percent must be 0-100'], default: 0 },
    delayDays: { type: Number, min: [0, 'Delay cannot be negative'], default: 0 },
    delayReason: String,
  },
  opts
);

// ---------- Module 5: Quality & Risk ----------
const DefectSchema = new Schema(
  {
    title: { type: String, required: [true, 'Defect title is required'], trim: true },
    description: String,
    severity: { type: String, enum: ['Critical', 'Major', 'Minor'], required: true },
    status: { type: String, enum: ['Open', 'In Progress', 'Resolved', 'Closed'], default: 'Open' },
    assignedTo: { type: ObjectId, ref: 'Member' },
    activity: { type: ObjectId, ref: 'Activity' },
    resolvedAt: Date,
  },
  opts
);
DefectSchema.pre('validate', function (next) {
  if (['Resolved', 'Closed'].includes(this.status)) {
    if (!this.resolvedAt) this.resolvedAt = new Date();
  } else {
    this.resolvedAt = undefined;
  }
  next();
});

const QualityCheckSchema = new Schema(
  {
    deliverable: { type: String, required: [true, 'Deliverable name is required'], trim: true },
    inspector: String,
    items: [
      {
        text: { type: String, required: true },
        result: { type: String, enum: ['Pending', 'Pass', 'Fail'], default: 'Pending' },
        notes: String,
      },
    ],
    testingNotes: String,
    overall: { type: String, enum: ['Not Started', 'In Progress', 'Passed', 'Failed'], default: 'Not Started' },
  },
  opts
);
QualityCheckSchema.pre('validate', function (next) {
  const r = this.items.map((i) => i.result);
  if (!r.length) this.overall = 'Not Started';
  else if (r.includes('Fail')) this.overall = 'Failed';
  else if (r.every((x) => x === 'Pass')) this.overall = 'Passed';
  else this.overall = 'In Progress';
  next();
});

const RiskSchema = new Schema(
  {
    title: { type: String, required: [true, 'Risk title is required'], trim: true },
    description: String,
    category: { type: String, default: 'General' },
    likelihood: { type: Number, required: true, min: [1, 'Likelihood must be 1-5'], max: [5, 'Likelihood must be 1-5'] },
    impact: { type: Number, required: true, min: [1, 'Impact must be 1-5'], max: [5, 'Impact must be 1-5'] },
    score: Number,
    preventiveAction: String,
    trigger: String,
    correctiveAction: String,
    owner: { type: ObjectId, ref: 'Member' },
    status: { type: String, enum: ['Open', 'Mitigating', 'Occurred', 'Closed'], default: 'Open' },
  },
  opts
);
RiskSchema.pre('validate', function (next) {
  this.score = riskScore(this.likelihood, this.impact);
  next();
});
RiskSchema.virtual('band').get(function () {
  return riskBand(this.score);
});

module.exports = {
  Project: mongoose.model('Project', ProjectSchema),
  Member: mongoose.model('Member', MemberSchema),
  Requirement: mongoose.model('Requirement', RequirementSchema),
  WbsNode: mongoose.model('WbsNode', WbsNodeSchema),
  ChangeRequest: mongoose.model('ChangeRequest', ChangeRequestSchema),
  Activity: mongoose.model('Activity', ActivitySchema),
  Defect: mongoose.model('Defect', DefectSchema),
  QualityCheck: mongoose.model('QualityCheck', QualityCheckSchema),
  Risk: mongoose.model('Risk', RiskSchema),
};