#!/usr/bin/env python3
"""
Download the UCSD Book Graph (full dataset) from mcauleylab.ucsd.edu.

Usage:
    python download_data.py              # download all files
    python download_data.py --only books # download only book metadata
    python download_data.py --check      # check which files exist

Files downloaded:
    data/goodreads_books.json.gz             ~1.9 GB  (book metadata)
    data/goodreads_interactions.csv          ~4.0 GB  (229M user-book interactions)
    data/goodreads_reviews_dedup.json.gz     ~5.0 GB  (15.7M detailed reviews)
    data/goodreads_book_genres_initial.json.gz  ~23 MB (genre tags)
    data/goodreads_book_authors.json.gz         ~17 MB (author metadata)
    data/book_id_map.csv                        ~36 MB (ID mapping)
    data/user_id_map.csv                        ~33 MB (ID mapping)

Total: ~11 GB

Citation:
    Wan, M. & McAuley, J. (2018). Item Recommendation on Monotonic Behavior Chains. RecSys'18.
    Wan, M., Misra, R., Nakashole, N. & McAuley, J. (2019). Fine-Grained Spoiler Detection
    from Large-Scale Review Corpora. ACL'19.
"""

import argparse
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

# ── File registry ──────────────────────────────────────────────────────
BASE_URL = "https://mcauleylab.ucsd.edu/public_datasets/gdrive/goodreads"

FILES = {
    "books": {
        "url": f"{BASE_URL}/goodreads_books.json.gz",
        "filename": "goodreads_books.json.gz",
        "size_approx": "1.9 GB",
        "description": "Book metadata (2.36M books)",
    },
    "interactions": {
        "url": f"{BASE_URL}/goodreads_interactions.csv",
        "filename": "goodreads_interactions.csv",
        "size_approx": "4.0 GB",
        "description": "User-book interactions (229M rows)",
    },
    "reviews": {
        "url": f"{BASE_URL}/goodreads_reviews_dedup.json.gz",
        "filename": "goodreads_reviews_dedup.json.gz",
        "size_approx": "5.0 GB",
        "description": "Detailed reviews with text (15.7M)",
    },
    "genres": {
        "url": f"{BASE_URL}/goodreads_book_genres_initial.json.gz",
        "filename": "goodreads_book_genres_initial.json.gz",
        "size_approx": "23 MB",
        "description": "Genre tags per book",
    },
    "authors": {
        "url": f"{BASE_URL}/goodreads_book_authors.json.gz",
        "filename": "goodreads_book_authors.json.gz",
        "size_approx": "17 MB",
        "description": "Author metadata",
    },
    "book_id_map": {
        "url": f"{BASE_URL}/book_id_map.csv",
        "filename": "book_id_map.csv",
        "size_approx": "36 MB",
        "description": "Book ID mapping",
    },
    "user_id_map": {
        "url": f"{BASE_URL}/user_id_map.csv",
        "filename": "user_id_map.csv",
        "size_approx": "33 MB",
        "description": "User ID mapping",
    },
}

# Core files (downloaded by default)
CORE_KEYS = ["books", "interactions", "reviews", "genres", "authors",
             "book_id_map", "user_id_map"]


def sizeof_fmt(num_bytes):
    """Human-readable file size."""
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if abs(num_bytes) < 1024.0:
            return f"{num_bytes:.1f} {unit}"
        num_bytes /= 1024.0
    return f"{num_bytes:.1f} PB"


