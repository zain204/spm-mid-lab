import { useState } from 'react';
import { api } from '../api';
import { useLoad, useAction, Card, Field, Msg, Badge, Table, money, dt, num } from '../ui';

export default function Scope() {
  const [tab, setTab] = useState('req');
  return (
    <>
      <div className="subtabs">
        {[['req', 'Requirements'], ['wbs', 'Work Breakdown Structure'], ['cr', 'Change Requests']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'req' && <Requirements />}
      {tab === 'wbs' && <Wbs />}
      {tab === 'cr' && <ChangeRequests />}
    </>
  );
}

function Requirements() {
  const { data, reload } = useLoad('/requirements');
  const { msg, run } = useAction(reload);
  const empty = { code: '', title: '', description: '', priority: 'Medium', status: 'Proposed' };
  const [f, setF] = useState(empty);
  const [editId, setEditId] = useState(null);
  const set = (k, v) => setF({ ...f, [k]: v });

  const save = async () => {
    const r = await run(() => (editId ? api.put(`/requirements/${editId}`, f) : api.post('/requirements', f)), editId ? 'Requirement updated' : 'Requirement added');
    if (r) { setF(empty); setEditId(null); }
  };
  const setStatus = (r, status) => run(() => api.put(`/requirements/${r._id}`, { status }), `${r.code} marked ${status}`);

  return (
    <>
      <Msg msg={msg} />
      <Card title="Requirements">
        {!data ? <p>Loading...</p> : (
          <Table head={['Code', 'Title', 'Priority', 'Status', 'Actions']}>
            {data.map((r) => (
              <tr key={r._id}>
                <td>{r.code}</td>
                <td>{r.title}<div className="muted">{r.description}</div></td>
                <td><Badge text={r.priority} /></td>
                <td><Badge text={r.status} /></td>
                <td>
                  {r.status !== 'Approved' && <button className="btn green sm" onClick={() => setStatus(r, 'Approved')}>Approve</button>}
                  {r.status !== 'Rejected' && <button className="btn sec sm" onClick={() => setStatus(r, 'Rejected')}>Reject</button>}
                  <button className="btn sec sm" onClick={() => { setEditId(r._id); setF({ code: r.code, title: r.title, description: r.description || '', priority: r.priority, status: r.status }); }}>Edit</button>
                  <button className="btn red sm" onClick={() => run(() => api.del(`/requirements/${r._id}`), 'Requirement deleted')}>Delete</button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Card title={editId ? 'Edit requirement' : 'Add requirement'}>
        <div className="form">
          <Field label="Code (e.g. R-011)"><input value={f.code} onChange={(e) => set('code', e.target.value)} /></Field>
          <Field label="Title" wide><input value={f.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="Priority">
            <select value={f.priority} onChange={(e) => set('priority', e.target.value)}>{['High', 'Medium', 'Low'].map((p) => <option key={p}>{p}</option>)}</select>
          </Field>
          <Field label="Description" wide><input value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
          <Field label="Status">
            <select value={f.status} onChange={(e) => set('status', e.target.value)}>{['Proposed', 'Approved', 'Rejected'].map((p) => <option key={p}>{p}</option>)}</select>
          </Field>
        </div>
        <div className="actions">
          <button className="btn" onClick={save}>{editId ? 'Update' : 'Add requirement'}</button>
          {editId && <button className="btn sec" onClick={() => { setEditId(null); setF(empty); }}>Cancel</button>}
        </div>
        <p className="muted">Rule: only APPROVED requirements can be linked to activities (approved scope). A requirement that belongs to a change request can only be approved through that change request.</p>
      </Card>
    </>
  );
}

function Wbs() {
  const { data: tree, reload } = useLoad('/wbs/tree');
  const { msg, run } = useAction(reload);
  const empty = { code: '', name: '', type: 'WorkPackage', parent: '' };
  const [f, setF] = useState(empty);
  const set = (k, v) => setF({ ...f, [k]: v });
  const add = async () => {
    const body = { code: f.code, name: f.name, type: f.type };
    if (f.type === 'WorkPackage') body.parent = f.parent || undefined;
    const r = await run(() => api.post('/wbs', body), 'WBS node added');
    if (r) setF(empty);
  };
  const del = (id) => run(() => api.del(`/wbs/${id}`), 'WBS node deleted');

  return (
    <>
      <Msg msg={msg} />
      <Card title="Work Breakdown Structure (hierarchical)">
        {!tree ? <p>Loading...</p> : (
          <div className="tree">
            <ul>
              <li>
                <span className="node project"><b>0</b> {tree.name} <span>{money(tree.cost)}</span></span>
                <ul>
                  {tree.children.map((d) => (
                    <li key={d.id}>
                      <span className="node deliverable">
                        <b>{d.code}</b> {d.name} <span className="muted">{money(d.cost)}</span>
                        {d.children.length === 0 && <button className="btn red sm" onClick={() => del(d.id)}>x</button>}
                      </span>
                      <ul>
                        {d.children.map((w) => (
                          <li key={w.id}>
                            <span className="node">
                              <b>{w.code}</b> {w.name} <span className="muted">{money(w.cost)}</span>
                              {w.activities.length === 0 && <button className="btn red sm" onClick={() => del(w.id)}>x</button>}
                            </span>
                            {w.activities.length > 0 && <div className="muted" style={{ marginLeft: 14 }}>Activities: {w.activities.join(', ')}</div>}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </li>
            </ul>
          </div>
        )}
      </Card>
      <Card title="Add WBS element">
        <div className="form">
          <Field label="Code (e.g. 2.6)"><input value={f.code} onChange={(e) => set('code', e.target.value)} /></Field>
          <Field label="Name" wide><input value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Type">
            <select value={f.type} onChange={(e) => set('type', e.target.value)}>
              <option value="Deliverable">Deliverable</option><option value="WorkPackage">Work package</option>
            </select>
          </Field>
          {f.type === 'WorkPackage' && (
            <Field label="Parent deliverable">
              <select value={f.parent} onChange={(e) => set('parent', e.target.value)}>
                <option value="">Select...</option>
                {tree?.children.map((d) => <option key={d.id} value={d.id}>{d.code} {d.name}</option>)}
              </select>
            </Field>
          )}
        </div>
        <div className="actions"><button className="btn" onClick={add}>Add</button></div>
      </Card>
    </>
  );
}

function ChangeRequests() {
  const { data: crs, reload } = useLoad('/changes');
  const { data: reqs, reload: reloadReqs } = useLoad('/requirements');
  const { data: members } = useLoad('/members');
  const { msg, run } = useAction(async () => { await reload(); await reloadReqs(); });
  const [impact, setImpact] = useState(null);
  const empty = { title: '', justification: '', description: '', requirement: '', costImpact: '', scheduleImpactDays: '', requestedBy: '', paName: '', paAssignee: '', paDuration: '', paCost: '', paPreds: '' };
  const [f, setF] = useState(empty);
  const set = (k, v) => setF({ ...f, [k]: v });

  const create = async () => {
    const body = {
      title: f.title,
      justification: f.justification,
      description: f.description,
      requestedBy: f.requestedBy,
      costImpact: num(f.costImpact) ?? 0,
      scheduleImpactDays: num(f.scheduleImpactDays) ?? 0,
    };
    if (f.requirement) body.requirement = f.requirement;
    if (f.paName) {
      body.proposedActivities = [{
        name: f.paName,
        assignee: f.paAssignee || undefined,
        durationDays: num(f.paDuration),
        plannedCost: num(f.paCost) ?? 0,
        predecessorNames: f.paPreds.split(',').map((x) => x.trim()).filter(Boolean),
      }];
    }
    const r = await run(() => api.post('/changes', body), 'Change request recorded (Pending)');
    if (r) setF(empty);
  };

  const decide = async (cr, status) => {
    const r = await run(() => api.put(`/changes/${cr._id}/decision`, { status }), `Change request ${status}`);
    if (r && r.impact) setImpact({ title: cr.title, ...r.impact });
  };

  return (
    <>
      <Msg msg={msg} />
      {impact && (
        <Card title={`Impact of decision: ${impact.title} (${impact.decision})`} right={<button className="btn sec sm" onClick={() => setImpact(null)}>Close</button>}>
          {impact.decision === 'Rejected' ? <p>Rejected - scope, schedule and budget are unchanged.</p> : (
            <Table head={['Area', 'Before', 'After', 'Change']}>
              <tr><td><b>Budget</b></td><td>{money(impact.budget.before)}</td><td>{money(impact.budget.after)}</td><td>+{money(impact.budget.delta)}</td></tr>
              <tr><td><b>Deadline</b></td><td>{dt(impact.deadline.before)}</td><td>{dt(impact.deadline.after)}</td><td>+{impact.deadline.deltaDays} days</td></tr>
              <tr><td><b>Projected finish</b></td><td>{dt(impact.projectedEnd.before)}</td><td>{dt(impact.projectedEnd.after)}</td><td>schedule recalculated</td></tr>
              <tr><td><b>Scope</b></td><td colSpan={3}>Requirement approved: {impact.scope.requirementApproved || '-'} | Activities added: {impact.scope.activitiesAdded.join(', ') || '-'}</td></tr>
            </Table>
          )}
        </Card>
      )}

      <Card title="Change Requests">
        {!crs ? <p>Loading...</p> : (
          <Table head={['Title', 'Requirement', 'Justification', 'Cost impact', 'Schedule impact', 'Status', 'Actions']}>
            {crs.map((c) => (
              <tr key={c._id}>
                <td>{c.title}<div className="muted">By: {c.requestedBy || '-'}</div></td>
                <td>{c.requirement ? `${c.requirement.code}` : '-'}</td>
                <td>{c.justification}</td>
                <td>{money(c.costImpact)}</td>
                <td>+{c.scheduleImpactDays} days</td>
                <td><Badge text={c.status} /></td>
                <td>
                  {c.status === 'Pending' ? (
                    <>
                      <button className="btn green sm" onClick={() => decide(c, 'Approved')}>Approve</button>
                      <button className="btn sec sm" onClick={() => decide(c, 'Rejected')}>Reject</button>
                      <button className="btn red sm" onClick={() => run(() => api.del(`/changes/${c._id}`), 'Change request deleted')}>Delete</button>
                    </>
                  ) : <span className="muted">{dt(c.decidedAt)}</span>}
                </td>
              </tr>
            ))}
          </Table>
        )}
        <p className="muted">Demo order: approve the AI module first, then the mobile app. Budget becomes PKR 5,800,000 and the deadline moves by 21 days (3 weeks).</p>
      </Card>

      <Card title="Raise a new change request">
        <div className="form">
          <Field label="Title" wide><input value={f.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="Linked requirement" wide>
            <select value={f.requirement} onChange={(e) => set('requirement', e.target.value)}>
              <option value="">None</option>
              {reqs?.filter((r) => r.status !== 'Approved').map((r) => <option key={r._id} value={r._id}>{r.code} - {r.title} ({r.status})</option>)}
            </select>
          </Field>
          <Field label="Justification" wide><input value={f.justification} onChange={(e) => set('justification', e.target.value)} /></Field>
          <Field label="Description" wide><input value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
          <Field label="Cost impact (PKR)"><input type="number" min="0" value={f.costImpact} onChange={(e) => set('costImpact', e.target.value)} /></Field>
          <Field label="Schedule impact (days)"><input type="number" min="0" value={f.scheduleImpactDays} onChange={(e) => set('scheduleImpactDays', e.target.value)} /></Field>
          <Field label="Requested by" wide><input value={f.requestedBy} onChange={(e) => set('requestedBy', e.target.value)} /></Field>
        </div>
        <h4 style={{ margin: '14px 0 6px' }}>Proposed activity (added to schedule on approval, optional)</h4>
        <div className="form">
          <Field label="Activity name"><input value={f.paName} onChange={(e) => set('paName', e.target.value)} /></Field>
          <Field label="Assignee">
            <select value={f.paAssignee} onChange={(e) => set('paAssignee', e.target.value)}>
              <option value="">Unassigned</option>
              {members?.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Duration (days)"><input type="number" min="1" value={f.paDuration} onChange={(e) => set('paDuration', e.target.value)} /></Field>
          <Field label="Cost (PKR)"><input type="number" min="0" value={f.paCost} onChange={(e) => set('paCost', e.target.value)} /></Field>
          <Field label="Predecessor activity names (comma separated)" wide><input value={f.paPreds} onChange={(e) => set('paPreds', e.target.value)} /></Field>
        </div>
        <div className="actions"><button className="btn" onClick={create}>Submit change request</button></div>
      </Card>
    </>
  );
}