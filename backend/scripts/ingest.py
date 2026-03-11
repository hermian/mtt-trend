"""
HTML parsing and SQLite ingestion CLI for 52-week high theme data.

Usage:
    # Ingest a single file
    python backend/scripts/ingest.py backend/data/★52Week_High_Stocks_By_Theme_With_RS_Scores_2024-01-15.html

    # Ingest all HTML files in backend/data/
    python backend/scripts/ingest.py

The script detects the date from the filename pattern:
    ★52Week_High_Stocks_By_Theme_With_RS_Scores_YYYY-MM-DD.html

HTML structure assumptions (flexible parser):
    - Theme sections are identified by headers (h1-h4, th, td with bold/large text)
    - Stock rows contain: name, RS score, change%
    - The parser tries multiple layout patterns used by common Korean stock report generators
"""

from __future__ import annotations

import argparse
import logging
import re
import sys
from pathlib import Path
from typing import Optional

# Allow running from either project root or backend/ directory
_SCRIPT_DIR = Path(__file__).resolve().parent          # backend/scripts/
_BACKEND_DIR = _SCRIPT_DIR.parent                      # backend/
_REPO_ROOT = _BACKEND_DIR.parent                       # project root

# Prefer running from backend/ so `app.*` imports work (same as uvicorn)
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from bs4 import BeautifulSoup, Tag
from sqlalchemy.orm import Session

from app.database import SessionLocal, create_tables
from app.models import ThemeDaily, ThemeStockDaily, SOURCE_52W, SOURCE_MTT

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Date extraction from filename
# ---------------------------------------------------------------------------

_DATE_RE = re.compile(r"(\d{4}-\d{2}-\d{2})")
_MTT_FILENAME_RE = re.compile(r"Themes_With.*MTT", re.IGNORECASE)


def extract_date_from_filename(path: Path) -> Optional[str]:
    """Extract YYYY-MM-DD from the file name."""
    m = _DATE_RE.search(path.name)
    return m.group(1) if m else None


def detect_source_from_filename(path: Path) -> str:
    """Detect data_source from filename: 'mtt' or '52w_high'."""
    if _MTT_FILENAME_RE.search(path.name):
        return SOURCE_MTT
    return SOURCE_52W


# ---------------------------------------------------------------------------
# HTML parser
# ---------------------------------------------------------------------------

def _clean_text(s: str) -> str:
    """Strip whitespace and zero-width characters."""
    return re.sub(r"[\u200b\u200c\u200d\ufeff\xa0]", " ", s).strip()


def _parse_number(s: str, is_float: bool = True):
    """Parse a number string that may contain commas, %, +/-."""
    if not s:
        return None
    cleaned = re.sub(r"[,\s%]", "", s)
    try:
        return float(cleaned) if is_float else int(cleaned)
    except ValueError:
        return None


def _parse_rs(s: str) -> Optional[int]:
    """Parse RS score as integer."""
    v = _parse_number(s, is_float=False)
    return int(v) if v is not None else None


def _parse_change(s: str) -> Optional[float]:
    """Parse change% as float (e.g. '+3.45%' -> 3.45)."""
    return _parse_number(s)


# ---------------------------------------------------------------------------
# Strategy 1: Table-based layout (most common in Korean reports)
# ---------------------------------------------------------------------------

def _try_table_layout(soup: BeautifulSoup) -> dict[str, list[dict]]:
    """
    Parse tables where each table has a caption or preceding header for the theme name,
    and rows contain: stock name | RS score | change%.
    Returns: {theme_name: [{"stock_name": ..., "rs_score": ..., "change_pct": ...}]}
    """
    themes: dict[str, list[dict]] = {}

    # Find all tables
    for table in soup.find_all("table"):
        theme_name = _find_theme_name_for_element(table)
        if not theme_name:
            continue

        rows = table.find_all("tr")
        stocks = []
        for row in rows:
            cells = [_clean_text(c.get_text()) for c in row.find_all(["td", "th"])]
            if len(cells) < 2:
                continue
            stock_name = cells[0]
            if not stock_name or _is_header_row(stock_name):
                continue

            rs_score = _parse_rs(cells[1]) if len(cells) > 1 else None
            change_pct = _parse_change(cells[2]) if len(cells) > 2 else None

            if stock_name and rs_score is not None:
                stocks.append({
                    "stock_name": stock_name,
                    "rs_score": rs_score,
                    "change_pct": change_pct,
                })

        if stocks:
            if theme_name in themes:
                themes[theme_name].extend(stocks)
            else:
                themes[theme_name] = stocks

    return themes


