# 02-Design: ETF Heatmap Dashboard (Issue #11)

## System Architecture

```
[ Frontend (Next.js) ]
       │  ▲
       │  │ (HTTP GET /api/etf/heatmap?market=KR)
       ▼  │
[ Backend (FastAPI) ]
       │
       ├─► Read config/etf_heatmap_layout.json
       └─► Query DB (~/.cache/db/rs_etf/ and etf_price.db)
```

## 1. Data Contract & API Specifications

### GET `/api/etf/heatmap`
* **Query Params**:
  * `market`: `KR` (default, currently only supporting Korean ETFs)
* **Response Body (JSON)**:
```json
{
  "market": "KR",
  "as_of_date": "2026-07-24",
  "indexes": [
    {
      "code": "KOSPI",
      "name": "KOSPI",
      "returns": {
        "1D": -1.2,
        "MTD": -3.4,
        "YTD": 5.1,
        "3M": -2.0,
        "6M": 4.5,
        "1Y": 12.3,
        "3Y": -5.6,
        "5Y": 10.4
      }
    }
  ],
  "groups": [
    {
      "category": "대표",
      "etfs": [
        {
          "code": "069500",
          "name": "KODEX 200",
          "returns": {
            "1D": -1.15,
            "MTD": -2.8,
            "YTD": 4.2
            // ...
          }
        }
      ]
    }
  ]
}
```

## 2. Backend Implementation Details
1. **Layout Parsing**: Backend reads `config/etf_heatmap_layout.json` at startup or requests.
2. **Data Integration**:
   - For `indexes`, read from `macro.db` index_ohlcv table (or calculate daily/monthly returns).
   - For `etfs`, use `settings.rs_store.read_rs_etf_date(latest_date)` to fetch MTD, YTD, 1W, 3M, 6M, 1Y etc.
   - For 3Y and 5Y long-term returns (which might not be in `rs_etf`'s current day schema), query `etf_price.db` to calculate cumulative returns using historical close prices.

## 3. Frontend Implementation Details
1. **Layout & Grid Components**:
   - Categories will render as block sections.
   - Cells within a category will render in a flexible grid layout (e.g., CSS grid / flex wrapping) to minimize layout shifts.
2. **Color Scale Mapping**:
   - A utility function `getColorForReturn(value: number, range: number)` maps positive values to green shades (`rgb(22, 101, 52)` at max intensity) and negative values to red shades (`rgb(153, 27, 27)` at max intensity).
   - Flat/zero values map to a neutral dark background (`rgb(31, 41, 55)` or gray).
3. **Tooltip Integration**:
   - Hovering over a cell triggers a floating tooltip containing the ticker code, name, and exact returns for all periods.
