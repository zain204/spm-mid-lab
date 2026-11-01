# Smart Healthcare Project Management and Monitoring System

**Course:** CSE-494 Software Project Management (Mid-term Lab, Fall 2026)
**Program:** BSE, COMSATS University Islamabad, Sahiwal Campus
**Stack:** MERN (MongoDB Atlas, Express, React, Node.js)

---

## 1. Project Overview

A working Software Project Management System that lets a project manager plan, execute, monitor and control the "Smart Healthcare" software project for a network of five hospitals. The case study is loaded as realistic sample data:

| Item | Value |
|---|---|
| Hospitals | 5 |
| Original duration | 16 weeks (112 days) |
| Original approved budget | PKR 5,000,000 |
| Team | 1 project manager, 2 backend, 2 frontend, 1 database developer, 1 QA engineer |
| Late scope changes | AI diagnosis module (PKR 450,000, +10 days) and mobile app (PKR 350,000, +11 days) |
| Total change impact | PKR 800,000 and 21 days (3 weeks) |
| Known quality problems | Critical defects in appointment scheduling and patient record management |

All calculations (schedule, critical path, delay impact, earned value, risk score, change impact) are performed **programmatically on the server**, and every major record is stored **persistently in MongoDB**.

---

## 2. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18 + Vite | Interactive GUI (single page application) |
| Backend | Node.js + Express | REST API, business rules, calculations |
| Database | MongoDB Atlas + Mongoose | Persistent storage, schema validation |
| Styling | Plain CSS | Responsive modern UI, no UI library |

---

## 3. Folder Structure

```
spm-system/
├── README.md
├── server/
│   ├── package.json
│   ├── .env                  (database connection string)
│   ├── server.js             (Express app, DB connection, error handler)
│   ├── models.js             (all Mongoose schemas = database schema)
│   ├── routes.js             (REST API + validation + business rules)
│   ├── seed.js               (loads case study sample data)
│   ├── tests.js              (14 automated logic test cases)
│   └── utils/
│       ├── scheduler.js      (schedule, critical path, delay impact, change impact)
│       ├── evm.js            (Earned Value Management)
│       └── risk.js           (risk score and band)
└── client/
    ├── package.json
    ├── index.html
    ├── vite.config.js        (dev server + proxy of /api to port 5000)
    └── src/
        ├── main.jsx          (React entry point)
        ├── App.jsx           (sidebar layout and navigation)
        ├── api.js            (fetch wrapper for the REST API)
        ├── ui.jsx            (shared components and hooks)
        ├── styles.css        (design system)
        └── pages/
            ├── Dashboard.jsx
            ├── Project.jsx       (Module 1)
            ├── Scope.jsx         (Module 2)
            ├── Schedule.jsx      (Module 3)
            ├── Cost.jsx          (Module 4)
            ├── Quality.jsx       (Module 5, defects and checklists)
            └── Risks.jsx         (Module 5, matrix and PDPC)
```

---

## 4. How to Run

### Prerequisites
- Node.js 18 or newer
- A MongoDB Atlas free cluster (or a local MongoDB)

### Step 1: Configure the database
Create `server/.env`:

```
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/spm_healthcare?retryWrites=true&w=majority
```

In Atlas, add `0.0.0.0/0` under Network Access so the server can connect.

### Step 2: Start the backend
```bash
cd server
npm install
npm test          # runs the 14 automated test cases
npm run seed      # loads the case study sample data
npm run dev       # API on http://localhost:5000
```

### Step 3: Start the frontend (new terminal)
```bash
cd client
npm install
npm run dev       # GUI on http://localhost:5173
```

> **Note:** `npm run seed` sets the project start date to 8 weeks before the day it is run, so the project is mid-way and EVM values are meaningful. Run it again before a demo to refresh the data. Seeding deletes all existing data first.

---

## 5. System Architecture

```
React GUI (port 5173)
      |   fetch('/api/...')   (Vite proxy forwards to port 5000)
      v
Express REST API (routes.js)
      |   validation and business rules
      |-- utils/scheduler.js   schedule, critical path, delay propagation, change impact
      |-- utils/evm.js         PV, EV, AC, CPI, SPI, forecasts, warnings
      |-- utils/risk.js        risk score and band
      v
Mongoose models (models.js)
      v
MongoDB Atlas, database "spm_healthcare"
```