def _find_theme_name_for_element(element: Tag) -> Optional[str]:
    """
    Look for a theme name near a given element:
    1. Caption inside the element
    2. Preceding sibling headers (h1-h5, strong, b)
    3. Parent heading text
    """
    # 1. Caption
    caption = element.find("caption")
    if caption:
        name = _clean_text(caption.get_text())
        if name:
            return name

    # 2. Preceding siblings
    for sibling in element.find_previous_siblings():
        if sibling.name in ("h1", "h2", "h3", "h4", "h5", "h6"):
            name = _clean_text(sibling.get_text())
            if name and len(name) <= 80:
                return name
        # Some reports wrap theme name in <p><strong>Name</strong></p>
        if sibling.name in ("p", "div"):
            bold = sibling.find(["strong", "b"])
            if bold:
                name = _clean_text(bold.get_text())
                if name and len(name) <= 80:
                    return name
            # Plain paragraph acting as header
            text = _clean_text(sibling.get_text())
            if text and len(text) <= 80 and not re.search(r"\d{4}-\d{2}-\d{2}", text):
                return text
        break  # Only look at the immediately preceding sibling

    return None


def _is_header_row(text: str) -> bool:
    """Detect header-like text such as '종목명', '종목', 'Stock', 'RS' etc."""
    header_keywords = {"종목명", "종목", "stock", "name", "rs", "rs score", "변동률", "등락률", "change"}
    return text.lower() in header_keywords


# ---------------------------------------------------------------------------
# Strategy 2: Heading + list / div layout
# ---------------------------------------------------------------------------

def _try_heading_layout(soup: BeautifulSoup) -> dict[str, list[dict]]:
    """
    Parse documents where themes are demarcated by headings and stocks appear
    in following <ul>/<ol>/<div> elements or plain text rows.
    """
    themes: dict[str, list[dict]] = {}
    headings = soup.find_all(["h1", "h2", "h3", "h4", "h5"])

    for heading in headings:
        theme_name = _clean_text(heading.get_text())
        if not theme_name or len(theme_name) > 100:
            continue

        stocks = []
        # Gather content until next heading of the same or higher level
        for sibling in heading.find_next_siblings():
            if sibling.name in ("h1", "h2", "h3", "h4", "h5"):
                break
            if sibling.name in ("ul", "ol"):
                for li in sibling.find_all("li"):
                    entry = _parse_stock_line(_clean_text(li.get_text()))
                    if entry:
                        stocks.append(entry)
            elif sibling.name == "table":
                # Delegate to table parser for this table
                sub = _try_table_layout(BeautifulSoup(str(sibling), "html.parser"))
                for sub_stocks in sub.values():
                    stocks.extend(sub_stocks)
                break
            else:
                # Try to extract from plain text lines
                for line in sibling.get_text("\n").splitlines():
                    entry = _parse_stock_line(_clean_text(line))
                    if entry:
                        stocks.append(entry)

        if stocks:
            if theme_name in themes:
                themes[theme_name].extend(stocks)
            else:
                themes[theme_name] = stocks

    return themes


_STOCK_LINE_RE = re.compile(
    r"^(?P<name>[가-힣A-Za-z0-9\s\.\-\&]+?)\s+"
    r"(?P<rs>\d{1,3})\s+"
    r"(?P<change>[+\-]?\d+(?:\.\d+)?)"
)


def _parse_stock_line(line: str) -> Optional[dict]:
    """
    Try to extract (stock_name, rs_score, change_pct) from a free-form text line.
    Expected format roughly: '삼성전자  98  +2.35'
    """
    m = _STOCK_LINE_RE.match(line)
    if m:
        return {
            "stock_name": m.group("name").strip(),
            "rs_score": int(m.group("rs")),
            "change_pct": float(m.group("change")),
        }
    return None


# ---------------------------------------------------------------------------
# Strategy 3: Flat table – theme in first column
# ---------------------------------------------------------------------------

def _try_flat_table_layout(soup: BeautifulSoup) -> dict[str, list[dict]]:
    """
    Some reports use a single flat table with columns:
      테마명 | 종목명 | RS | 등락률
    """
    themes: dict[str, list[dict]] = {}

    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if not rows:
            continue

        # Detect column layout from header row
        header_cells = [_clean_text(c.get_text()).lower() for c in rows[0].find_all(["th", "td"])]
        if len(header_cells) < 3:
            continue

        # Map column indices
        try:
            theme_col = next(i for i, h in enumerate(header_cells) if "테마" in h or "theme" in h)
            stock_col = next(i for i, h in enumerate(header_cells) if "종목" in h or "stock" in h or "name" in h)
            rs_col = next(i for i, h in enumerate(header_cells) if "rs" in h)
        except StopIteration:
            continue

        change_col: Optional[int] = None
        for i, h in enumerate(header_cells):
            if "변동" in h or "등락" in h or "change" in h or "%" in h:
                change_col = i
                break

        for row in rows[1:]:
            cells = [_clean_text(c.get_text()) for c in row.find_all(["td", "th"])]
            if len(cells) <= max(theme_col, stock_col, rs_col):
                continue

            theme_name = cells[theme_col]
            stock_name = cells[stock_col]
            rs_score = _parse_rs(cells[rs_col])
            change_pct = _parse_change(cells[change_col]) if change_col is not None and change_col < len(cells) else None

            if not theme_name or not stock_name or rs_score is None:
                continue

            entry = {"stock_name": stock_name, "rs_score": rs_score, "change_pct": change_pct}
            themes.setdefault(theme_name, []).append(entry)

    return themes


