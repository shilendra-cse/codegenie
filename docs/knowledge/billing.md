# Plans & Billing

> Status: **Accepted** · Last updated: 2026-10-25 · Related: [requirements.md](./requirements.md), [development-plan.md](./development-plan.md)

## 1. MVP: free tier only

| | Free |
|---|---|
| Runs | 10 per user per month |
| Model | GPT-6 Luna (platform-controlled) |
| Concurrent runs | 1 |
| Price | ₹0 |

No payment setup in the MVP. Limits are enforced when a task is created and rejected with a clear message; the web app shows the runs used this month. Built in Phase 5 ([development-plan.md](./development-plan.md)), before the deploy.

## 2. After launch: Pro plans

- **Subscription:** a fixed monthly price, starting at **₹599** (incl. GST), with higher tiers above it. It pays for infra and includes credits.
- **Top-ups:** more credits when the included ones run out. Priced at cost or slightly above (payment fees, GST, exchange rate); they pay for usage, not infra.
- **Model choice:** per run, any model in the catalog. Plans differ by price and included credits, never by which models they unlock.
- Exact tiers and credit amounts are set from measured run costs.

## 3. Credits

**1 credit = ₹1 of our real cost** for a run:

```
credits = AI cost + sandbox cost            (rounded up)
AI cost      = runs.cost_usd × USD→INR rate
sandbox cost = sandbox minutes × ₹/minute for its size (Daytona pricing, a config value)
```

**Infra** (server, worker hosts, Postgres, Redis) is a fixed monthly cost and is never metered. Each plan's price, after GST, minus its included credits must cover infra and leave a margin, even when every credit is used.

Users see credits, never rupees, inside the product. The pricing page also shows them as approximate runs (e.g. "~N runs on Luna").

## 4. Decided against

- **Bring your own API key:** not a SaaS model, and the sandbox and infra are ours anyway.
- **Model tiers as plans** (fast / balanced / best): the model is a choice per run, not something a plan unlocks.
- **Plan price = credits at cost** (e.g. ₹599 buys ₹599 of usage): no margin left for infra.
