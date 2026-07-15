# Borneo Tracker — Resilience Index: Worked Demonstration (real data)

> A real run of the methodology using the actual values we sourced. **Illustrative** — benchmarks are provisional design choices, and a few values are estimates/proxies (marked ⚠). Purpose: show the index produces sensible, meaningful results — and one finding that proves the book's thesis.

## Indicator + benchmark used per pillar

| Pillar | Indicator | Floor (0) | Target (100) |
|---|---|---|---|
| Food | Food self-sufficiency ratio % | 0% | 100% |
| Energy | avg(electricity access %, renewable share vs 50%) | 0 | — |
| Education | Adult literacy % | 50% | 100% |
| Shelter | Clean/treated water access % | 0% | 100% |
| Healthcare | Hospital beds per 1,000 | 0 | 3.0 |
| Entertainment | Tourist arrivals per capita | 0 | 1.5 |

## Normalized pillar scores (0–100)

| Pillar | Sabah | Sarawak | Brunei | Kalimantan |
|---|---:|---:|---:|---:|
| Food | 62.6 | 62.6 | **8.4** | ~90 ⚠ |
| Energy | 58.1 | 99.7 | 50.0 | ~60 ⚠ |
| Education | 82.0 | 86.0 | 95.2 | 98.0 |
| Shelter | 80.5 | 83.7 | 100.0 | 76.3 |
| Healthcare | 49.7 | 47.3 | 100.0 | ~37 ⚠ |
| Entertainment | 51.3 | 90.0 | 20.0 | ~3 ⚠ (foreign-only data) |
| **Resilience Index (avg)** | **64.0** 🟡 | **78.2** 🟢 | **62.3** 🟡 | **~60.7** 🟡 |
| **Weakest pillar** | Healthcare 49.7 | Healthcare 47.3 | **Food 8.4** 🔴 | Entertainment ⚠ |
| Strict mode (geometric mean) | 62.5 | 76.0 | **44.7** | — |

**All-Borneo Resilience Index ≈ 66** (average of the four) — close to the 64.7 in the mockup, by coincidence.

## The headline finding (this *is* the book's thesis)

**Brunei.** By money it's the richest territory. But its **Food self-sufficiency is 8.4%** — it imports ~90% of its food. So:
- Arithmetic index = 62.3 (Yellow) — already dragged down by Food.
- **Strict resilience mode = 44.7** (almost Critical) — because the weakest-link maths punishes the food gap hard.

→ This literally demonstrates **"paper wealth ≠ true wealth"**: Brunei has the money, the hospitals, the water — but it is **not food-resilient**, so its *True Wealth* score is fragile. That single result is the most powerful story your dashboard can tell.

Meanwhile **Sarawak scores highest (78)** — driven by **hydro energy self-sufficiency (75%)** and strong tourism. Wealth here = resources, not GDP.

## Honesty notes (what's solid vs estimated)
- ✅ Solid real values: Brunei Food SSR 8.4%, electricity access (all 4), water access (all 4), Brunei hospital beds 4.19/1k, tourism arrivals (Sabah/Sarawak/Brunei).
- ⚠ Estimated/proxy: Kalimantan food SSR (~Indonesia national), Kalimantan healthcare beds & renewable share, literacy for Sabah/Sarawak, Kalimantan tourism (only foreign arrivals found → understated; domestic would raise it a lot).
- Benchmarks (the "100") are provisional — changing them shifts scores. That's the design decision to confirm with the supervisor.

## Takeaway
The mechanism works: it turns messy multi-unit data into one comparable 0–100 score per territory, surfaces the weakest pillar, and produces a genuinely meaningful insight (Brunei's food fragility). Once benchmarks are confirmed and the proxy values replaced with exact ones, these become the real dashboard numbers.
