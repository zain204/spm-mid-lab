import { useState } from 'react';
import { api } from '../api';
import { useLoad, useAction, Card, Field, Msg, Badge, Table, Kpi, money, dt, num } from '../ui';

const DAY = 86400000;

function Gantt({ s }) {
  if (!s.activities.length) return <p className="muted">No activities yet.</p>;
  const min = new Date(s.startDate).getTime();
  const ends = [s.projectEnd, s.deadline, s.baselineEnd].filter(Boolean).map((d) => new Date(d).getTime());
  const max = Math.max(...ends) + 3 * DAY;
  const total = max - min;
  const pct = (d) => Math.max(0, Math.min(100, ((new Date(d).getTime() - min) / total) * 100));
  const ticks = [];
  for (let t = min; t <= max; t += 14 * DAY) ticks.push(t);

  return (
    <div className="scroll">
      <div className="gantt">
        <div className="g-axis">
          {ticks.map((t) => <span key={t} style={{ left: pct(t) + '%' }}>{new Date(t).toISOString().slice(5, 10)}</span>)}
        </div>
        <div className="g-row">
          <div className="g-label"><b>Milestones</b></div>
          <div className="g-track">
            {s.milestones.map((m) => (
              <div key={m.name} className={`g-ms ${m.status}`} style={{ left: pct(m.date) + '%' }} title={`${m.name} - ${dt(m.date)} (${m.status})`} />
            ))}
          </div>
        </div>
        {s.activities.map((a) => {
          const late = a.delayed || a.overdue || a.slipDays > 0;
          return (
            <div className="g-row" key={a.id}>
              <div className="g-label" title={a.name}>{a.name}</div>
              <div className="g-track">
                <div className="g-base" style={{ left: pct(a.baselineStart) + '%', width: pct(a.baselineEnd) - pct(a.baselineStart) + '%' }} />
                <div
                  className={`g-bar ${late ? 'late' : ''} ${a.critical ? 'crit' : ''}`}
                  style={{ left: pct(a.start) + '%', width: pct(a.end) - pct(a.start) + '%' }}
                  title={`${a.name}: ${dt(a.start)} to ${dt(a.end)} | ${a.percentComplete}% | slip ${a.slipDays}d`}
                >
                  <div className="g-fill" style={{ width: a.percentComplete + '%' }} />
                </div>
              </div>
            </div>
          );
        })}
        <div className="g-overlay">
          {s.deadline && <div className="g-line deadline" style={{ left: pct(s.deadline) + '%' }}><span style={{ color: '#dc2626' }}>Deadline {dt(s.deadline)}</span></div>}
          <div className="g-line today" style={{ left: pct(s.statusDate) + '%' }}><span style={{ color: '#2563eb' }}>Today</span></div>
        </div>
      </div>
      <div className="legend">
        <span>Teal bar = current schedule</span><span>Red bar = delayed</span><span>Gray line = original baseline</span>
        <span>Orange outline = critical path</span><span>Dark fill = % complete</span><span>Diamond = milestone</span>
      </div>
    </div>
  );
}

