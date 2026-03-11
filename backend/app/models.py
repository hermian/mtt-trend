"""
SQLAlchemy ORM models for the 52-week high theme trend dashboard.

data_source values:
  '52w_high' - ★52Week_High_Stocks_By_Theme_With_RS_Scores_YYYY-MM-DD.html
  'mtt'      - ★Themes_With_7_or_More_MTT_Stocks-Top7_YYYY-MM-DD.html
"""

from sqlalchemy import Column, Integer, String, Float, UniqueConstraint, Index
from app.database import Base

SOURCE_52W = "52w_high"
SOURCE_MTT = "mtt"


class ThemeDaily(Base):
    """Aggregated daily statistics per theme."""

    __tablename__ = "theme_daily"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(String, nullable=False, index=True)
    theme_name = Column(String, nullable=False)
    data_source = Column(String, nullable=False, default=SOURCE_52W)
    stock_count = Column(Integer)
    avg_rs = Column(Float)
    change_sum = Column(Float)
    volume_sum = Column(Float)

    __table_args__ = (
        UniqueConstraint("date", "theme_name", "data_source", name="uq_theme_daily_date_name_src"),
        Index("idx_td_date", "date"),
        Index("idx_td_source", "data_source"),
    )

    def __repr__(self) -> str:
        return f"<ThemeDaily date={self.date} theme={self.theme_name} src={self.data_source} avg_rs={self.avg_rs}>"


class ThemeStockDaily(Base):
    """Daily stock-level entries per theme."""

    __tablename__ = "theme_stock_daily"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(String, nullable=False)
    theme_name = Column(String, nullable=False)
    stock_name = Column(String, nullable=False)
    data_source = Column(String, nullable=False, default=SOURCE_52W)
    rs_score = Column(Integer)
    change_pct = Column(Float)

    __table_args__ = (
        Index("idx_tsd_stock", "stock_name", "date"),
        Index("idx_tsd_theme_date", "theme_name", "date"),
        Index("idx_tsd_source", "data_source"),
    )

    def __repr__(self) -> str:
        return (
            f"<ThemeStockDaily date={self.date} theme={self.theme_name} "
            f"stock={self.stock_name} rs={self.rs_score} src={self.data_source}>"
        )
