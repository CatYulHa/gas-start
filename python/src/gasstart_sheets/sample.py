"""Deterministic sample dataset (date, category, value) — the schema the dashboard expects."""

from __future__ import annotations

import datetime as dt

import numpy as np
import pandas as pd

CATEGORIES = {"Web": 120, "Mobile": 90, "Store": 60}


def sample_frame(days: int = 90, end: dt.date | None = None, seed: int = 42) -> pd.DataFrame:
    end = end or dt.date.today()
    start = end - dt.timedelta(days=days - 1)
    rng = np.random.default_rng(seed)
    records = []
    for d in range(days):
        day = start + dt.timedelta(days=d)
        weekend = 0.7 if day.weekday() >= 5 else 1.0
        trend = 1 + (d / days) * 0.35
        for category, base in CATEGORIES.items():
            value = int(round(base * trend * weekend * rng.uniform(0.85, 1.15)))
            records.append({"date": day.isoformat(), "category": category, "value": value})
    return pd.DataFrame.from_records(records)