**Request flow example (approving a change request):**
1. User clicks **Approve** on the Change Requests tab.
2. React calls `PUT /api/changes/:id/decision`.
3. The server updates the requirement, project budget, project deadline, change log and creates the new activities.
4. The server recalculates the schedule and returns a before/after impact summary.
5. React shows the impact panel, and all other pages show the new data when opened.

**Important design rule:** the browser never calculates project metrics. The GUI only displays what the server computes, so the numbers are always consistent across pages.

---

## 6. Database Design

Database name: **`spm_healthcare`**. Mongoose creates one collection per model. Collection names are the lowercase plural of the model name.

| Collection | Module | Seed documents | What it stores |
|---|---|---|---|
| `projects` | 1 | 1 | Charter, plan, milestones, responsibilities, thresholds, closure record, change log |
| `members` | 3 | 7 | Team members and roles |
| `requirements` | 2 | 10 | Project requirements with priority and approval status |
| `wbsnodes` | 2 | 13 | WBS deliverables and work packages (parent/child tree) |
| `changerequests` | 2 | 2 | Change requests with justification, cost and schedule impact, decision |
| `activities` | 3 and 4 | 10 | Tasks: duration, dependencies, assignee, planned/actual cost, % complete, delay |
| `defects` | 5 | 4 | Defect tracking records |
| `qualitychecks` | 5 | 3 | Quality checklists and inspection results |
| `risks` | 5 | 7 | Risk register with score and response actions |

### 6.1 Collection fields

**projects** (one document)
- `name`, `objectives[]`, `stakeholders[{name, role, interest}]`
- `scopeIn[]`, `scopeOut[]` (scope boundaries)
- `approvedBudget`, `originalBudget`, `startDate`, `deadline`, `originalDeadline`
- `status`: Initiation, Planning, Executing, Monitoring, Closed
- `plan{scope, schedule, cost, quality}` (project management plan)
- `milestones[{name, date, status}]` (Pending, Achieved, Missed)
- `responsibilities[{member, role, responsibility}]`
- `thresholds{cpi, spi}` (warning limits, default 0.90)
- `closure{closedAt, deliverablesAccepted, lessonsLearned, finalNotes}`
- `changeLog[{date, crTitle, costImpact, scheduleImpactDays}]` (filled automatically on approval)

**requirements**: `code` (unique), `title`, `description`, `priority` (High/Medium/Low), `status` (Proposed/Approved/Rejected), `changeRequest` (reference)

**wbsnodes**: `code` (unique), `name`, `type` (Deliverable or WorkPackage), `parent` (reference to another wbsnode)

**changerequests**: `title`, `description`, `justification`, `requirement` (reference), `costImpact`, `scheduleImpactDays`, `requestedBy`, `proposedActivities[]`, `status` (Pending/Approved/Rejected), `decidedAt`, `decisionNote`

**activities**: `name`, `requirement` (reference, required), `assignee` (reference to member), `wbs` (reference to work package), `changeRequest` (reference), `durationDays`, `predecessors[]` (references to other activities), `plannedCost`, `actualCost`, `percentComplete`, `delayDays`, `delayReason`

**defects**: `title`, `description`, `severity` (Critical/Major/Minor), `status` (Open/In Progress/Resolved/Closed), `assignedTo` (reference), `activity` (reference), `resolvedAt`

**qualitychecks**: `deliverable`, `inspector`, `items[{text, result (Pending/Pass/Fail), notes}]`, `testingNotes`, `overall` (calculated)

**risks**: `title`, `category`, `likelihood` (1-5), `impact` (1-5), `score` (calculated), `preventiveAction`, `trigger`, `correctiveAction`, `owner` (reference), `status`

### 6.2 Relationships (consistency between modules)

```
Requirement  <---- Activity.requirement      every activity must belong to an APPROVED requirement
Requirement  <---- ChangeRequest.requirement a change request introduces a requirement
WbsNode      <---- Activity.wbs              activity belongs to a work package
WbsNode      <---- WbsNode.parent            work package belongs to a deliverable
Activity     <---- Activity.predecessors     task dependencies
Member       <---- Activity.assignee         resource assignment
Member       <---- Defect.assignedTo, Risk.owner
Activity     <---- Defect.activity           defects link back to the task
ChangeRequest <--- Activity.changeRequest    activities created by an approved change
```

