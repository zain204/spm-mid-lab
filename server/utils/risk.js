// Prioritization Matrix helpers
const riskScore = (likelihood, impact) => Number(likelihood) * Number(impact);

const riskBand = (score) => {
  if (score >= 15) return 'Critical';
  if (score >= 9) return 'High';
  if (score >= 4) return 'Medium';
  return 'Low';
};

module.exports = { riskScore, riskBand };