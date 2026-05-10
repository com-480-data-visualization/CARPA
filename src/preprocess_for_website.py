#!/usr/bin/env python3
"""
Preprocess UCSD Book Graph data into small JSON files for the website.
Uses subsets/sampling for speed (~2-5 min total).

Outputs (in website/data/):
  - streamgraph.json   : genre shares by quarter (2010-2017)
  - drift.json         : avg rating by nth-book-read
  - aspiration.json    : shelved-to-read vs actually-read rates by genre
"""

import gzip
import json
from collections import Counter, defaultdict
from pathlib import Path
from datetime import datetime

import pandas as pd
import numpy as np

DATA_DIR = Path("data")
OUT_DIR = Path("website/data")
OUT_DIR.mkdir(parents=True, exist_ok=True)

GENRES_FILE = DATA_DIR / "goodreads_book_genres_initial.json.gz"
INTERACTIONS_FILE = DATA_DIR / "goodreads_interactions.csv"
REVIEWS_FILE = DATA_DIR / "goodreads_reviews_dedup.json.gz"
BOOKS_FILE = DATA_DIR / "goodreads_books.json.gz"

# Sample sizes
REVIEW_SAMPLE = 2_000_000
INTERACTION_ROWS = 20_000_000  # ~10% of full dataset
BOOK_SAMPLE = 500_000

TOP_GENRES = [
    "romance",
    "mystery, thriller, crime",
    "fantasy, paranormal",
    "young-adult",
    "fiction",
    "non-fiction",
    "history, historical fiction, biography",
    "comics, graphic",
    "poetry",
    "children",
]

GENRE_DISPLAY = {
    "romance": "Romance",
    "mystery, thriller, crime": "Mystery & Thriller",
    "fantasy, paranormal": "Fantasy & Paranormal",
    "young-adult": "Young Adult",
    "fiction": "Fiction",
    "non-fiction": "Non-Fiction",
    "history, historical fiction, biography": "History & Biography",
    "comics, graphic": "Comics & Graphic",
    "poetry": "Poetry",
    "children": "Children",
}


def load_genre_mapping():
    """Load book_id -> primary genre mapping."""
    print("Loading genre mapping ...")
    book_to_genre = {}
    with gzip.open(GENRES_FILE, "rt", encoding="utf-8") as f:
        for line in f:
            rec = json.loads(line)
            genres = rec.get("genres", {})
            if genres:
                primary = max(genres, key=genres.get)
                if primary in TOP_GENRES:
                    book_to_genre[str(rec["book_id"])] = primary
    print(f"  {len(book_to_genre):,} books mapped")
    return book_to_genre


def build_streamgraph(book_to_genre):
    """Genre shares by quarter from first {REVIEW_SAMPLE} reviews."""
    print(f"\n=== STREAMGRAPH (sampling {REVIEW_SAMPLE:,} reviews) ===")

    quarter_genre = defaultdict(Counter)
    n = 0

    with gzip.open(REVIEWS_FILE, "rt", encoding="utf-8") as f:
        for line in f:
            if n >= REVIEW_SAMPLE:
                break
            n += 1
            rec = json.loads(line)

            if rec.get("rating", 0) < 4:
                continue

            genre = book_to_genre.get(str(rec.get("book_id", "")))
            if not genre:
                continue

            try:
                dt = datetime.strptime(rec.get("date_added", ""), "%a %b %d %H:%M:%S %z %Y")
            except (ValueError, TypeError):
                continue

            if dt.year < 2010 or dt.year > 2017:
                continue

            key = f"{dt.year}-Q{(dt.month - 1) // 3 + 1}"
            quarter_genre[key][genre] += 1

    print(f"  Scanned: {n:,} reviews, {len(quarter_genre)} quarters")

    data = []
    for q in sorted(quarter_genre.keys()):
        row = {"quarter": q}
        total = sum(quarter_genre[q].values())
        for g in TOP_GENRES:
            row[GENRE_DISPLAY[g]] = round(quarter_genre[q].get(g, 0) / max(total, 1) * 100, 2)
        data.append(row)

    out = OUT_DIR / "streamgraph.json"
    json.dump(data, open(out, "w"), indent=1)
    print(f"  Written: {out} ({len(data)} quarters)")


