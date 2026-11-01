import { useState } from 'react';
import { useLoad, Card, Kpi, Table, Msg, Bar, money } from '../ui';

export default function Cost() {
  const [sd, setSd] = useState(new Date().toISOString().slice(0, 10));
  const { data: e, error, reload } = useLoad(`/evm?statusDate=${sd}`);
  if (error) return <Msg msg={{ type: 'err', text: error }} />;
  if (!e) return <p>Loading...</p>;

  const idx = (v) => (v === null ? '' : v < e.thresholds.cpi ? 'red' : v < 1 ? 'amber' : 'green');
  const max = Math.max(e.PV, e.EV, e.AC, e.BAC, 1);

  return (
    <>
      <Card
        title="Earned Value Management"
        right={
          <span>
            Status date: <input type="date" style={{ width: 160 }} value={sd} onChange={(ev) => setSd(ev.target.value)} />{' '}
            <button className="btn sec sm" onClick={reload}>Refresh</button>
          </span>
        }
      >
        {e.warnings.length === 0 ? <div className="alert ok">Project performance is within thresholds.</div> :
          e.warnings.map((w, i) => <div key={i} className={`alert ${w.level}`}>{w.message}</div>)}

        <div className="grid g5" style={{ marginTop: 10 }}>
          <Kpi label="Planned Value (PV)" value={money(e.PV)} />
          <Kpi label="Earned Value (EV)" value={money(e.EV)} />
          <Kpi label="Actual Cost (AC)" value={money(e.AC)} />
          <Kpi label="CPI = EV / AC" value={e.CPI ?? '-'} tone={idx(e.CPI)} sub={`Threshold ${e.thresholds.cpi}`} />
          <Kpi label="SPI = EV / PV" value={e.SPI ?? '-'} tone={idx(e.SPI)} sub={`Threshold ${e.thresholds.spi}`} />
        </div>
        <div className="grid g5" style={{ marginTop: 10 }}>
          <Kpi label="Budget at completion" value={money(e.BAC)} sub={`Approved: ${money(e.approvedBudget)}`} />
          <Kpi label="Cost variance (CV)" value={money(e.CV)} tone={e.CV < 0 ? 'red' : 'green'} />
          <Kpi label="Schedule variance (SV)" value={money(e.SV)} tone={e.SV < 0 ? 'red' : 'green'} />
          <Kpi label="Forecast (EAC)" value={money(e.EAC)} sub={`ETC: ${money(e.ETC)}`} tone={e.EAC > e.approvedBudget ? 'red' : 'green'} />
          <Kpi label="Variance at completion" value={money(e.VAC)} tone={e.VAC < 0 ? 'red' : 'green'} />
        </div>

        <h4>PV vs EV vs AC</h4>
        {[['PV', e.PV, ''], ['EV', e.EV, ''], ['AC', e.AC, e.AC > e.EV ? 'red' : '']].map(([l, v, t]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <b style={{ width: 30 }}>{l}</b>
            <div style={{ flex: 1 }}><Bar value={(v / max) * 100} tone={t} /></div>
            <span style={{ width: 130, textAlign: 'right' }}>{money(v)}</span>
          </div>
        ))}
        <p className="muted">PV = planned % complete (from baseline dates) x activity budget. EV = actual % complete x activity budget. All values are calculated by the server at the selected status date.</p>
      </Card>

      <Card title="Activity-level Cost and Earned Value">
        <Table head={['Activity', 'Budget', 'Planned %', 'Actual %', 'PV', 'EV', 'AC', 'CPI', 'SPI']}>
          {e.items.map((i) => (
            <tr key={i.id}>
              <td>{i.name}</td><td>{money(i.bac)}</td><td>{i.plannedPercent}%</td><td>{i.percentComplete}%</td>
              <td>{money(i.pv)}</td><td>{money(i.ev)}</td><td>{money(i.ac)}</td>
              <td style={{ color: i.cpi !== null && i.cpi < 1 ? '#dc2626' : '' }}>{i.cpi ?? '-'}</td>
              <td style={{ color: i.spi !== null && i.spi < 1 ? '#dc2626' : '' }}>{i.spi ?? '-'}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}