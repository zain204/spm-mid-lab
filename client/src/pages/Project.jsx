import { useEffect, useState } from 'react';
import { api } from '../api';
import { useLoad, useAction, Card, Field, Msg, Badge, Table, money, dt, inputDate, lines } from '../ui';

const stakeText = (a = []) => a.map((s) => `${s.name} | ${s.role || ''} | ${s.interest || ''}`).join('\n');
const respText = (a = []) => a.map((s) => `${s.member} | ${s.role || ''} | ${s.responsibility || ''}`).join('\n');
const parse = (t, keys) =>
  lines(t).map((l) => {
    const p = l.split('|').map((x) => x.trim());
    return Object.fromEntries(keys.map((k, i) => [k, p[i] || '']));
  });

export default function Project() {
  const { data, error, reload } = useLoad('/project');
  const { msg, run } = useAction(reload);
  const [f, setF] = useState(null);
  const [cl, setCl] = useState({ lessonsLearned: '', finalNotes: '', deliverablesAccepted: true });
  const exists = !!data;

  useEffect(() => {
    const p = data || {};
    setF({
      name: p.name || '',
      objectives: (p.objectives || []).join('\n'),
      stakeholders: stakeText(p.stakeholders),
      scopeIn: (p.scopeIn || []).join('\n'),
      scopeOut: (p.scopeOut || []).join('\n'),
      approvedBudget: p.approvedBudget ?? '',
      startDate: inputDate(p.startDate),
      deadline: inputDate(p.deadline),
      status: p.status && p.status !== 'Closed' ? p.status : 'Planning',
      plan: { scope: '', schedule: '', cost: '', quality: '', ...(p.plan || {}) },
      milestones: (p.milestones || []).map((m) => ({ name: m.name, date: inputDate(m.date), status: m.status })),
      responsibilities: respText(p.responsibilities),
      cpi: p.thresholds?.cpi ?? 0.9,
      spi: p.thresholds?.spi ?? 0.9,
    });
  }, [data]);

  if (!f) return <p>Loading...</p>;
  const set = (k, v) => setF({ ...f, [k]: v });
  const setPlan = (k, v) => setF({ ...f, plan: { ...f.plan, [k]: v } });
  const setMs = (i, k, v) => setF({ ...f, milestones: f.milestones.map((m, j) => (j === i ? { ...m, [k]: v } : m)) });
  const closed = data?.status === 'Closed';

  const save = () => {
    const body = {
      name: f.name,
      objectives: lines(f.objectives),
      stakeholders: parse(f.stakeholders, ['name', 'role', 'interest']),
      scopeIn: lines(f.scopeIn),
      scopeOut: lines(f.scopeOut),
      approvedBudget: Number(f.approvedBudget),
      startDate: f.startDate,
      deadline: f.deadline,
      status: f.status,
      plan: f.plan,
      milestones: f.milestones.filter((m) => m.name && m.date),
      responsibilities: parse(f.responsibilities, ['member', 'role', 'responsibility']),
      thresholds: { cpi: Number(f.cpi), spi: Number(f.spi) },
    };
    return run(() => (exists ? api.put('/project', body) : api.post('/project', body)), 'Project charter saved');
  };

  return (
    <>
      <Msg msg={msg} />
      {!exists && error && <div className="alert caution">{error} Fill the form below to create the charter.</div>}

      <Card title="Project Charter">
        <div className="form">
          <Field label="Project name" wide><input value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Approved budget (PKR)"><input type="number" min="1" value={f.approvedBudget} onChange={(e) => set('approvedBudget', e.target.value)} /></Field>
          <Field label="Status">
            <select value={f.status} onChange={(e) => set('status', e.target.value)} disabled={closed}>
              {['Initiation', 'Planning', 'Executing', 'Monitoring'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Start date"><input type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>
          <Field label="Deadline"><input type="date" value={f.deadline} onChange={(e) => set('deadline', e.target.value)} /></Field>
          <Field label="CPI warning threshold"><input type="number" step="0.01" value={f.cpi} onChange={(e) => set('cpi', e.target.value)} /></Field>
          <Field label="SPI warning threshold"><input type="number" step="0.01" value={f.spi} onChange={(e) => set('spi', e.target.value)} /></Field>
          <Field label="Objectives (one per line)" wide><textarea value={f.objectives} onChange={(e) => set('objectives', e.target.value)} /></Field>
          <Field label="Stakeholders (name | role | interest)" wide><textarea value={f.stakeholders} onChange={(e) => set('stakeholders', e.target.value)} /></Field>
          <Field label="Scope - included (one per line)" wide><textarea value={f.scopeIn} onChange={(e) => set('scopeIn', e.target.value)} /></Field>
          <Field label="Scope - excluded (one per line)" wide><textarea value={f.scopeOut} onChange={(e) => set('scopeOut', e.target.value)} /></Field>
        </div>
        {data && (
          <p className="muted">
            Original budget: {money(data.originalBudget)} | Original deadline: {dt(data.originalDeadline)} (budget/deadline change automatically when a change request is approved)
          </p>
        )}
      </Card>

      <Card title="Project Management Plan">
        <div className="form">
          <Field label="Scope plan" wide><textarea value={f.plan.scope} onChange={(e) => setPlan('scope', e.target.value)} /></Field>
          <Field label="Schedule plan" wide><textarea value={f.plan.schedule} onChange={(e) => setPlan('schedule', e.target.value)} /></Field>
          <Field label="Cost plan" wide><textarea value={f.plan.cost} onChange={(e) => setPlan('cost', e.target.value)} /></Field>
          <Field label="Quality plan" wide><textarea value={f.plan.quality} onChange={(e) => setPlan('quality', e.target.value)} /></Field>
        </div>
      </Card>

      <Card
        title="Milestones"
        right={<button className="btn sec sm" onClick={() => set('milestones', [...f.milestones, { name: '', date: '', status: 'Pending' }])}>+ Add milestone</button>}
      >
        <Table head={['Milestone', 'Date', 'Status', '']}>
          {f.milestones.map((m, i) => (
            <tr key={i}>
              <td><input value={m.name} onChange={(e) => setMs(i, 'name', e.target.value)} /></td>
              <td><input type="date" value={m.date} onChange={(e) => setMs(i, 'date', e.target.value)} /></td>
              <td>
                <select value={m.status} onChange={(e) => setMs(i, 'status', e.target.value)}>
                  {['Pending', 'Achieved', 'Missed'].map((s) => <option key={s}>{s}</option>)}
                </select>
              </td>
              <td><button className="btn red sm" onClick={() => set('milestones', f.milestones.filter((_, j) => j !== i))}>Remove</button></td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Responsibilities">
        <Field label="member | role | responsibility (one per line)">
          <textarea style={{ minHeight: 130 }} value={f.responsibilities} onChange={(e) => set('responsibilities', e.target.value)} />
        </Field>
        <div className="actions"><button className="btn" onClick={save}>{exists ? 'Save charter, plan and milestones' : 'Create project charter'}</button></div>
      </Card>

      {exists && (
        <Card title="Project Closure" right={<Badge text={data.status} />}>
          {closed ? (
            <>
              <p>Closed on <b>{dt(data.closure?.closedAt)}</b> | Deliverables accepted: <b>{data.closure?.deliverablesAccepted ? 'Yes' : 'No'}</b></p>
              <p><b>Lessons learned:</b> {data.closure?.lessonsLearned || '-'}</p>
              <p><b>Final notes:</b> {data.closure?.finalNotes || '-'}</p>
              <button className="btn sec" onClick={() => run(() => api.post('/project/reopen'), 'Project reopened')}>Reopen project</button>
            </>
          ) : (
            <>
              <p className="muted">Closure is blocked while activities are incomplete, critical defects are open or change requests are pending.</p>
              <div className="form">
                <Field label="Lessons learned" wide><textarea value={cl.lessonsLearned} onChange={(e) => setCl({ ...cl, lessonsLearned: e.target.value })} /></Field>
                <Field label="Final notes" wide><textarea value={cl.finalNotes} onChange={(e) => setCl({ ...cl, finalNotes: e.target.value })} /></Field>
                <Field label="Deliverables accepted by sponsor?">
                  <select value={cl.deliverablesAccepted ? 'y' : 'n'} onChange={(e) => setCl({ ...cl, deliverablesAccepted: e.target.value === 'y' })}>
                    <option value="y">Yes</option><option value="n">No</option>
                  </select>
                </Field>
              </div>
              <div className="actions"><button className="btn red" onClick={() => run(() => api.post('/project/close', cl), 'Project closed')}>Close project</button></div>
            </>
          )}
        </Card>
      )}

      {data?.changeLog?.length > 0 && (
        <Card title="Approved Change Log">
          <Table head={['Date', 'Change request', 'Cost impact', 'Schedule impact']}>
            {data.changeLog.map((l, i) => (
              <tr key={i}><td>{dt(l.date)}</td><td>{l.crTitle}</td><td>{money(l.costImpact)}</td><td>+{l.scheduleImpactDays} days</td></tr>
            ))}
          </Table>
        </Card>
      )}
    </>
  );
}