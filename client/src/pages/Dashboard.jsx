import { useLoad, Card, Badge, Kpi, Bar, Table, Msg, money, dt } from '../ui';

export default function Dashboard() {
  const { data: d, error, reload } = useLoad('/dashboard');
  const { data: c } = useLoad('/consistency');
  if (error) return <Msg msg={{ type: 'err', text: error }} />;
  if (!d) return <p>Loading...</p>;

  const evm = d.evm;
  const tone = (v) => (v === null ? '' : v < d.evm.thresholds.cpi ? 'red' : v < 1 ? 'amber' : 'green');

  return (
    <>
      <Card
        title="Project Status"
        right={<button className="btn sec sm" onClick={reload}>Refresh</button>}
      >
        <div className="grid g4">
          <Kpi label="Status" value={<Badge text={d.project.status} />} sub={`Health: ${evm.health}`} tone={evm.health === 'Critical' ? 'red' : evm.health === 'At Risk' ? 'amber' : 'green'} />
          <Kpi label="Progress (earned)" value={`${evm.percentComplete}%`} sub={`Planned: ${evm.percentPlanned}%`} />
          <Kpi label="Deadline" value={dt(d.project.deadline)} sub={`Original: ${dt(d.project.originalDeadline)}`} />
          <Kpi
            label="Projected finish"
            value={dt(d.schedule.projectedEnd)}
            sub={d.schedule.deadlineMissed ? `${d.schedule.daysBeyondDeadline} days beyond deadline` : 'Within deadline'}
            tone={d.schedule.deadlineMissed ? 'red' : 'green'}
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="muted">Earned progress vs planned</div>
          <Bar value={evm.percentComplete} />
          <div style={{ height: 4 }} />
          <Bar value={evm.percentPlanned} tone="amber" />
        </div>
      </Card>

      {d.warnings.length > 0 && (
        <Card title="Warnings">
          {d.warnings.map((w, i) => <div key={i} className={`alert ${w.level}`}>{w.message}</div>)}
        </Card>
      )}

      <Card title="Budget Status">
        <div className="grid g5">
          <Kpi label="Approved budget" value={money(d.budget.approved)} sub={d.project.originalBudget !== d.budget.approved ? `Original: ${money(d.project.originalBudget)}` : ''} />
          <Kpi label="Planned (BAC)" value={money(d.budget.planned)} />
          <Kpi label="Actual cost" value={money(d.budget.actual)} />
          <Kpi label="Remaining" value={money(d.budget.remaining)} />
          <Kpi label="Forecast (EAC)" value={money(d.budget.forecast)} sub={d.budget.status} tone={d.budget.status === 'Within budget' ? 'green' : 'red'} />
        </div>
        <div className="grid g4" style={{ marginTop: 12 }}>
          <Kpi label="CPI" value={evm.CPI ?? '-'} tone={tone(evm.CPI)} />
          <Kpi label="SPI" value={evm.SPI ?? '-'} tone={tone(evm.SPI)} />
          <Kpi label="PV / EV" value={`${money(evm.PV)} / ${money(evm.EV)}`} />
          <Kpi label="AC" value={money(evm.AC)} />
        </div>
      </Card>

      <div className="grid g2">
        <Card title={`Delayed Activities (${d.schedule.delayedActivities.length})`}>
          {d.schedule.delayedActivities.length === 0 ? <p className="muted">No delayed activities.</p> : (
            <Table head={['Activity', 'Delay', 'Slip', 'Impacted']}>
              {d.schedule.delayedActivities.map((a) => (
                <tr key={a.name}>
                  <td>{a.name}</td>
                  <td>{a.delayDays}d</td>
                  <td>{a.slipDays}d</td>
                  <td>{a.impactedActivities.join(', ') || '-'}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title={`Pending Change Requests (${d.changeRequests.pending.length})`}>
          {d.changeRequests.pending.length === 0 ? <p className="muted">No pending change requests.</p> : (
            <Table head={['Title', 'Cost', 'Days']}>
              {d.changeRequests.pending.map((c) => (
                <tr key={c.id}><td>{c.title}</td><td>{money(c.costImpact)}</td><td>+{c.scheduleImpactDays}</td></tr>
              ))}
            </Table>
          )}
          <p className="muted">Approved: {d.changeRequests.approved} | Rejected: {d.changeRequests.rejected}</p>
        </Card>
      </div>

      <div className="grid g2">
        <Card title={`Unresolved Critical Defects (${d.defects.criticalUnresolved.length})`}>
          {d.defects.criticalUnresolved.length === 0 ? <p className="muted">None.</p> : (
            <Table head={['Defect', 'Status', 'Assigned']}>
              {d.defects.criticalUnresolved.map((x) => (
                <tr key={x.id}><td>{x.title}</td><td><Badge text={x.status} /></td><td>{x.assignedTo || '-'}</td></tr>
              ))}
            </Table>
          )}
          <p className="muted">
            Total defects: {d.defects.total} | Unresolved: {d.defects.unresolved} (
            {d.defects.bySeverity.map((s) => `${s.severity}: ${s.unresolved}`).join(', ')})
          </p>
        </Card>

        <Card title="Top Risks & Requirements">
          <Table head={['Risk', 'Score', 'Band']}>
            {d.topRisks.map((r) => (
              <tr key={r.title}><td>{r.title}</td><td>{r.score}</td><td><Badge text={r.band} /></td></tr>
            ))}
          </Table>
          <p className="muted">
            Requirements - Approved: {d.requirements.approved} | Proposed: {d.requirements.proposed} | Rejected: {d.requirements.rejected}
          </p>
          <p className="muted">
            Activities completed: {d.progress.activitiesCompleted} / {d.progress.activitiesTotal}
          </p>
        </Card>
      </div>

      {c && (
        <Card title="Integration / Consistency Check" right={<Badge text={c.consistent ? 'Passed' : 'Failed'} />}>
          {c.issues.length === 0 ? <p className="muted">Requirements, activities, costs, change requests and quality records are consistent.</p> :
            c.issues.map((i, k) => <div key={k} className={`alert ${i.level === 'error' ? 'danger' : i.level === 'warning' ? 'caution' : 'info'}`}>{i.message}</div>)}
        </Card>
      )}

      {d.project.changeLog.length > 0 && (
        <Card title="Approved Change Log">
          <Table head={['Date', 'Change request', 'Cost impact', 'Schedule impact']}>
            {d.project.changeLog.map((l, i) => (
              <tr key={i}><td>{dt(l.date)}</td><td>{l.crTitle}</td><td>{money(l.costImpact)}</td><td>+{l.scheduleImpactDays} days</td></tr>
            ))}
          </Table>
        </Card>
      )}
    </>
  );
}