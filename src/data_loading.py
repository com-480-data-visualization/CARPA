"""Data loading utilities for the UCSD Book Graph."""

import gzip
import json
from collections import Counter
from pathlib import Path

import pandas as pd

# ── File paths ────────────────────────────────────────────────────────
DATA_DIR = Path("data")

BOOKS_FILE = DATA_DIR / "goodreads_books.json.gz"
INTERACTIONS_FILE = DATA_DIR / "goodreads_interactions.csv"
REVIEWS_FILE = DATA_DIR / "goodreads_reviews_dedup.json.gz"
GENRES_FILE = DATA_DIR / "goodreads_book_genres_initial.json.gz"


def check_files():
    """Print existence status of all data files."""
    for label, path in [
        ("Books", BOOKS_FILE),
        ("Interactions", INTERACTIONS_FILE),
        ("Reviews", REVIEWS_FILE),
        ("Genres", GENRES_FILE),
    ]:
        status = "✓" if path.exists() else "✗ MISSING"
        print(f"  {status}  {label}: {path.name}")


def load_gz_jsonl(path, max_records=None, usecols=None):
    """Load gzipped JSON-lines into a DataFrame."""
    records = []
    with gzip.open(path, "rt", encoding="utf-8") as f:
        for i, line in enumerate(f):
            if max_records is not None and i >= max_records:
                break
            rec = json.loads(line)
            if usecols:
                rec = {k: rec.get(k) for k in usecols}
            records.append(rec)
    return pd.DataFrame(records)


def count_lines_gz(path):
    """Count lines in a gzipped file."""
    n = 0
    with gzip.open(path, "rt", encoding="utf-8") as f:
        for _ in f:
            n += 1
    return n


def load_genre_mapping():
    """Load genre mapping: returns (book_to_genre dict, genre_book_counts Counter)."""
    book_to_genre = {}
    genre_book_counts = Counter()

    with gzip.open(GENRES_FILE, "rt", encoding="utf-8") as f:
        for line in f:
            rec = json.loads(line)
            genres = rec.get("genres", {})
            if genres:
                primary = max(genres, key=genres.get)
                book_to_genre[str(rec["book_id"])] = primary
                for g in genres:
                    genre_book_counts[g] += 1

    return book_to_genre, genre_book_counts


def load_books(usecols=None):
    """Load book metadata with standard type coercion."""
    if usecols is None:
        usecols = [
            "book_id", "title", "language_code", "average_rating",
            "ratings_count", "num_pages", "publication_year",
        ]
    books = load_gz_jsonl(BOOKS_FILE, usecols=usecols)

    numeric_cols = ["average_rating", "ratings_count", "num_pages", "publication_year"]
    for col in numeric_cols:
        if col in books.columns:
            books[col] = pd.to_numeric(books[col], errors="coerce")

    return books