export default function Schedule() {
  const { data: s, error, reload } = useLoad('/schedule');
  const { data: acts, reload: reloadActs } = useLoad('/activities');
  const { data: reqs } = useLoad('/requirements');
  const { data: members } = useLoad('/members');
  const { data: tree } = useLoad('/wbs/tree');
  const { msg, run } = useAction(async () => { await reload(); await reloadActs(); });

  const empty = { name: '', requirement: '', assignee: '', wbs: '', durationDays: '', predecessors: [], plannedCost: '', actualCost: 0, percentComplete: 0, delayDays: 0, delayReason: '' };
  const [f, setF] = useState(empty);
  const [editId, setEditId] = useState(null);
  const set = (k, v) => setF({ ...f, [k]: v });

  const save = async () => {
    const body = {
      name: f.name,
      requirement: f.requirement || undefined,
      assignee: f.assignee || undefined,
      wbs: f.wbs || undefined,
      durationDays: num(f.durationDays),
      predecessors: f.predecessors,
      plannedCost: num(f.plannedCost) ?? 0,
      actualCost: num(f.actualCost) ?? 0,
      percentComplete: num(f.percentComplete) ?? 0,
      delayDays: num(f.delayDays) ?? 0,
      delayReason: f.delayReason,
    };
    const r = await run(() => (editId ? api.put(`/activities/${editId}`, body) : api.post('/activities', body)), editId ? 'Activity updated' : 'Activity added');
    if (r) { setF(empty); setEditId(null); }
  };

  const edit = (a) => {
    setEditId(a._id);
    setF({
      name: a.name, requirement: a.requirement?._id || '', assignee: a.assignee?._id || '', wbs: a.wbs || '',
      durationDays: a.durationDays, predecessors: (a.predecessors || []).map(String), plannedCost: a.plannedCost,
      actualCost: a.actualCost, percentComplete: a.percentComplete, delayDays: a.delayDays, delayReason: a.delayReason || '',
    });
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  if (error) return <Msg msg={{ type: 'err', text: error }} />;
  if (!s || !acts) return <p>Loading...</p>;

  const workPackages = tree ? tree.children.flatMap((d) => d.children) : [];

  return (
    <>
      <Msg msg={msg} />
      <Card title="Schedule Summary" right={<button className="btn sec sm" onClick={reload}>Refresh</button>}>
        <div className="grid g4">
          <Kpi label="Baseline finish" value={dt(s.baselineEnd)} />
          <Kpi label="Projected finish" value={dt(s.projectEnd)} sub={`Slip: ${s.totalSlipDays} days`} tone={s.totalSlipDays > 0 ? 'amber' : 'green'} />
          <Kpi label="Deadline" value={dt(s.deadline)} />
          <Kpi label="Deadline status" value={s.deadlineMissed ? `${s.daysBeyondDeadline} days late` : 'On time'} sub={`${s.delayedCount} delayed activities`} tone={s.deadlineMissed ? 'red' : 'green'} />
        </div>
        {s.deadlineMissed && <div className="alert danger">The delays push the projected completion {s.daysBeyondDeadline} days beyond the deadline.</div>}
      </Card>

      <Card title="Gantt Chart / Timeline"><Gantt s={s} /></Card>

      <Card title="Activities, Dependencies and Delay Impact">
        <Table head={['Activity', 'Assignee', 'Dur', 'Depends on', 'Start', 'End', 'Slip', 'Float', 'Status', 'Delay cause / impact', 'Actions']}>
          {s.activities.map((a) => (
            <tr key={a.id} className={a.critical ? 'crit-row' : ''}>
              <td>{a.name} {a.critical && <Badge text="Critical" tone="orange" />}</td>
              <td>{a.assignee || '-'}</td>
              <td>{a.durationDays}{a.delayDays ? `+${a.delayDays}` : ''}d</td>
              <td>{a.predecessorNames.join(', ') || '-'}</td>
              <td>{dt(a.start)}</td>
              <td>{dt(a.end)}</td>
              <td>{a.slipDays > 0 ? `+${a.slipDays}d` : '0'}</td>
              <td>{a.floatDays}d</td>
              <td><Badge text={a.status} /></td>
              <td>
                {a.delayDays > 0 && <div>Delayed {a.delayDays}d{a.impactedActivities.length ? <> - pushes: <b>{a.impactedActivities.join(', ')}</b></> : ' (absorbed by float, final date unchanged)'}</div>}
                {a.causedBy.length > 0 && <div className="muted">Caused by: {a.causedBy.join(', ')}</div>}
              </td>
              <td>
                <button className="btn sec sm" onClick={() => edit(acts.find((x) => String(x._id) === a.id))}>Edit</button>
                <button className="btn red sm" onClick={() => run(() => api.del(`/activities/${a.id}`), 'Activity deleted')}>Delete</button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title={editId ? 'Edit activity' : 'Add activity'}>
        <div className="form">
          <Field label="Activity name" wide><input value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Linked requirement" wide>
            <select value={f.requirement} onChange={(e) => set('requirement', e.target.value)}>
              <option value="">Select...</option>
              {reqs?.map((r) => <option key={r._id} value={r._id}>{r.code} - {r.title} [{r.status}]</option>)}
            </select>
          </Field>
          <Field label="Assigned to">
            <select value={f.assignee} onChange={(e) => set('assignee', e.target.value)}>
              <option value="">Unassigned</option>
              {members?.map((m) => <option key={m._id} value={m._id}>{m.name} ({m.role})</option>)}
            </select>
          </Field>
          <Field label="WBS work package">
            <select value={f.wbs} onChange={(e) => set('wbs', e.target.value)}>
              <option value="">None</option>
              {workPackages.map((w) => <option key={w.id} value={w.id}>{w.code} {w.name}</option>)}
            </select>
          </Field>
          <Field label="Duration (days)"><input type="number" min="1" value={f.durationDays} onChange={(e) => set('durationDays', e.target.value)} /></Field>
          <Field label="Planned cost (PKR)"><input type="number" min="0" value={f.plannedCost} onChange={(e) => set('plannedCost', e.target.value)} /></Field>
          <Field label="Actual cost (PKR)"><input type="number" min="0" value={f.actualCost} onChange={(e) => set('actualCost', e.target.value)} /></Field>
          <Field label="% complete (0-100)"><input type="number" min="0" max="100" value={f.percentComplete} onChange={(e) => set('percentComplete', e.target.value)} /></Field>
          <Field label="Delay (days)"><input type="number" min="0" value={f.delayDays} onChange={(e) => set('delayDays', e.target.value)} /></Field>
          <Field label="Delay reason" wide><input value={f.delayReason} onChange={(e) => set('delayReason', e.target.value)} /></Field>
          <Field label="Predecessors (Ctrl+click for many)" wide>
            <select multiple value={f.predecessors} onChange={(e) => set('predecessors', Array.from(e.target.selectedOptions).map((o) => o.value))}>
              {acts.filter((a) => a._id !== editId).map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="actions">
          <button className="btn" onClick={save}>{editId ? 'Update activity' : 'Add activity'}</button>
          {editId && <button className="btn sec" onClick={() => { setEditId(null); setF(empty); }}>Cancel</button>}
        </div>
        <p className="muted">Validation: unapproved requirement, circular dependency, negative values, or total cost above approved budget are rejected by the server.</p>
      </Card>

      <Card title="Team Workload">
        <Table head={['Member', 'Role', 'Activities', 'Planned cost']}>
          {members?.map((m) => {
            const mine = acts.filter((a) => a.assignee?._id === m._id);
            return <tr key={m._id}><td>{m.name}</td><td>{m.role}</td><td>{mine.map((a) => a.name).join(', ') || '-'}</td><td>{money(mine.reduce((x, a) => x + a.plannedCost, 0))}</td></tr>;
          })}
        </Table>
      </Card>
    </>
  );
}