# What 15 Million Readers Reveal About the Human Condition

> A narrative-driven data visualization exploring collective mood, reading psychology, and cultural aspiration through the UCSD Book Graph.

| Student's name           | SCIPER |
|--------------------------|--------|
| Galanopoulou Rafaila     | 388285 |
| Migliorelli Claudio      | 406790 |
| Poupakis Alexandros      | 387587 |

🌐 **Website:** [https://migliio.github.io/super-secret-dataviz-carpa/](https://migliio.github.io/super-secret-dataviz-carpa/)

---

## Project Structure

```
├── website/              # Interactive visualization (D3.js + Scrollama)
│   ├── index.html
│   ├── css/style.css
│   ├── data/             # Preprocessed JSON files (<50 KB total)
│   └── js/               # config.js, streamgraph.js, drift.js, aspiration.js, main.js
├── doc/                  # Milestone reports
│   ├── milestone2_report.tex
│   ├── milestone2_report.pdf
│   └── Makefile          # make / make clean / make distclean
├── src/                  # Python modules for data analysis
│   ├── data_loading.py   # File paths, loaders, genre mapping
│   ├── analysis.py       # Interaction scanning, rating stats, temporal analysis
│   └── plotting.py       # Matplotlib/seaborn chart functions
├── data/                 # UCSD Book Graph data files (~11 GB, not committed)
├── download_data.py      # Script to download the full dataset
├── preprocess_for_website.py  # Generates website/data/*.json from raw data
└── eda_ucsd_book_graph.ipynb  # EDA notebook (imports from src/)
```

## Quick Start

```bash
# Download data (~11 GB)
python download_data.py

# Run EDA notebook
jupyter notebook eda_ucsd_book_graph.ipynb

# Serve the website locally
cd website && python3 -m http.server 8765
# Open http://localhost:8765
```

---

[Milestone 1](#milestone-1) • [Milestone 2](#milestone-2) • [Milestone 3](#milestone-3)

## Milestone 1 (20th March, 5pm)

### Dataset

Our primary data source is the **UCSD Book Graph**, one of the largest publicly available academic datasets on book readership. The dataset was collected from Goodreads in late 2017 and made available for academic use. It comprises three interconnected components:

1. **Book metadata**---detailed records for approximately 2.36 million books (spanning 1.52 million distinct works, 400,390 series, and 829,529 authors), stored as compressed JSON. Fields include title, author, description, publisher, publication year, page count, language, ISBN, and average rating. Genre tags are extracted from user-curated shelves via keyword matching, provided in a separate genre-mapping file.

2. **User–book interactions**---roughly 229 million shelf-level interactions from 876,145 users. Each row encodes a user ID, book ID, read status, rating (0–5), and whether a textual review was left. Of these, approximately 112 million are confirmed reads and 104 million include a numerical rating.

3. **Detailed review texts**---over 15.7 million full-text reviews covering ~2 million books and 465,000 users. Each review contains the user ID, book ID, rating, timestamp, and the complete review body in its original language.

**Data quality and preprocessing.** The UCSD dataset is well-maintained: duplicates and mismatches were cleaned in an update. The maintainers provide Jupyter notebooks demonstrating loading and basic exploration. Nonetheless, several preprocessing steps are required: (a) decompressing and parsing the large JSON/CSV files into a queryable format; (b) resolving the genre tags, which are noisy shelf-derived labels that require consolidation into a manageable taxonomy (~15–20 macro-genres); (c) handling missing values in publication year and page count; (d) filtering out non-English reviews for the sentiment analysis components; and (e) constructing per-user temporal reading sequences by ordering interactions by timestamp.

<!-- > Find a dataset (or multiple) that you will explore. Assess the quality of the data it contains and how much preprocessing / data-cleaning it will require before tackling visualization. We recommend using a standard dataset as this course is not about scraping nor data processing. -->
<!-- > -->
<!-- > Hint: some good pointers for finding quality publicly available datasets ([Google dataset search](https://datasetsearch.research.google.com/), [Kaggle](https://www.kaggle.com/datasets), [OpenSwissData](https://opendata.swiss/en/), [SNAP](https://snap.stanford.edu/data/) and [FiveThirtyEight](https://data.fivethirtyeight.com/)). -->

### Problematic

**Central question:** Can large-scale reading behavior reveal shifts in collective human psychology---such as rising anxiety, escapism, or identity searching---and can we make these shifts visible and tangible through interactive visualization?
 
**Motivation.** A book rating is a uniquely honest data point. Unlike a social media reaction, reading a novel is a slow, private, deliberate act: nobody finishes a 400-page book for algorithmic visibility. This makes reader-generated data an unusually clean signal of genuine human preference and emotional state. When millions of such signals are aggregated over time, patterns emerge that reflect something deeper than taste---they trace the emotional and psychological currents of a population.
 
The evidence that reading behavior responds to real-world events is already striking. After the 2016 U.S. presidential election, dystopian fiction sales surged dramatically---Orwell's *1984* famously climbed bestseller lists. After the 2024 election, Amazon reported that Atwood's *The Handmaid's Tale* saw ~ 6% spike in sales in a single day, while *1984* rose 250% and *Fahrenheit 451* jumped 300%. These are not anomalies; they are measurable psychological responses encoded in purchasing and rating data.
 
We plan to develop the visualization along three concrete axes: 
- **Collective mood tracking**: mapping how the genre composition of highly-rated books evolves over time, overlaid with major world events (elections, pandemics, economic crises), to test whether genre preference shifts correlate with periods of collective anxiety or optimism.
- **Reader psychology over time**: tracking whether individual users become harsher or more generous raters as they read more books (rating drift), and whether high-volume readers differ systematically from occasional readers in their genre preferences and evaluations.
- **Aspiration vs. reality**: comparing books that are heavily shelved as "want to read" but have low actual read-through rates---revealing which genres and themes are aspirationally hoarded but rarely consumed.
 
The visualization is aimed at a general audience curious about the intersection of culture, psychology, and data. The design will prioritize narrative-driven, scrollytelling-style presentation that makes the data accessible without requiring statistical literacy.

<!-- > Frame the general topic of your visualization and the main axis that you want to develop. -->
<!-- > - What am I trying to show with my visualization? -->
<!-- > - Think of an overview for the project, your motivation, and the target audience. -->

### Exploratory Data Analysis

We loaded and profiled the full UCSD Book Graph dataset. Below are our key findings.

**Scale.** The complete dataset contains 2,360,655 books, 229,154,523 user–book interactions (from 876,145 users), and 15,745,872 detailed reviews with full text. Of the interactions, 112.3M are confirmed reads and 104.7M include a numerical rating (1–5 stars). These figures come from the official dataset documentation and were confirmed by our chunked scan of the full CSV.

**Rating distribution.** Ratings skew positive: 4-star and 5-star ratings together account for the majority of all scores, consistent with the well-known Goodreads survivorship bias (users mostly rate books they finish). The overall mean rating is approximately 3.85. Books with very few ratings show high variance, so we apply a minimum threshold of 30 ratings for book-level analyses.

**Genre coverage.** The dataset provides genre subsets of unequal size. Romance (658K books, 2M interactions) and Fantasy & Paranormal (538K books, 6M interactions) dominate, while Poetry (88.6K books, 2M interactions) is far smaller. This imbalance requires normalization when comparing genre trends.

**Temporal span.** Review timestamps range from the early 2000s through late 2017, with review volume growing steeply from ~2007 onward, mirroring Goodreads' user growth. Data before 2010 is sparse; our primary analysis window will be 2010–2017.

**User activity.** Activity follows a heavy-tailed distribution: a small fraction of power users generate a disproportionate share of ratings. For longitudinal analyses like rating drift, we focus on users with at least 30 rated books.

**Preprocessing completed:**
- Parsed full book metadata (2.36M records) with type coercion and year validation.
- Built a consolidated genre taxonomy from shelf-derived tags.
- Profiled missing values (publication year, page count, language code).

The full EDA notebook is provided alongside this report.

<!-- > Pre-processing of the data set you chose -->
<!-- > - Show some basic statistics and get insights about the data -->

### Related work

**Academic literature on reading behavior and literary perception.**
The most directly relevant academic project is *The Riddle of Literary Quality* (2017–2020), a Dutch research initiative that conducted a large national reader survey to understand what makes novels "literary". Their key finding was that readers show strong consensus on literary quality ratings, influenced by both textual features (style, vocabulary) and social factors (genre prestige, author gender).
 
**Emotional contagion and collective mood research.**
Brady et al. (2017), published in *PNAS*, demonstrated that moral-emotional language drives the diffusion of political content on social networks, coining the term "moral contagion". Their analysis of 563,312 tweets showed that each moral-emotional word increased message diffusion by roughly 20%. Earlier, Kramer et al. (2014) conducted the controversial Facebook emotional contagion experiment, providing experimental evidence that emotional states transfer through text-based digital communication at massive scale.
 
**Data journalism and visualization work.**
The Pudding (pudding.cool) is our primary visual inspiration. Their editorial approach---visual essays that combine rigorous data analysis with narrative-driven scrollytelling and bespoke interactive graphics---is the gold standard we aim to emulate.
Within the Goodreads data space specifically, existing work is predominantly descriptive. Our project goes beyond description by asking *why* patterns occur and whether they correlate with external events.
 
**How our approach is original.**
Our project occupies a novel intersection: it applies the *scale* of the UCSD Book Graph (15M+ reviews, 229M interactions) to questions typically asked at *survey scale* in literary studies, while presenting the findings through the *visual storytelling vocabulary* of publications like The Pudding---and doing so with a specific focus on temporal-psychological phenomena.

<!-- > - What others have already done with the data? -->
<!-- > - Why is your approach original? -->
<!-- > - What source of inspiration do you take? Visualizations that you found on other websites or magazines (might be unrelated to your data). -->
<!-- > - In case you are using a dataset that you have already explored in another context (ML or ADA course, semester project...), you are required to share the report of that work to outline the differences with the submission for this class. -->

## Milestone 2 (1st May, 5pm)

**10% of the final grade**

📄 **Full report:** [`doc/milestone2_report.pdf`](doc/milestone2_report.pdf) (2-page LaTeX document)

To rebuild the report:
```bash
cd doc && make        # builds the PDF
cd doc && make clean  # removes build artifacts
```

### Summary

We want to build a scrollytelling website that tells a story about how people read. The idea is simple: take a massive dataset of reading behavior and turn it into something anyone can explore and understand — no statistics background needed.

Our data source is the UCSD Book Graph (2.36M books, 229M interactions, 15.7M reviews). We ask three questions:

1. **Does the world shape what we read?** How genre popularity shifts over time and whether those shifts line up with real-world events.
2. **Do readers get pickier over time?** How average ratings change as people read more books.
3. **Do we read what we say we want to read?** How often genres get shelved as "to-read" versus actually read.

The style is inspired by data journalism sites like *The Pudding*.

**Prototype status:** All five visualizations are implemented and functional with **real preprocessed data** (sampled ~10% of the full dataset, aggregated into <50 KB of JSON). Visual themes (colors, typography, layout) may evolve before the final submission.

**Core (MVP):** scrollytelling skeleton, genre streamgraph with event annotations, rating drift line chart, aspiration diverging bars, animated stat counters, offline data pipeline.

**Nice to have:** sentiment word clouds (W9), user journey explorer (W5), book similarity network (W10), animated time-lapse (W4), geographic heatmap (W8).

**Data processing at scale:** the website loads tiny pre-aggregated JSON, so it's always fast. The offline preprocessing currently samples ~10% and runs in ~3 minutes. For the full dataset we're considering: (a) switching to DuckDB/Polars for 5–10× speedup, (b) converting to Parquet for near-instant queries, or (c) increasing the sample to 50%+.

**TODO:** deploy to GitHub Pages.

<!-- OLD Milestone 2 text:
**Prototype status:** All five visualizations are implemented and functional with **mock data**. The prototype is deployed via GitHub Pages. Visual themes (colors, typography, layout) may evolve before the final submission.

**Core (MVP):** scrollytelling skeleton, genre streamgraph with event annotations, rating drift line chart, aspiration diverging bars, animated stat counters, real data pipeline.

**Enhancements (stretch goals):** sentiment word clouds, user journey explorer, book similarity network, animated time-lapse, geographic heatmap.

### GitHub Pages Setup

To deploy the website:
1. Go to **Settings → Pages** in the repository
2. Under **Source**, select **Deploy from a branch**
3. Choose **`main`** branch and **`/website`** folder (if available) or use **`/ (root)`** and symlink
4. Alternatively, use the **`gh-pages`** branch: copy `website/` contents to root of a `gh-pages` branch
-->

## Milestone 3 (29th May, 5pm)

**80% of the final grade**


## Late policy

- < 24h: 80% of the grade for the milestone
- < 48h: 70% of the grade for the milestone