### 6.3 Where each GUI action is stored

| GUI action | Collection and field |
|---|---|
| Create/edit project charter | `projects` (name, objectives, stakeholders, scope, budget, deadline) |
| Edit project management plan | `projects.plan` |
| Add milestone | `projects.milestones` |
| Close project | `projects.status` and `projects.closure` |
| Add/approve requirement | `requirements` |
| Add WBS element | `wbsnodes` |
| Raise change request | `changerequests` (status Pending) |
| Approve change request | `changerequests.status`, `projects.approvedBudget`, `projects.deadline`, `projects.changeLog`, `requirements.status`, new documents in `activities` and `wbsnodes` |
| Add/update activity (duration, cost, progress, delay) | `activities` |
| Record defect / change status | `defects` |
| Inspection result Pass/Fail | `qualitychecks.items` |
| Add risk | `risks` |

**Calculated values that are NOT stored** (always recomputed from stored data): start/end dates, float, critical path, slip, PV, EV, CPI, SPI, forecasts, dashboard figures. This avoids inconsistent or stale numbers. (`risks.score` and `qualitychecks.overall` are stored as derived fields and recalculated on every save.)

---

## 7. Module Explanation

### Module 1: Project Initiation and Integration Management
**GUI:** *Initiation & Plan* tab (`Project.jsx`). **Data:** `projects`.

- **Project charter:** objectives, stakeholders (name | role | interest), scope included and excluded, approved budget, start date, deadline, status, and CPI/SPI warning thresholds.
- **Project management plan:** four text sections for scope, schedule, cost and quality plans.
- **Milestones:** add, edit, remove, with status Pending/Achieved/Missed. They are drawn on the Gantt chart.
- **Responsibilities:** member, role and responsibility per team member.
- **Project closure:** records lessons learned, final notes and sponsor acceptance.
- **Change log:** read-only table filled automatically when a change request is approved.

**Rules enforced by the server**
- Only one project charter can exist.
- Deadline must be after the start date.
- Approved budget cannot be lower than the total planned activity cost.
- Status `Closed` can only be set through the closure action, not by editing.
- **Closure is blocked** if any activity is below 100%, any critical defect is Open/In Progress, or any change request is Pending.

---

### Module 2: Scope Management and WBS
**GUI:** *Scope & WBS* tab (`Scope.jsx`) with three sub-tabs. **Data:** `requirements`, `wbsnodes`, `changerequests`.

**Requirements management**
- Add, update, delete, prioritize (High/Medium/Low) and approve/reject requirements.
- Only requirements with status **Approved** form the approved scope.

**Hierarchical WBS**
- Three levels: Project → Deliverables → Work Packages.
- The tree is built by `GET /api/wbs/tree`. The server rolls up activity costs from each work package to its deliverable and then to the project total.
- Rules: a deliverable is top level; a work package needs a deliverable as parent; a node with children or linked activities cannot be deleted.

**Change request mechanism**
- Records title, justification, linked requirement, cost impact, schedule impact, requested by, and optionally a proposed activity to add to the schedule.
- Status flow: **Pending → Approved or Rejected**. Only Pending requests can be edited or deleted, and a decision can be made only once.

**Preventing unapproved requirements from entering scope**
- Activities require a linked requirement, and the server rejects the activity if that requirement is not Approved (message: *"Unapproved requirements cannot be included in the approved scope - raise and approve a change request first"*).
- A requirement attached to a change request cannot be approved directly. It becomes Approved only when that change request is approved.
- Approval cannot be removed from a requirement that has activities.

**What happens when a change request is approved** (`PUT /api/changes/:id/decision`):

| Step | Effect |
|---|---|
| 1 | Linked requirement status becomes **Approved** (scope changes) |
| 2 | `projects.approvedBudget` increases by the cost impact (budget changes) |
| 3 | `projects.deadline` moves by the schedule impact days (schedule changes) |
| 4 | An entry is added to `projects.changeLog` |
| 5 | Proposed activities are created in `activities` under WBS deliverable `D-CR` and linked to their predecessors |
| 6 | The change request status becomes Approved and the decision date is saved |
| 7 | The schedule is recalculated and a before/after summary (budget, deadline, projected finish, scope) is returned and shown in the GUI |

