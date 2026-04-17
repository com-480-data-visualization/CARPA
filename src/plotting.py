"""Plotting functions for the UCSD Book Graph EDA."""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import matplotlib.dates as mdates
import seaborn as sns

# ── Shared style ──────────────────────────────────────────────────────
COLORS_5 = ["#E74C3C", "#E67E22", "#F1C40F", "#2ECC71", "#27AE60"]
COLOR_PRIMARY = "#4A90D9"


def apply_style():
    """Apply the project's default matplotlib/seaborn style."""
    import warnings
    warnings.filterwarnings("ignore")
    sns.set_theme(style="whitegrid", palette="muted", font_scale=1.1)
    plt.rcParams.update({
        "figure.dpi": 120,
        "axes.titlesize": 14,
        "axes.labelsize": 12,
    })


def plot_rating_distribution(rating_counter, total_rated, mean_rating, high_pct):
    """Bar chart of rating distribution."""
    rating_series = pd.Series(rating_counter).sort_index()

    fig, ax = plt.subplots(figsize=(8, 5))
    bars = ax.bar(
        rating_series.index, rating_series.values,
        color=COLORS_5[:len(rating_series)], edgecolor="white", width=0.7,
    )
    ax.set_xlabel("Rating (stars)")
    ax.set_ylabel("Number of ratings")
    ax.set_title(
        f"Rating distribution across all {total_rated:,} ratings\n"
        f"Mean = {mean_rating:.2f}  |  4+5 stars = {high_pct:.1%}"
    )
    ax.set_xticks([1, 2, 3, 4, 5])
    for bar in bars:
        h = bar.get_height()
        ax.text(bar.get_x() + bar.get_width() / 2, h, f"{h:,.0f}",
                ha="center", va="bottom", fontsize=9)
    plt.tight_layout()
    return fig


def plot_genre_coverage(genre_book_counts, genre_interaction_counts, top_n=12):
    """Side-by-side bar charts of genre coverage by books and interactions."""
    top_genres = [
        g for g, _ in sorted(
            genre_interaction_counts.items(), key=lambda x: x[1], reverse=True
        )[:top_n]
    ]

    gdf = pd.DataFrame({
        "books": {g: genre_book_counts.get(g, 0) for g in top_genres},
        "interactions": {g: genre_interaction_counts[g] for g in top_genres},
    })

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    gdf["books"].sort_values().plot.barh(ax=axes[0], color=COLOR_PRIMARY, edgecolor="white")
    axes[0].set_xlabel("Number of books")
    axes[0].set_title("Books per genre")

    gdf["interactions"].sort_values().plot.barh(ax=axes[1], color="#E74C3C", edgecolor="white")
    axes[1].set_xlabel("Number of interactions")
    axes[1].set_title("Interactions per genre")

    plt.tight_layout()
    return fig


def plot_temporal_volume(rev_dates):
    """Monthly review volume line chart."""
    monthly = (
        rev_dates.set_index("date_added")
        .resample("ME")
        .size()
        .to_frame("reviews")
    )

    fig, ax = plt.subplots(figsize=(12, 4))
    ax.plot(monthly.index, monthly["reviews"], color=COLOR_PRIMARY, linewidth=1.5)
    ax.fill_between(monthly.index, monthly["reviews"], alpha=0.15, color=COLOR_PRIMARY)
    ax.set_title("Monthly review volume (sampled 2M reviews)")
    ax.set_ylabel("Reviews")
    ax.xaxis.set_major_locator(mdates.YearLocator())
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
    plt.tight_layout()
    return fig


def plot_user_activity(user_activity):
    """User activity: histogram + Lorenz curve."""
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    ax = axes[0]
    ax.hist(
        user_activity["n_interactions"].clip(upper=500),
        bins=100, color=COLOR_PRIMARY, edgecolor="white", alpha=0.85,
    )
    ax.set_xlabel("Interactions per user (clipped at 500)")
    ax.set_ylabel("Number of users (log scale)")
    ax.set_title("User activity — heavy-tailed distribution")
    ax.set_yscale("log")

    ax = axes[1]
    sorted_act = user_activity["n_interactions"].sort_values(ascending=False).values
    cumulative = np.cumsum(sorted_act) / sorted_act.sum()
    x_pct = np.arange(1, len(cumulative) + 1) / len(cumulative) * 100
    ax.plot(x_pct, cumulative * 100, color="#E74C3C", linewidth=2)
    ax.plot([0, 100], [0, 100], "--", color="#999", linewidth=1)
    ax.set_xlabel("% of users (ranked by activity)")
    ax.set_ylabel("% of total interactions")
    ax.set_title("Lorenz curve — concentration of activity")

    plt.tight_layout()
    return fig
