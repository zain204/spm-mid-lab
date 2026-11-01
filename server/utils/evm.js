// Earned Value Management
const r2 = (n) => (n === null || n === undefined || Number.isNaN(n) ? null : Math.round(n * 100) / 100);

function plannedPercent(baseStart, baseEnd, at) {
  const s = new Date(baseStart).getTime();
  const e = new Date(baseEnd).getTime();
  const t = new Date(at).getTime();
  if (e <= s) return t >= s ? 1 : 0;
  return Math.min(1, Math.max(0, (t - s) / (e - s)));
}

function computeEVM(rows, statusDate, thresholds = { cpi: 0.9, spi: 0.9 }, approvedBudget = 0) {
  let BAC = 0, PV = 0, EV = 0, AC = 0;
  const items = rows.map((r) => {
    const pp = plannedPercent(r.baselineStart, r.baselineEnd, statusDate);
    const pv = r.plannedCost * pp;
    const ev = r.plannedCost * (r.percentComplete / 100);
    BAC += r.plannedCost;
    PV += pv;
    EV += ev;
    AC += r.actualCost;
    return {
      id: r.id,
      name: r.name,
      bac: r.plannedCost,
      plannedPercent: r2(pp * 100),
      percentComplete: r.percentComplete,
      pv: Math.round(pv),
      ev: Math.round(ev),
      ac: r.actualCost,
      cpi: r.actualCost > 0 ? r2(ev / r.actualCost) : null,
      spi: pv > 0 ? r2(ev / pv) : null,
    };
  });

  const CPI = AC > 0 ? EV / AC : null;
  const SPI = PV > 0 ? EV / PV : null;
  const EAC = CPI ? BAC / CPI : BAC;
  const money = (n) => 'PKR ' + Math.round(n).toLocaleString('en-US');

  const warnings = [];
  if (CPI !== null) {
    if (CPI < thresholds.cpi)
      warnings.push({ type: 'COST_OVERRUN', level: 'danger', message: `Cost overrun: CPI ${CPI.toFixed(2)} is below threshold ${thresholds.cpi}` });
    else if (CPI < 1)
      warnings.push({ type: 'COST_CAUTION', level: 'caution', message: `Cost caution: CPI ${CPI.toFixed(2)} is below 1.00` });
  }
  if (SPI !== null) {
    if (SPI < thresholds.spi)
      warnings.push({ type: 'SCHEDULE_DELAY', level: 'danger', message: `Schedule delay: SPI ${SPI.toFixed(2)} is below threshold ${thresholds.spi}` });
    else if (SPI < 1)
      warnings.push({ type: 'SCHEDULE_CAUTION', level: 'caution', message: `Schedule caution: SPI ${SPI.toFixed(2)} is below 1.00` });
  }
  if (approvedBudget > 0) {
    if (BAC > approvedBudget)
      warnings.push({ type: 'BAC_EXCEEDS_BUDGET', level: 'danger', message: `Planned cost ${money(BAC)} exceeds approved budget ${money(approvedBudget)}` });
    if (AC > approvedBudget)
      warnings.push({ type: 'BUDGET_EXHAUSTED', level: 'danger', message: `Actual cost ${money(AC)} already exceeds approved budget` });
    else if (EAC > approvedBudget)
      warnings.push({ type: 'FORECAST_OVERRUN', level: 'danger', message: `Forecast at completion ${money(EAC)} exceeds approved budget by ${money(EAC - approvedBudget)}` });
  }

  const health = warnings.some((w) => w.level === 'danger') ? 'Critical' : warnings.length ? 'At Risk' : 'On Track';
  return {
    statusDate,
    BAC: Math.round(BAC),
    PV: Math.round(PV),
    EV: Math.round(EV),
    AC: Math.round(AC),
    CV: Math.round(EV - AC),
    SV: Math.round(EV - PV),
    CPI: r2(CPI),
    SPI: r2(SPI),
    EAC: Math.round(EAC),
    ETC: Math.round(EAC - AC),
    VAC: Math.round(BAC - EAC),
    percentPlanned: BAC ? r2((PV / BAC) * 100) : 0,
    percentComplete: BAC ? r2((EV / BAC) * 100) : 0,
    thresholds,
    health,
    warnings,
    items,
  };
}

module.exports = { computeEVM, plannedPercent };