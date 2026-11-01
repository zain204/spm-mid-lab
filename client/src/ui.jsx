import { useEffect, useState, useCallback } from 'react';
import { api } from './api';

export const money = (n) => (n === null || n === undefined ? '-' : 'PKR ' + Math.round(n).toLocaleString('en-US'));
export const dt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '-');
export const inputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
export const num = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v));
export const lines = (t) => String(t || '').split('\n').map((x) => x.trim()).filter(Boolean);

const GREEN = ['Approved', 'Passed', 'Pass', 'Resolved', 'Closed', 'Completed', 'Achieved', 'On Track', 'Low', 'Within budget', 'Executing'];
const RED = ['Critical', 'Failed', 'Fail', 'Open', 'Rejected', 'Delayed', 'Missed', 'Exceeded', 'Forecast overrun', 'danger', 'Occurred'];
const ORANGE = ['High', 'Major'];
const AMBER = ['Pending', 'In Progress', 'Mitigating', 'Proposed', 'caution', 'At Risk', 'Medium', 'Not Started'];
const toneOf = (t) => (GREEN.includes(t) ? 'green' : RED.includes(t) ? 'red' : ORANGE.includes(t) ? 'orange' : AMBER.includes(t) ? 'amber' : 'gray');

export const Badge = ({ text, tone }) => <span className={`badge ${tone || toneOf(text)}`}>{text}</span>;

export const Card = ({ title, right, children }) => (
  <section className="card">
    {(title || right) && (
      <div className="card-head">
        <h3>{title}</h3>
        <div>{right}</div>
      </div>
    )}
    {children}
  </section>
);

export const Field = ({ label, children, wide }) => (
  <label className={`f ${wide ? 'wide' : ''}`}>
    <span>{label}</span>
    {children}
  </label>
);

export const Msg = ({ msg }) => (msg ? <div className={`alert ${msg.type === 'ok' ? 'ok' : 'danger'}`}>{msg.text}</div> : null);

export const Bar = ({ value, tone }) => (
  <div className="bar">
    <div className={tone || ''} style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }} />
  </div>
);

export const Kpi = ({ label, value, sub, tone }) => (
  <div className={`kpi ${tone || ''}`}>
    <div className="kpi-label">{label}</div>
    <div className="kpi-value">{value}</div>
    {sub && <div className="kpi-sub">{sub}</div>}
  </div>
);

export const Table = ({ head, children }) => (
  <div className="scroll">
    <table>
      <thead>
        <tr>{head.map((h) => <th key={h}>{h}</th>)}</tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);

export function useLoad(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    try {
      setData(await api.get(path));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [path]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, reload };
}

// run(fn, okText): calls fn, shows success/error message, then refreshes data
export function useAction(after) {
  const [msg, setMsg] = useState(null);
  const run = async (fn, ok) => {
    try {
      const r = await fn();
      setMsg({ type: 'ok', text: ok || 'Saved' });
      if (after) await after();
      return r === undefined ? true : r;
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
      return null;
    }
  };
  return { msg, run, setMsg };
}