# Outreach Priority

Maps, LinkedIn, and Combined results use the same 100-point scale. Higher priority means the available evidence makes a lead more relevant and easier to act on; it is not a conversion prediction.

- **Search fit (45):** category first, then name and description as weaker signals. If a city was requested, 10 of the 45 points are for location. Common aliases such as Bengaluru/Bangalore and gym/fitness studio are normalized.
- **Reachability (35):** listed phone (17), business website (12, or 5 for a known social/directory site), LinkedIn company page (4), and address (2). Missing information earns no points but does not mean a channel does not exist. A listed channel is not independently verified.
- **Credibility (20):** review counts and followers have diminishing returns, ratings are discounted when review counts are low, and LinkedIn followers can contribute at most 9 points on their own. Combined results use the stronger source plus a fraction of the weaker one, capped at 20.

Combined matching requires a unique normalized name and corroborating city evidence. Older Combined rows without that evidence are scored using their Maps fields only. Scores are recalculated locally; Excel includes the formula version, reasons, priority band, and evidence coverage. Coverage describes the available data, not the probability that a lead is good.

The initial weights should be checked against manually labeled top results before treating the ranking as calibrated.
