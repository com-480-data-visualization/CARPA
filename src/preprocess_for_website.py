#!/usr/bin/env python3
"""
Preprocess UCSD Book Graph data into small JSON files for the website.
Uses subsets/sampling for speed and keeps the committed rating-drift aggregate
by default. Set REBUILD_DRIFT=1 to recompute the drift aggregate from raw dated
review records.

Outputs (in website/data/):
  - streamgraph.json   : genre shares by quarter (2010-2017)
  - drift.json         : avg rating by nth dated review rating
  - aspiration.json    : shelved-to-read vs actually-read rates by genre
"""

import gzip
import json
import os
import re
import calendar
from collections import Counter, defaultdict
from pathlib import Path
from datetime import datetime

import numpy as np

DATA_DIR = Path("data")
OUT_DIR = Path("website/data")
OUT_DIR.mkdir(parents=True, exist_ok=True)

GENRES_FILE = DATA_DIR / "goodreads_book_genres_initial.json.gz"
REVIEWS_FILE = DATA_DIR / "goodreads_reviews_dedup.json.gz"
BOOKS_FILE = DATA_DIR / "goodreads_books.json.gz"

# Sample sizes / limits
REVIEW_SAMPLE = 2_000_000
BOOK_SAMPLE = 500_000
DRIFT_MIN_REVIEWS = 30
DRIFT_MAX_N = 250
REBUILD_DRIFT = os.getenv("REBUILD_DRIFT", "").lower() in {"1", "true", "yes"}
DRIFT_REVIEW_LIMIT = os.getenv("DRIFT_REVIEW_LIMIT")
DRIFT_REVIEW_LIMIT = int(DRIFT_REVIEW_LIMIT) if DRIFT_REVIEW_LIMIT else None

MONTH_NUM = {
    "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4,
    "May": 5, "Jun": 6, "Jul": 7, "Aug": 8,
    "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12,
}

REVIEW_FIELD_PATTERNS = {
    "user_id": re.compile(r'"user_id": "([^"]+)"'),
    "book_id": re.compile(r'"book_id": "([^"]+)"'),
    "rating": re.compile(r'"rating": ([0-5])'),
    "read_at": re.compile(r'"read_at": "([^"]*)"'),
    "date_added": re.compile(r'"date_added": "([^"]*)"'),
}

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


def parse_goodreads_date(date_text):
    """Parse Goodreads dates quickly into UTC epoch seconds."""
    if not date_text:
        return None
    try:
        # Example: "Sat Oct 07 00:00:00 -0700 2017"
        parts = date_text.split()
        month = MONTH_NUM[parts[1]]
        day = int(parts[2])
        hour, minute, second = (int(part) for part in parts[3].split(":"))
        offset = parts[4]
        year = int(parts[5])
        sign = 1 if offset[0] == "+" else -1
        offset_seconds = sign * (int(offset[1:3]) * 3600 + int(offset[3:5]) * 60)
        local_seconds = calendar.timegm((year, month, day, hour, minute, second, 0, 0, 0))
        return local_seconds - offset_seconds
    except (IndexError, KeyError, TypeError, ValueError):
        return None


def regex_field(line, key):
    match = REVIEW_FIELD_PATTERNS[key].search(line)
    return match.group(1) if match else None


def parse_review_rating_line(line):
    """Extract the fields needed for drift without parsing review_text JSON."""
    rating_text = regex_field(line, "rating")
    if not rating_text or rating_text == "0":
        return None

    uid = regex_field(line, "user_id")
    if not uid:
        return None

    date_text = regex_field(line, "read_at") or regex_field(line, "date_added")
    timestamp = parse_goodreads_date(date_text)
    if timestamp is None:
        return None

    return uid, regex_field(line, "book_id") or "", timestamp, int(rating_text)


def iter_review_rating_events(limit=None):
    """Yield dated rating events from Goodreads review records.

    The interactions CSV does not include timestamps, so it is not a legitimate
    source for "nth book read" ordering. Review records include dates; we use
    read_at when available and date_added as the fallback.
    """
    with gzip.open(REVIEWS_FILE, "rt", encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            if limit is not None and n > limit:
                break

            parsed = parse_review_rating_line(line)
            if parsed is None:
                continue
            uid, book_id, timestamp, rating = parsed
            yield n, uid, book_id, timestamp, rating


def build_drift():
    """Rating drift from chronologically ordered, dated review ratings."""
    out = OUT_DIR / "drift.json"
    should_rebuild = REBUILD_DRIFT or DRIFT_REVIEW_LIMIT is not None or not out.exists()
    if not should_rebuild:
        print("\n=== RATING DRIFT (using committed aggregate) ===")
        print(f"  Kept: {out}")
        print("  Set REBUILD_DRIFT=1 to recompute from raw dated review records.")
        return

    limit_text = f"first {DRIFT_REVIEW_LIMIT:,}" if DRIFT_REVIEW_LIMIT else "all"
    print(f"\n=== RATING DRIFT ({limit_text} dated review records) ===")

    user_counts = Counter()
    scanned = 0
    usable = 0

    # First pass: identify users with enough dated ratings to form a sequence.
    for scanned, uid, _book_id, _timestamp, _rating in iter_review_rating_events(DRIFT_REVIEW_LIMIT):
        user_counts[uid] += 1
        usable += 1
        if usable % 2_000_000 == 0:
            print(f"  ... {usable:,} usable dated ratings counted")

    power_users = {uid for uid, count in user_counts.items() if count >= DRIFT_MIN_REVIEWS}
    print(f"  Scanned review lines: {scanned:,}")
    print(f"  Usable dated ratings: {usable:,}")
    print(f"  Users with {DRIFT_MIN_REVIEWS}+ dated ratings: {len(power_users):,}")

    user_events = defaultdict(list)
    usable_power_events = 0

    # Second pass: collect only the users that pass the sequence threshold.
    for _scanned, uid, book_id, timestamp, rating in iter_review_rating_events(DRIFT_REVIEW_LIMIT):
        if uid not in power_users:
            continue
        user_events[uid].append((timestamp, book_id, rating))
        usable_power_events += 1
        if usable_power_events % 2_000_000 == 0:
            print(f"  ... {usable_power_events:,} dated ratings collected")

    print(f"  Dated ratings for qualifying users: {usable_power_events:,}")

    position_ratings = defaultdict(list)
    included_users = 0
    for events in user_events.values():
        if len(events) < DRIFT_MIN_REVIEWS:
            continue
        included_users += 1
        events.sort(key=lambda item: (item[0], item[1]))
        for i, (_timestamp, _book_id, rating) in enumerate(events[:DRIFT_MAX_N], 1):
            position_ratings[i].append(rating)

    data = []
    for i in range(1, DRIFT_MAX_N + 1):
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

    json.dump(data, open(out, "w"), indent=1)
    print(f"  Included users after date parsing: {included_users:,}")
    print(f"  Written: {out} ({len(data)} points)")


def build_aspiration(book_to_genre):
    """Aspiration vs reality from first {BOOK_SAMPLE} books + sampled interactions."""
    print(f"\n=== ASPIRATION (sampling {BOOK_SAMPLE:,} books) ===")

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