Approving both case study change requests changes the budget from **PKR 5,000,000 to PKR 5,800,000** and the deadline by **+21 days (3 weeks)**. Rejecting a request changes nothing.

---

### Module 3: Schedule and Resource Management
**GUI:** *Schedule & Resources* tab (`Schedule.jsx`). **Data:** `activities`, `members`, `projects.milestones`. **Logic:** `utils/scheduler.js`.

**Defining activities:** name, linked approved requirement, assignee, WBS work package, duration (days), predecessors (dependencies), planned cost, actual cost, % complete, delay days and delay reason.

**Schedule generation (forward pass)**
1. Activities are sorted with a **topological sort**. This also detects circular dependencies and self dependencies and rejects them.
2. Dependencies are **finish-to-start**: an activity starts when its latest predecessor finishes (or at project start if it has none).
3. `end = start + duration (+ delay days)`.
4. Two schedules are calculated: the **baseline** (durations only) and the **current** (durations + delays).

**Critical path (backward pass):** the latest allowed finish of each activity is derived from its successors and the project end. `float = latest finish - end`. Activities with float 0 are **critical** (highlighted orange).

**Delayed activity impact**
- `slipDays = current end - baseline end` for each activity.
- The engine tracks which delayed activity **causes** each downstream slip (`causedBy`) and which activities each delay **impacts** (`impactedActivities`).
- A delay on a non-critical branch is **absorbed by float** and does not move the final date. A delay on the critical path pushes the project finish.
- Project level: `totalSlipDays` (projected finish vs baseline finish) and `daysBeyondDeadline` (projected finish vs deadline).

**Activity status:** Completed (100%), Delayed (delay entered, slip > 0, or overdue at the status date), In Progress, Not Started.

**Gantt chart (graphical timeline)** built with HTML/CSS:
- Teal/purple bar = current schedule; red bar = delayed; dark fill = % complete
- Grey line under each bar = original baseline
- Orange outline = critical path
- Diamonds = milestones (green achieved, red missed, purple pending)
- Vertical lines = deadline (red) and today (blue)

**Validation:** unapproved requirement, circular dependency, duration below 1 day, negative cost, percent outside 0-100, negative delay, and total planned cost above approved budget are all rejected. An activity that others depend on, or a member who has activities, cannot be deleted.

A **Team Workload** table shows each member's activities and planned cost.

---

### Module 4: Cost Management and Earned Value Analysis
**GUI:** *Cost & EVM* tab (`Cost.jsx`). **Data:** `activities` (plannedCost, actualCost, percentComplete) and `projects` (thresholds, budget). **Logic:** `utils/evm.js`.

Each activity's `plannedCost` is its budget. The sum of all activity planned costs is the **Budget at Completion (BAC)**.

| Indicator | Formula used in code |
|---|---|
| Planned % | Linear progress between the baseline start and end date, evaluated at the status date (clamped 0% to 100%) |
| **PV** Planned Value | Σ (activity planned cost × planned %) |
| **EV** Earned Value | Σ (activity planned cost × actual % complete) |
| **AC** Actual Cost | Σ actual cost |
| **CPI** | EV / AC (shown as "-" when AC is 0) |
| **SPI** | EV / PV (shown as "-" when PV is 0) |
| CV, SV | EV − AC and EV − PV |
| EAC (forecast) | BAC / CPI |
| ETC, VAC | EAC − AC and BAC − EAC |

The **status date** can be changed on the page to see EVM at any date. Values are shown at project level and per activity.

**Automatic warnings**
- `CPI < threshold` (default 0.90): **Cost overrun** (red). CPI below 1: cost caution (amber).
- `SPI < threshold` (default 0.90): **Schedule delay** (red). SPI below 1: schedule caution (amber).
- BAC above the approved budget, actual cost above the approved budget, or forecast (EAC) above the approved budget.
- Overall health: **Critical** (any red warning), **At Risk** (only cautions) or **On Track**.

Thresholds are editable in the project charter.

---

### Module 5: Quality Management and Risk Control
**GUI:** *Quality & Risk* tab (`Quality.jsx`) and *Risk Matrix & PDPC* tab (`Risks.jsx`). **Data:** `defects`, `qualitychecks`, `risks`. **Logic:** `utils/risk.js`.