# ---------------------------------------------------------------------------
# Strategy 4: MTT format parser
# Columns: 테마명 | 테마내 종목수 | RS 평균 | 상위 7종목 (RS 점수) | 등락률 합계 | 거래대금 합계
# Stock tag format: "종목명(RS/등락률%),종목명(RS/등락률%),..."
# ---------------------------------------------------------------------------

_MTT_STOCK_RE = re.compile(
    r"([가-힣A-Za-z0-9\s\.\-\&]+?)"   # stock name
    r"\((\d{1,3})"                      # RS score
    r"/([+\-]?\d+(?:\.\d+)?)%\)"        # change pct
)


def _parse_mtt_stock_tag(tag_text: str) -> list[dict]:
    """Parse MTT stock cell: 'StockA(RS/chg%),StockB(RS/chg%)'."""
    stocks = []
    for m in _MTT_STOCK_RE.finditer(tag_text):
        stocks.append({
            "stock_name": m.group(1).strip(),
            "rs_score": int(m.group(2)),
            "change_pct": float(m.group(3)),
        })
    return stocks


def _try_mtt_layout(soup: BeautifulSoup) -> dict[str, list[dict]]:
    """
    Parse MTT-format HTML.
    Expects a flat table with header row containing '테마명', 'RS 평균', '상위'.
    Returns: {theme_name: [stock_entries]}
    """
    themes: dict[str, list[dict]] = {}

    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if not rows:
            continue

        header_cells = [_clean_text(c.get_text()).lower() for c in rows[0].find_all(["th", "td"])]

        # Detect MTT table by header keywords
        if not any("테마" in h for h in header_cells):
            continue
        if not any("rs" in h or "상위" in h for h in header_cells):
            continue

        # Locate key columns
        theme_col: Optional[int] = None
        stock_col: Optional[int] = None
        rs_col: Optional[int] = None
        change_col: Optional[int] = None
        volume_col: Optional[int] = None

        for i, h in enumerate(header_cells):
            if "테마명" in h:
                theme_col = i
            elif ("상위" in h) and stock_col is None:
                # "상위 7종목" column – must have "상위" not just "종목"
                stock_col = i
            elif "rs" in h and "평균" in h and rs_col is None:
                rs_col = i
            elif ("등락" in h or "변동" in h) and change_col is None:
                change_col = i
            elif "거래" in h and volume_col is None:
                volume_col = i

        if theme_col is None or stock_col is None:
            continue

        for row in rows[1:]:
            cells = row.find_all(["td", "th"])
            if len(cells) <= max(filter(lambda x: x is not None, [theme_col, stock_col])):
                continue

            theme_name = _clean_text(cells[theme_col].get_text())
            if not theme_name:
                continue

            # Parse stock tags from the stock column
            stock_cell = cells[stock_col]
            stock_tags = stock_cell.find_all(class_="stock-tag")
            tag_text = " ".join(_clean_text(t.get_text()) for t in stock_tags) if stock_tags else _clean_text(stock_cell.get_text())
            stocks = _parse_mtt_stock_tag(tag_text)

            if stocks:
                themes.setdefault(theme_name, []).extend(stocks)

    return themes


# ---------------------------------------------------------------------------
# Master parser
# ---------------------------------------------------------------------------

def parse_html(html_content: str, source: str = SOURCE_52W) -> dict[str, list[dict]]:
    """
    Parse HTML and return {theme_name: [stock_entries]}.
    For MTT source, uses MTT-specific parser first.
    """
    soup = BeautifulSoup(html_content, "html.parser")

    results: dict[str, list[dict]] = {}

    # MTT files use a dedicated parser; try it first
    if source == SOURCE_MTT:
        strategies = (_try_mtt_layout, _try_flat_table_layout, _try_table_layout, _try_heading_layout)
    else:
        strategies = (_try_flat_table_layout, _try_table_layout, _try_heading_layout)

    for strategy_fn in strategies:
        parsed = strategy_fn(soup)
        for theme, stocks in parsed.items():
            if theme in results:
                # Merge, avoiding duplicates by stock name
                existing_names = {s["stock_name"] for s in results[theme]}
                for s in stocks:
                    if s["stock_name"] not in existing_names:
                        results[theme].append(s)
                        existing_names.add(s["stock_name"])
            else:
                results[theme] = stocks

    return results


