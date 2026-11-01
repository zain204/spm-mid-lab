import { useState } from 'react';
import { api } from '../api';
import { useLoad, useAction, Card, Field, Msg, Badge, Table, num } from '../ui';

export default function Risks() {
  const { data: m, reload: r1 } = useLoad('/risks/matrix');
  const { data: p, reload: r2 } = useLoad('/risks/pdpc');
  const { data: members } = useLoad('/members');
  const { msg, run } = useAction(async () => { await r1(); await r2(); });
  const empty = { title: '', category: 'Technical', likelihood: 3, impact: 3, owner: '', status: 'Open', preventiveAction: '', trigger: '', correctiveAction: '' };
  const [f, setF] = useState(empty);
  const set = (k, v) => setF({ ...f, [k]: v });

  const add = async () => {
    const body = { ...f, likelihood: num(f.likelihood), impact: num(f.impact) };
    if (!body.owner) delete body.owner;
    const r = await run(() => api.post('/risks', body), 'Risk added');
    if (r) setF(empty);
  };

  if (!m || !p) return <p>Loading...</p>;
  const rankOf = Object.fromEntries(m.ranked.map((r) => [r.id, r.rank]));

  return (
    <>
      <Msg msg={msg} />
      <Card title="Prioritization Matrix (Likelihood x Impact)">
        <div className="grid g2">
          <div>
            <div className="matrix">
              {[5, 4, 3, 2, 1].map((l) => (
                <div key={l} style={{ display: 'contents' }}>
                  <div className="axis">{l}</div>
                  {m.grid.filter((c) => c.likelihood === l).map((c) => (
                    <div key={`${l}-${c.impact}`} className={`cell ${c.band}`} title={`Score ${c.score} - ${c.band}`}>
                      {c.risks.map((r) => <b key={r.id} title={r.title}>R{rankOf[r.id]}</b>)}
                    </div>
                  ))}
                </div>
              ))}
              <div />
              {[1, 2, 3, 4, 5].map((i) => <div key={i} className="axis">{i}</div>)}
            </div>
            <p className="muted">Rows = Likelihood (5 high), columns = Impact (5 high). Score = Likelihood x Impact. 15+ Critical, 9-14 High, 4-8 Medium, below 4 Low.</p>
          </div>
          <Table head={['Rank', 'Risk', 'L', 'I', 'Score', 'Band', 'Status', '']}>
            {m.ranked.map((r) => (
              <tr key={r.id}>
                <td>R{r.rank}</td><td>{r.title}</td><td>{r.likelihood}</td><td>{r.impact}</td><td><b>{r.score}</b></td>
                <td><Badge text={r.band} /></td><td><Badge text={r.status} /></td>
                <td><button className="btn red sm" onClick={() => run(() => api.del(`/risks/${r.id}`), 'Risk deleted')}>x</button></td>
              </tr>
            ))}
          </Table>
        </div>
      </Card>

      <Card title="Process Decision Program Chart (PDPC)">
        <div className="pdpc-obj">Objective: {p.objective}</div>
        {p.categories.map((c) => (
          <div key={c.category}>
            <div className="pdpc-cat">{c.category} risks</div>
            {c.problems.map((x) => (
              <div className="pdpc-chain" key={x.id}>
                <div className="pdpc-box pb-problem"><small>Potential problem ({x.band}, score {x.score})</small>{x.problem}</div>
                <div className="pdpc-arrow">&rarr;</div>
                <div className="pdpc-box pb-prev"><small>Preventive action</small>{x.preventiveAction || '-'}</div>
                <div className="pdpc-arrow">&rarr;</div>
                <div className="pdpc-box pb-trigger"><small>If it still happens (trigger)</small>{x.trigger || '-'}</div>
                <div className="pdpc-arrow">&rarr;</div>
                <div className="pdpc-box pb-corr"><small>Corrective action</small>{x.correctiveAction || '-'}</div>
              </div>
            ))}
          </div>
        ))}
      </Card>

      <Card title="Add risk">
        <div className="form">
          <Field label="Risk / problem" wide><input value={f.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="Category">
            <select value={f.category} onChange={(e) => set('category', e.target.value)}>
              {['Technical', 'Scope', 'Schedule', 'Cost', 'Resource', 'Security', 'Quality', 'General'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Owner">
            <select value={f.owner} onChange={(e) => set('owner', e.target.value)}>
              <option value="">None</option>
              {members?.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
            </select>
          </Field>
          <Field label="Likelihood (1-5)"><input type="number" min="1" max="5" value={f.likelihood} onChange={(e) => set('likelihood', e.target.value)} /></Field>
          <Field label="Impact (1-5)"><input type="number" min="1" max="5" value={f.impact} onChange={(e) => set('impact', e.target.value)} /></Field>
          <Field label="Status">
            <select value={f.status} onChange={(e) => set('status', e.target.value)}>{['Open', 'Mitigating', 'Occurred', 'Closed'].map((s) => <option key={s}>{s}</option>)}</select>
          </Field>
          <Field label="Preventive action" wide><input value={f.preventiveAction} onChange={(e) => set('preventiveAction', e.target.value)} /></Field>
          <Field label="Trigger" wide><input value={f.trigger} onChange={(e) => set('trigger', e.target.value)} /></Field>
          <Field label="Corrective action" wide><input value={f.correctiveAction} onChange={(e) => set('correctiveAction', e.target.value)} /></Field>
        </div>
        <div className="actions"><button className="btn" onClick={add}>Add risk</button></div>
      </Card>
    </>
  );
}