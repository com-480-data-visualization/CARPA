"""Analysis functions for the UCSD Book Graph."""

from collections import Counter

import numpy as np
import pandas as pd

from .data_loading import INTERACTIONS_FILE, REVIEWS_FILE, load_gz_jsonl


def scan_interactions(book_to_genre, chunk_size=5_000_000):
    """Single-pass scan of interactions CSV. Returns a dict of accumulators."""
    total_rows = 0
    total_read = 0
    total_rated = 0
    unique_users = set()
    rating_counter = Counter()
    genre_interaction_counts = Counter()
    user_n_interactions = Counter()
    user_n_rated = Counter()

    print("Scanning full interactions CSV (single pass) ...")
    for i, chunk in enumerate(pd.read_csv(INTERACTIONS_FILE, chunksize=chunk_size)):
        total_rows += len(chunk)
        total_read += (chunk["is_read"] == 1).sum()

        rated = chunk[chunk["rating"] > 0]
        total_rated += len(rated)
        for val in rated["rating"]:
            rating_counter[val] += 1

        unique_users.update(chunk["user_id"].unique())

        for uid in chunk["user_id"]:
            user_n_interactions[uid] += 1
        for uid in rated["user_id"]:
            user_n_rated[uid] += 1

        for bid in chunk["book_id"].astype(str):
            g = book_to_genre.get(bid)
            if g:
                genre_interaction_counts[g] += 1

        if (i + 1) % 10 == 0:
            print(f"  ... {total_rows:,} rows processed")

    print(f"Done. {total_rows:,} rows total.")

    return {
        "total_rows": total_rows,
        "total_read": total_read,
        "total_rated": total_rated,
        "unique_users": unique_users,
        "rating_counter": rating_counter,
        "genre_interaction_counts": genre_interaction_counts,
        "user_n_interactions": user_n_interactions,
        "user_n_rated": user_n_rated,
    }


def compute_rating_stats(rating_counter, total_rated):
    """Compute mean rating and high-rating share."""
    weighted_sum = sum(r * c for r, c in rating_counter.items())
    mean_rating = weighted_sum / total_rated
    high_ratings = sum(c for r, c in rating_counter.items() if r >= 4)
    high_pct = high_ratings / total_rated
    return mean_rating, high_pct, high_ratings


def build_user_activity(user_n_interactions, user_n_rated):
    """Build user activity DataFrame with percentile summary."""
    df = pd.DataFrame({
        "n_interactions": pd.Series(user_n_interactions),
        "n_rated": pd.Series(user_n_rated),
    }).fillna(0).astype(int)
    return df


def load_temporal_reviews(max_records=2_000_000):
    """Load review dates for temporal analysis."""
    rev_dates = load_gz_jsonl(
        REVIEWS_FILE, max_records=max_records, usecols=["date_added"]
    )
    rev_dates["date_added"] = pd.to_datetime(
        rev_dates["date_added"],
        format="%a %b %d %H:%M:%S %z %Y",
        errors="coerce",
        utc=True,
    )
    rev_dates = rev_dates.dropna(subset=["date_added"])
    rev_dates = rev_dates[
        (rev_dates["date_added"].dt.year >= 2000)
        & (rev_dates["date_added"].dt.year <= 2018)
    ]
    return rev_dates