**Defect tracking** (`defects`): title, description, severity (Critical/Major/Minor), assigned person, related activity, status (Open/In Progress/Resolved/Closed). The resolved date is set automatically when a defect becomes Resolved/Closed and cleared if it is reopened. A banner shows the number of unresolved critical defects.

**Quality checklists and inspection** (`qualitychecks`): a checklist per deliverable with an inspector and testing notes. Each item's result is set to Pending/Pass/Fail from a dropdown. The overall result is recalculated on every save: **Failed** if any item fails, **Passed** if all pass, otherwise In Progress.

**Prioritization Matrix** (`GET /api/risks/matrix`)
- `score = likelihood × impact` (each 1-5).
- Bands: **15 or more Critical, 9-14 High, 4-8 Medium, below 4 Low**.
- Risks are ranked by score. A 5×5 colour-coded grid places each risk (R1, R2, ...) in its likelihood/impact cell.

**Process Decision Program Chart (PDPC)** (`GET /api/risks/pdpc`)
Each risk is shown as a flow: **Potential problem → Preventive action → Trigger (if it still happens) → Corrective action**, grouped by category under the project objective.

---

### Module 6: System Integration, Validation and Reporting
**GUI:** *Dashboard* (`Dashboard.jsx`). **API:** `GET /api/dashboard`, `GET /api/consistency`.

**Integration:** all modules use one Express server, one MongoDB database and one GUI. They are linked by references: requirement → activity → WBS → defect → cost.

**Dashboard shows**
- Project status, health, earned vs planned progress, deadline, projected finish
- Warnings (CPI, SPI, forecast overrun, deadline at risk, critical defects, pending change requests)
- Budget status: approved, planned, actual, remaining, forecast, plus CPI, SPI, PV, EV, AC
- Delayed activities with the activities they impact
- Pending change requests (cost and days)
- Unresolved critical defects and defect counts by severity
- Top 3 risks and requirement counts
- Approved change log

**Consistency check** (`GET /api/consistency`) verifies:
- Every activity is linked to an Approved requirement (error)
- Planned cost does not exceed the approved budget (error)
- Approved change requests have approved requirements (error)
- A closed project has no unresolved critical defects (error)
- Approved requirements without activities (warning) and activities without a WBS link (info)

**Input validation (two layers)**
1. GUI: required fields, number limits (`min`, `max`), date inputs, dropdowns.
2. Server: business rules in `routes.js` and schema rules in `models.js`.

**Exception handling:** a central Express error handler converts validation errors, invalid ids and duplicate keys into clear JSON messages (HTTP 400, 404, 409), and the GUI shows them in red alert boxes. Invalid routes return 404.

---

## 8. REST API Reference

| Method | Endpoint | Purpose |
|---|---|---|
| GET/POST/PUT | `/api/project` | Read, create, update charter and plan |
| POST | `/api/project/close`, `/api/project/reopen` | Close or reopen the project |
| CRUD | `/api/members` | Team members |
| CRUD | `/api/requirements` | Requirements |
| GET | `/api/wbs/tree` | Hierarchical WBS with cost roll-up |
| CRUD | `/api/wbs` | WBS nodes |
| GET/POST/PUT/DELETE | `/api/changes` | Change requests |
| PUT | `/api/changes/:id/decision` | Approve or reject (applies scope/schedule/budget impact) |
| CRUD | `/api/activities` | Activities |
| GET | `/api/schedule?statusDate=` | Calculated schedule, critical path, delay impact |
| GET | `/api/evm?statusDate=` | Earned value indicators and warnings |
| CRUD | `/api/defects` | Defects |
| CRUD | `/api/quality` | Quality checklists |
| CRUD | `/api/risks` | Risks |
| GET | `/api/risks/matrix` | Ranked risks and 5×5 matrix |
| GET | `/api/risks/pdpc` | PDPC structure |
| GET | `/api/consistency` | Cross-module consistency check |
| GET | `/api/dashboard` | Dashboard data |

---

## 9. Sample Data (Case Study)

**Original plan:** 10 activities, total PKR 5,000,000, 112 days (critical path: Requirements → Design → Appointments Backend → Online Consultation → Integration → Testing → Deployment).

