import { useState } from 'react';
import { api } from '../api';
import { useLoad, useAction, Card, Field, Msg, Badge, Table, lines, dt } from '../ui';

export default function Quality() {
  const [tab, setTab] = useState('def');
  return (
    <>
      <div className="subtabs">
        {[['def', 'Defect Tracking'], ['qc', 'Quality Checklists & Inspection']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'def' ? <Defects /> : <Checklists />}
    </>
  );
}

function Defects() {
  const { data, reload } = useLoad('/defects');
  const { data: members } = useLoad('/members');
  const { data: acts } = useLoad('/activities');
  const { msg, run } = useAction(reload);
  const empty = { title: '', description: '', severity: 'Major', status: 'Open', assignedTo: '', activity: '' };
  const [f, setF] = useState(empty);
  const set = (k, v) => setF({ ...f, [k]: v });

  const add = async () => {
    const body = { ...f };
    if (!body.assignedTo) delete body.assignedTo;
    if (!body.activity) delete body.activity;
    const r = await run(() => api.post('/defects', body), 'Defect recorded');
    if (r) setF(empty);
  };

  const unresolvedCritical = data ? data.filter((d) => d.severity === 'Critical' && ['Open', 'In Progress'].includes(d.status)).length : 0;

  return (
    <>
      <Msg msg={msg} />
      {unresolvedCritical > 0 && <div className="alert danger">{unresolvedCritical} critical defects are unresolved.</div>}
      <Card title="Defects">
        {!data ? <p>Loading...</p> : (
          <Table head={['Defect', 'Severity', 'Assigned to', 'Activity', 'Status', 'Resolved', '']}>
            {data.map((d) => (
              <tr key={d._id}>
                <td>{d.title}<div className="muted">{d.description}</div></td>
                <td><Badge text={d.severity} /></td>
                <td>{d.assignedTo?.name || '-'}</td>
                <td>{d.activity?.name || '-'}</td>
                <td>
                  <select value={d.status} onChange={(e) => run(() => api.put(`/defects/${d._id}`, { status: e.target.value }), 'Defect status updated')}>
                    {['Open', 'In Progress', 'Resolved', 'Closed'].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td>{dt(d.resolvedAt)}</td>
                <td><button className="btn red sm" onClick={() => run(() => api.del(`/defects/${d._id}`), 'Defect deleted')}>Delete</button></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Card title="Record a defect">
        <div className="form">
          <Field label="Title" wide><input value={f.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="Severity">
            <select value={f.severity} onChange={(e) => set('severity', e.target.value)}>{['Critical', 'Major', 'Minor'].map((s) => <option key={s}>{s}</option>)}</select>
          </Field>
          <Field label="Status">
            <select value={f.status} onChange={(e) => set('status', e.target.value)}>{['Open', 'In Progress', 'Resolved', 'Closed'].map((s) => <option key={s}>{s}</option>)}</select>
          </Field>
          <Field label="Assigned to">
            <select value={f.assignedTo} onChange={(e) => set('assignedTo', e.target.value)}>
              <option value="">Unassigned</option>
              {members?.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Related activity">
            <select value={f.activity} onChange={(e) => set('activity', e.target.value)}>
              <option value="">None</option>
              {acts?.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Description" wide><input value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
        </div>
        <div className="actions"><button className="btn" onClick={add}>Add defect</button></div>
      </Card>
    </>
  );
}

function Checklists() {
  const { data, reload } = useLoad('/quality');
  const { msg, run } = useAction(reload);
  const [f, setF] = useState({ deliverable: '', inspector: '', items: '', testingNotes: '' });
  const set = (k, v) => setF({ ...f, [k]: v });

  const add = async () => {
    const body = {
      deliverable: f.deliverable,
      inspector: f.inspector,
      testingNotes: f.testingNotes,
      items: lines(f.items).map((text) => ({ text, result: 'Pending' })),
    };
    const r = await run(() => api.post('/quality', body), 'Checklist created');
    if (r) setF({ deliverable: '', inspector: '', items: '', testingNotes: '' });
  };

  const setItem = (c, idx, patch) => {
    const items = c.items.map((it, i) => (i === idx ? { text: it.text, result: it.result, notes: it.notes, ...patch } : { text: it.text, result: it.result, notes: it.notes }));
    return run(() => api.put(`/quality/${c._id}`, { items }), 'Inspection result recorded');
  };

  return (
    <>
      <Msg msg={msg} />
      {!data ? <p>Loading...</p> : data.map((c) => (
        <Card key={c._id} title={c.deliverable} right={<span>Inspector: {c.inspector || '-'} <Badge text={c.overall} /></span>}>
          <Table head={['Checklist item', 'Result', 'Notes']}>
            {c.items.map((it, i) => (
              <tr key={i}>
                <td>{it.text}</td>
                <td>
                  <select value={it.result} onChange={(e) => setItem(c, i, { result: e.target.value })}>
                    {['Pending', 'Pass', 'Fail'].map((r) => <option key={r}>{r}</option>)}
                  </select>
                </td>
                <td>{it.notes || '-'}</td>
              </tr>
            ))}
          </Table>
          {c.testingNotes && <p className="muted">Testing notes: {c.testingNotes}</p>}
          <div className="actions"><button className="btn red sm" onClick={() => run(() => api.del(`/quality/${c._id}`), 'Checklist deleted')}>Delete checklist</button></div>
        </Card>
      ))}
      <Card title="New quality checklist">
        <div className="form">
          <Field label="Deliverable" wide><input value={f.deliverable} onChange={(e) => set('deliverable', e.target.value)} /></Field>
          <Field label="Inspector" wide><input value={f.inspector} onChange={(e) => set('inspector', e.target.value)} /></Field>
          <Field label="Checklist items (one per line)" wide><textarea value={f.items} onChange={(e) => set('items', e.target.value)} /></Field>
          <Field label="Testing notes" wide><textarea value={f.testingNotes} onChange={(e) => set('testingNotes', e.target.value)} /></Field>
        </div>
        <div className="actions"><button className="btn" onClick={add}>Create checklist</button></div>
      </Card>
    </>
  );
}