# ---------------------------------------------------------------------------
# Aggregate calculation
# ---------------------------------------------------------------------------

def compute_aggregates(stocks: list[dict]) -> dict:
    """Compute theme-level aggregate statistics from stock entries."""
    valid_rs = [s["rs_score"] for s in stocks if s.get("rs_score") is not None]
    valid_change = [s["change_pct"] for s in stocks if s.get("change_pct") is not None]

    return {
        "stock_count": len(stocks),
        "avg_rs": round(sum(valid_rs) / len(valid_rs), 2) if valid_rs else None,
        "change_sum": round(sum(valid_change), 2) if valid_change else None,
        "volume_sum": None,  # Volume not available in current HTML format
    }


# ---------------------------------------------------------------------------
# Database ingestion
# ---------------------------------------------------------------------------

def ingest_file(file_path: Path, db: Session) -> tuple[int, int]:
    """
    Parse the HTML file and upsert data into SQLite.

    Returns:
        (themes_upserted, stocks_inserted)
    """
    date = extract_date_from_filename(file_path)
    if not date:
        raise ValueError(
            f"Cannot extract date from filename: {file_path.name}. "
            "Expected pattern containing YYYY-MM-DD."
        )

    source = detect_source_from_filename(file_path)
    logger.info("Parsing %s (date=%s, source=%s)", file_path.name, date, source)

    html_content = file_path.read_text(encoding="utf-8", errors="replace")
    themes_data = parse_html(html_content, source=source)

    if not themes_data:
        logger.warning("No theme data found in %s", file_path.name)
        return 0, 0

    themes_count = 0
    stocks_count = 0

    for theme_name, stocks in themes_data.items():
        if not stocks:
            continue

        agg = compute_aggregates(stocks)

        # Upsert theme_daily
        existing = (
            db.query(ThemeDaily)
            .filter(
                ThemeDaily.date == date,
                ThemeDaily.theme_name == theme_name,
                ThemeDaily.data_source == source,
            )
            .first()
        )
        if existing:
            existing.stock_count = agg["stock_count"]
            existing.avg_rs = agg["avg_rs"]
            existing.change_sum = agg["change_sum"]
            existing.volume_sum = agg["volume_sum"]
        else:
            db.add(
                ThemeDaily(
                    date=date,
                    theme_name=theme_name,
                    data_source=source,
                    stock_count=agg["stock_count"],
                    avg_rs=agg["avg_rs"],
                    change_sum=agg["change_sum"],
                    volume_sum=agg["volume_sum"],
                )
            )
        themes_count += 1

        # Insert stock entries (delete old ones for this date+theme+source first)
        db.query(ThemeStockDaily).filter(
            ThemeStockDaily.date == date,
            ThemeStockDaily.theme_name == theme_name,
            ThemeStockDaily.data_source == source,
        ).delete()

        for stock in stocks:
            db.add(
                ThemeStockDaily(
                    date=date,
                    theme_name=theme_name,
                    data_source=source,
                    stock_name=stock["stock_name"],
                    rs_score=stock.get("rs_score"),
                    change_pct=stock.get("change_pct"),
                )
            )
            stocks_count += 1

    db.commit()
    logger.info("Ingested %d themes, %d stocks for %s", themes_count, stocks_count, date)
    return themes_count, stocks_count


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Ingest 52-week high HTML reports into SQLite"
    )
    parser.add_argument(
        "files",
        nargs="*",
        help=(
            "HTML file(s) to ingest. "
            "If omitted, all .html files in backend/data/ are processed."
        ),
    )
    parser.add_argument(
        "--data-dir",
        default=None,
        help="Directory to scan when no files are specified (default: backend/data/)",
    )
    args = parser.parse_args()

    create_tables()

    if args.files:
        file_paths = [Path(f) for f in args.files]
    else:
        data_dir = Path(args.data_dir) if args.data_dir else Path(__file__).resolve().parent.parent / "data"
        file_paths = sorted(data_dir.glob("*.html"))
        if not file_paths:
            logger.warning("No HTML files found in %s", data_dir)
            return

    total_themes = 0
    total_stocks = 0
    errors = 0

    with SessionLocal() as db:
        for fp in file_paths:
            if not fp.exists():
                logger.error("File not found: %s", fp)
                errors += 1
                continue
            try:
                t, s = ingest_file(fp, db)
                total_themes += t
                total_stocks += s
            except Exception as exc:
                logger.error("Failed to ingest %s: %s", fp, exc)
                errors += 1

    logger.info(
        "Done. Total themes=%d, stocks=%d, errors=%d",
        total_themes, total_stocks, errors,
    )
    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