def build_drift():
    """Rating drift from first {INTERACTION_ROWS} interaction rows."""
    print(f"\n=== RATING DRIFT (sampling {INTERACTION_ROWS:,} rows) ===")

    user_ratings = defaultdict(list)
    n = 0

    for chunk in pd.read_csv(INTERACTIONS_FILE, chunksize=5_000_000):
        rated = chunk[chunk["rating"] > 0]
        for uid, rating in zip(rated["user_id"], rated["rating"]):
            user_ratings[uid].append(rating)
        n += len(chunk)
        print(f"  ... {n:,} rows")
        if n >= INTERACTION_ROWS:
            break

    power_users = {uid: r for uid, r in user_ratings.items() if len(r) >= 30}
    print(f"  Users with 30+ ratings: {len(power_users):,}")

    max_n = 250
    position_ratings = defaultdict(list)
    for rats in power_users.values():
        for i, r in enumerate(rats[:max_n], 1):
            position_ratings[i].append(r)

    data = []
    for i in range(1, max_n + 1):
        rats = position_ratings.get(i, [])
        if len(rats) < 50:
            continue
        arr = np.array(rats)
        data.append({
            "bookNumber": i,
            "avgRating": round(float(arr.mean()), 4),
            "stdLow": round(float(arr.mean() - arr.std()), 4),
            "stdHigh": round(float(arr.mean() + arr.std()), 4),
            "count": len(rats),
        })

    out = OUT_DIR / "drift.json"
    json.dump(data, open(out, "w"), indent=1)
    print(f"  Written: {out} ({len(data)} points)")


def build_aspiration(book_to_genre):
    """Aspiration vs reality from first {BOOK_SAMPLE} books + sampled interactions."""
    print(f"\n=== ASPIRATION (sampling {BOOK_SAMPLE:,} books + {INTERACTION_ROWS:,} interactions) ===")

    genre_to_read_count = Counter()  # books with "to-read" shelving
    genre_book_count = Counter()     # total books per genre
    n = 0

    with gzip.open(BOOKS_FILE, "rt", encoding="utf-8") as f:
        for line in f:
            if n >= BOOK_SAMPLE:
                break
            n += 1
            rec = json.loads(line)

            genre = book_to_genre.get(str(rec.get("book_id", "")))
            if not genre:
                continue

            genre_book_count[genre] += 1

            shelves = rec.get("popular_shelves", [])
            to_read_count = 0
            total_count = 0
            for shelf in shelves:
                count = int(shelf.get("count", 0))
                total_count += count
                if shelf.get("name") == "to-read":
                    to_read_count = count

            # Fraction of shelvings that are "to-read" for this book
            if total_count > 0:
                genre_to_read_count[genre] += to_read_count / total_count

    print(f"  Books scanned: {n:,}")

    # Average to-read fraction per genre
    data = []
    for g in TOP_GENRES:
        n_books = genre_book_count.get(g, 1)
        avg_to_read_frac = genre_to_read_count.get(g, 0) / n_books
        avg_read_frac = 1 - avg_to_read_frac

        data.append({
            "genre": GENRE_DISPLAY[g],
            "shelved": round(avg_to_read_frac * 100, 1),
            "read": round(avg_read_frac * 100, 1),
        })

    data.sort(key=lambda d: d["shelved"] - d["read"], reverse=True)

    out = OUT_DIR / "aspiration.json"
    json.dump(data, open(out, "w"), indent=1)
    print(f"  Written: {out} ({len(data)} genres)")


if __name__ == "__main__":
    book_to_genre = load_genre_mapping()
    build_streamgraph(book_to_genre)
    build_drift()
    build_aspiration(book_to_genre)
    print("\n✓ Done. Output in website/data/")
