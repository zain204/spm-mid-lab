// Run: npm test   (database ki zaroorat nahi, pure logic tests)
const { buildSchedule, applyChangeImpact, diffDays } = require('./utils/scheduler');
const { computeEVM } = require('./utils/evm');
const { riskScore, riskBand } = require('./utils/risk');

const start = new Date('2026-01-05T00:00:00Z');
const project = { startDate: start, deadline: new Date('2026-01-20T00:00:00Z') }; // 15 days
const mk = (id, dur, preds = [], extra = {}) => ({
  id, name: id, durationDays: dur, predecessors: preds, plannedCost: 1000, actualCost: 0, percentComplete: 0, delayDays: 0, ...extra,
});
const row = (s, id) => s.activities.find((a) => a.id === id);

const results = [];
function test(id, desc, expected, fn) {
  let actual, pass;
  try {
    actual = fn();
    pass = JSON.stringify(actual) === JSON.stringify(expected);
  } catch (e) {
    actual = 'Error: ' + e.message;
    pass = typeof expected === 'string' && e.message.includes(expected);
  }
  results.push({ ID: id, Description: desc, Expected: JSON.stringify(expected), Actual: typeof actual === 'string' ? actual : JSON.stringify(actual), Result: pass ? 'PASS' : 'FAIL' });
}

test('TC-01', 'Sequential activities A(5d) -> B(3d): project length', 8, () =>
  diffDays(buildSchedule([mk('A', 5), mk('B', 3, ['A'])], project, start).projectEnd, start));

test('TC-02', 'Activity C waits for the longest predecessor (A=5d, B=8d)', 8, () =>
  diffDays(row(buildSchedule([mk('A', 5), mk('B', 8), mk('C', 2, ['A', 'B'])], project, start), 'C').start, start));

test('TC-03', 'Delay of 4 days on A shifts successor B start to day 9', 9, () =>
  diffDays(row(buildSchedule([mk('A', 5, [], { delayDays: 4 }), mk('B', 3, ['A'])], project, start), 'B').start, start));

test('TC-04', 'Delay on A is reported as the cause of the slip on B', ['A'], () =>
  row(buildSchedule([mk('A', 5, [], { delayDays: 4 }), mk('B', 3, ['A'])], project, start), 'B').causedBy);

test('TC-05', 'Delay of 1 day on non-critical branch does not move the final date', 7, () =>
  diffDays(buildSchedule([mk('A', 5), mk('B', 3, [], { delayDays: 1 }), mk('C', 2, ['A', 'B'])], project, start).projectEnd, start));

test('TC-06', 'Circular dependency is rejected', 'Circular dependency', () =>
  buildSchedule([mk('A', 2, ['B']), mk('B', 2, ['A'])], project, start));

test('TC-07', 'Delay pushes project 3 days beyond the 15-day deadline', 3, () =>
  buildSchedule([mk('A', 10, [], { delayDays: 8 })], project, start).daysBeyondDeadline);

const at = new Date(start.getTime() + 5 * 86400000); // day 5
const evmOf = (extra) => computeEVM(buildSchedule([mk('A', 10, [], extra)], project, at).activities, at, { cpi: 0.9, spi: 0.9 }, 5000);

test('TC-08', 'EVM values [PV, EV, AC, CPI, SPI] at 50% planned, 40% done, AC 600', [500, 400, 600, 0.67, 0.8], () => {
  const e = evmOf({ percentComplete: 40, actualCost: 600 });
  return [e.PV, e.EV, e.AC, e.CPI, e.SPI];
});

test('TC-09', 'Cost overrun and schedule delay warnings are raised', ['COST_OVERRUN', 'SCHEDULE_DELAY'], () =>
  evmOf({ percentComplete: 40, actualCost: 600 }).warnings.map((w) => w.type));

test('TC-10', 'On-track project: CPI=1, SPI=1, no warnings', [1, 1, 'On Track'], () => {
  const e = evmOf({ percentComplete: 50, actualCost: 500 });
  return [e.CPI, e.SPI, e.health];
});

test('TC-11', 'CPI is null when no actual cost has been spent', null, () => evmOf({ percentComplete: 0, actualCost: 0 }).CPI);

test('TC-12', 'Approved CR adds PKR 800,000 and 21 days to budget/deadline', [5800000, 21], () => {
  const r = applyChangeImpact(5000000, new Date('2026-05-01T00:00:00Z'), 800000, 21);
  return [r.budget, diffDays(r.deadline, '2026-05-01')];
});

test('TC-13', 'Risk score likelihood 4 x impact 5 = 20 (Critical)', [20, 'Critical'], () => [riskScore(4, 5), riskBand(riskScore(4, 5))]);
test('TC-14', 'Risk score likelihood 2 x impact 2 = 4 (Medium)', [4, 'Medium'], () => [riskScore(2, 2), riskBand(riskScore(2, 2))]);

console.table(results);
const failed = results.filter((r) => r.Result === 'FAIL').length;
console.log(failed ? `${failed} test(s) FAILED` : `All ${results.length} tests PASSED`);
process.exit(failed ? 1 : 0);