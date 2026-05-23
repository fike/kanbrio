---
name: monte-carlo-simulation
description: Technical instructions for implementing probabilistic forecasting.
---

# Monte Carlo Simulation Skill

Use this skill to implement the "When" and "How Many" forecasting modules.

## 1. Data Requirements

Input data must be a clean list of **Daily Throughput**:
- `[0, 1, 3, 0, 2, ...]` where each number is the count of items moved to 'Done' on a specific day.

## 2. Algorithm (Sampling with Replacement)

1. **Setup**: Define `backlog_size` and `iterations` (default 10,000).
2. **Loop**:
   - Randomly pick a throughput value from history.
   - Subtract from remaining backlog.
   - Track total days until backlog <= 0.
3. **Distribution**: Store the result of each iteration to build a histogram.

## 3. Interpretation (Confidence Levels)

Report results using percentiles:
- **50% (Median)**: The coin-flip date. Not for commitment.
- **85% (Professional)**: High confidence, accounts for variability.
- **95% (Safe)**: Minimal risk.

## 4. Implementation Notes

- Use a fast random number generator.
- Cache simulation results if historical data hasn't changed.
- For "How Many", fix the number of days and sum the sampled throughput.