| Area | Sample data |
|---|---|
| Requirements | R-001 to R-008 Approved. **R-009 AI diagnosis** and **R-010 mobile app** are Proposed |
| Delays | Appointments backend +10 days (critical path, pushes the finish beyond the deadline) and Lab/Billing backend +7 days (non-critical, absorbed by float) |
| EVM | CPI and SPI below 0.90, so cost overrun and schedule delay warnings appear |
| Change requests | CR-1 AI module (PKR 450,000, +10 days) and CR-2 mobile app (PKR 350,000, +11 days), both Pending |
| Defects | 2 Critical (double-booking, patient record overwrite), 1 Major, 1 Minor (resolved) |
| Quality checklists | Appointment Scheduling (Failed), Patient Records (Failed), Billing (Passed) |
| Risks | 7 risks with preventive/corrective actions (e.g. duplicate bookings 4×5=20 Critical, scope creep 4×4=16 Critical) |

---

## 10. Testing

### 10.1 Automated test cases (`npm test`)
These test the calculation logic without needing a database. The table printed in the terminal shows expected and actual results.

| ID | Description | Expected |
|---|---|---|
| TC-01 | Sequential A(5d) → B(3d) project length | 8 days |
| TC-02 | Activity waits for the longest predecessor | starts day 8 |
| TC-03 | 4-day delay on A shifts successor B | B starts day 9 |
| TC-04 | Delay on A reported as cause of slip on B | ["A"] |
| TC-05 | 1-day delay on a non-critical branch | final date unchanged (7) |
| TC-06 | Circular dependency | rejected with error |
| TC-07 | Delay pushes finish past a 15-day deadline | 3 days beyond |
| TC-08 | EVM at 50% planned, 40% done, AC 600 | PV 500, EV 400, AC 600, CPI 0.67, SPI 0.80 |
| TC-09 | Cost and schedule warnings raised | COST_OVERRUN, SCHEDULE_DELAY |
| TC-10 | On-track project | CPI 1, SPI 1, On Track |
| TC-11 | No actual cost yet | CPI = null |
| TC-12 | Approved change request impact | budget 5,800,000, deadline +21 days |
| TC-13 | Risk 4×5 | score 20, Critical |
| TC-14 | Risk 2×2 | score 4, Medium |

### 10.2 Manual system test cases (through the GUI)

| ID | Test | Expected result |
|---|---|---|
| TC-15 | Add a defect, restart the server, reload the page | Defect still present (persistence) |
| TC-16 | Add an activity linked to unapproved requirement R-009 | Rejected with a scope error |
| TC-17 | Enter a negative planned cost | Validation error |
| TC-18 | Make activity A depend on B and B depend on A | Circular dependency error |
| TC-19 | Approve CR-1 then CR-2 | Budget 5,800,000, deadline +21 days, 2 new activities, requirements Approved |
| TC-20 | Try to close the project with open critical defects | Closure blocked with reasons |
| TC-21 | Reject a change request | Budget, deadline and scope unchanged |
| TC-22 | Set deadline before start date in the charter | Validation error |

Record the actual results in the test report after running each case.

---

## 11. Demo Flow

1. **Dashboard:** show warnings, budget, delayed activities, critical defects.
2. **Scope & WBS → Requirements:** R-009 and R-010 are Proposed.
3. **Schedule → Add activity** using R-009: the server rejects it (unapproved scope).
4. **Scope & WBS → Change Requests:** approve CR-1 (AI module), then CR-2 (mobile app). Show the impact panel.
5. **Dashboard:** budget is now PKR 5,800,000, change log has 2 entries.
6. **Schedule:** Gantt chart with new activities, critical path and delay impact.
7. **Cost & EVM:** PV, EV, AC, CPI, SPI and warnings.
8. **Quality & Risk:** defects and checklists.
9. **Risk Matrix & PDPC:** ranked matrix and PDPC chart.
10. **MongoDB Atlas:** show the collections and the updated `projects` document.

---

## 12. Assumptions and Limitations

- The system manages **one project** at a time (one charter).
- Task dependencies are **finish-to-start** only.
- Planned value uses **linear** progress between baseline start and end dates.
- Durations are calendar days (no working-day calendar or holidays).
- There is no user login. The application is used by the project manager.

---

## 13. Submission Checklist

- [x] Complete source code (`server/` and `client/`)
- [x] Database schema (`server/models.js`) and sample data (`server/seed.js`)
- [x] Screenshots of all modules and the MongoDB Atlas collections
- [x] Test cases with expected and actual results (`npm test` plus manual cases)
- [x] Short demo of the working application