def download_file(url, dest_path, chunk_size=1024 * 1024):
    """
    Download a file with progress bar and resume support.

    Uses HTTP Range headers to resume partial downloads.
    """
    dest = Path(dest_path)
    dest.parent.mkdir(parents=True, exist_ok=True)

    # Check for partial download
    existing_size = 0
    if dest.exists():
        existing_size = dest.stat().st_size

    # Build request with resume support
    req = urllib.request.Request(url)
    if existing_size > 0:
        req.add_header("Range", f"bytes={existing_size}-")

    try:
        response = urllib.request.urlopen(req)
    except urllib.error.HTTPError as e:
        if e.code == 416:
            # Range not satisfiable → file already complete
            print(f"  ✓ Already complete ({sizeof_fmt(existing_size)})")
            return True
        raise

    # Determine total size
    content_length = response.headers.get("Content-Length")
    if content_length:
        remaining = int(content_length)
        total_size = existing_size + remaining
    else:
        remaining = None
        total_size = None

    # Check if server supports resume
    if existing_size > 0 and response.status == 206:
        mode = "ab"  # append
        print(f"  Resuming from {sizeof_fmt(existing_size)} …")
    elif existing_size > 0 and response.status == 200:
        mode = "wb"  # server doesn't support Range → restart
        existing_size = 0
        total_size = int(content_length) if content_length else None
        print(f"  Server doesn't support resume — restarting …")
    else:
        mode = "wb"

    downloaded = existing_size
    start_time = time.time()

    try:
        with open(dest, mode) as f:
            while True:
                chunk = response.read(chunk_size)
                if not chunk:
                    break
                f.write(chunk)
                downloaded += len(chunk)

                # Progress bar
                elapsed = time.time() - start_time
                speed = (downloaded - existing_size) / max(elapsed, 0.001)

                if total_size:
                    pct = downloaded / total_size * 100
                    bar_len = 30
                    filled = int(bar_len * downloaded / total_size)
                    bar = "█" * filled + "░" * (bar_len - filled)
                    eta = (total_size - downloaded) / max(speed, 1)
                    sys.stdout.write(
                        f"\r  {bar} {pct:5.1f}%  "
                        f"{sizeof_fmt(downloaded)}/{sizeof_fmt(total_size)}  "
                        f"{sizeof_fmt(speed)}/s  ETA {int(eta)}s   "
                    )
                else:
                    sys.stdout.write(
                        f"\r  {sizeof_fmt(downloaded)} downloaded  "
                        f"{sizeof_fmt(speed)}/s   "
                    )
                sys.stdout.flush()

        print()  # newline after progress bar
        return True

    except (KeyboardInterrupt, Exception) as e:
        print(f"\n  ⚠ Download interrupted: {e}")
        print(f"    Saved {sizeof_fmt(downloaded)} — run again to resume.")
        return False


def check_files(data_dir):
    """Print status of all expected files."""
    print(f"\nFile status in {data_dir}/:\n")
    print(f"  {'File':<45} {'Expected':>10} {'Actual':>12} {'Status'}")
    print(f"  {'─'*45} {'─'*10} {'─'*12} {'─'*10}")

    for key in CORE_KEYS:
        info = FILES[key]
        path = data_dir / info["filename"]
        expected = info["size_approx"]
        if path.exists():
            actual = sizeof_fmt(path.stat().st_size)
            status = "✓ exists"
        else:
            actual = "—"
            status = "✗ missing"
        print(f"  {info['filename']:<45} {expected:>10} {actual:>12} {status}")

    print()


def main():
    parser = argparse.ArgumentParser(
        description="Download the UCSD Book Graph (full dataset).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--dir", default="data", help="Output directory (default: data/)"
    )
    parser.add_argument(
        "--only", nargs="+", choices=list(FILES.keys()),
        help="Download only specific files (e.g., --only books genres)"
    )
    parser.add_argument(
        "--check", action="store_true",
        help="Only check which files exist, don't download"
    )
    args = parser.parse_args()

    data_dir = Path(args.dir)
    data_dir.mkdir(parents=True, exist_ok=True)

    if args.check:
        check_files(data_dir)
        return

    keys_to_download = args.only if args.only else CORE_KEYS

    print("=" * 65)
    print("  UCSD Book Graph — Full Dataset Downloader")
    print("=" * 65)
    print(f"\n  Output directory: {data_dir.resolve()}")
    print(f"  Files to download: {len(keys_to_download)}")
    print()

    for key in keys_to_download:
        info = FILES[key]
        dest = data_dir / info["filename"]

        print(f"[{key}] {info['description']}")
        print(f"  File: {info['filename']}  (~{info['size_approx']})")
        print(f"  URL:  {info['url']}")

        # Skip if already exists and looks complete
        if dest.exists():
            size = dest.stat().st_size
            print(f"  Found existing file: {sizeof_fmt(size)}")

            # Rough completeness check — if file is > 90% of expected, consider done
            # (We can't know exact size without a HEAD request)
            response = "y"
            if size > 1_000_000:  # > 1MB means it's probably a real download
                print(f"  → File exists. Skipping. (Delete to re-download.)")
                print()
                continue

        success = download_file(info["url"], dest)
        if success:
            final_size = sizeof_fmt(dest.stat().st_size)
            print(f"  ✓ Done — {final_size}")
        print()

    print("=" * 65)
    print("  Download complete!")
    print("=" * 65)
    check_files(data_dir)


if __name__ == "__main__":
    main()
