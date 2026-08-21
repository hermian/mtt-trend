import {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  PrimitivePaneViewZOrder,
  Time,
  IChartApi,
  ISeriesApi,
  SeriesType,
} from "lightweight-charts";

export interface CanvasRenderingTarget2D {
  useMediaCoordinateSpace(cb: (scope: { context: CanvasRenderingContext2D; mediaSize: { width: number; height: number } }) => void): void;
  useBitmapCoordinateSpace?(cb: (scope: { context: CanvasRenderingContext2D; bitmapSize: { width: number; height: number } }) => void): void;
}

export interface SupertrendBandItem {
  time: string;
  price: number;
  supertrend: number;
  trend: 1 | -1;
}

class SupertrendBandPaneRenderer implements IPrimitivePaneRenderer {
  private _data: SupertrendBandItem[];
  private _chart: IChartApi | null;
  private _series: ISeriesApi<SeriesType, Time> | null;
  private _visible: boolean;

  constructor(
    data: SupertrendBandItem[],
    chart: IChartApi | null,
    series: ISeriesApi<SeriesType, Time> | null,
    visible: boolean
  ) {
    this._data = data;
    this._chart = chart;
    this._series = series;
    this._visible = visible;
  }

  draw(target: CanvasRenderingTarget2D): void {
    if (!this._visible || !this._chart || !this._series || this._data.length < 2) return;

    target.useMediaCoordinateSpace(({ context: ctx }) => {
      const timeScale = this._chart!.timeScale();
      const series = this._series!;

      // Group into contiguous segments by trend
      let currentTrend: 1 | -1 | null = null;
      let segment: { x: number; yPrice: number; ySt: number }[] = [];

      const flushSegment = () => {
        if (segment.length < 2 || currentTrend === null) {
          segment = [];
          return;
        }

        ctx.save();
        ctx.beginPath();

        // 1. Move along price path forward
        ctx.moveTo(segment[0].x, segment[0].yPrice);
        for (let i = 1; i < segment.length; i++) {
          ctx.lineTo(segment[i].x, segment[i].yPrice);
        }

        // 2. Line along supertrend path backward
        for (let i = segment.length - 1; i >= 0; i--) {
          ctx.lineTo(segment[i].x, segment[i].ySt);
        }

        ctx.closePath();
        ctx.fillStyle =
          currentTrend === 1
            ? "rgba(16, 185, 129, 0.28)" // Bullish clear soft green fill
            : "rgba(239, 68, 68, 0.28)"; // Bearish clear soft red fill
        ctx.fill();
        ctx.restore();

        segment = [];
      };

      for (let i = 0; i < this._data.length; i++) {
        const item = this._data[i];
        const x = timeScale.timeToCoordinate(item.time as unknown as Time);
        if (x === null) {
          flushSegment();
          currentTrend = null;
          continue;
        }

        const yPrice = series.priceToCoordinate(item.price);
        const ySt = series.priceToCoordinate(item.supertrend);

        if (yPrice === null || ySt === null) {
          flushSegment();
          currentTrend = null;
          continue;
        }

        if (currentTrend !== item.trend) {
          if (segment.length > 0) {
            segment.push({ x, yPrice, ySt });
            flushSegment();
          }
          currentTrend = item.trend;
        }

        segment.push({ x, yPrice, ySt });
      }

      flushSegment();
    });
  }
}

class SupertrendBandPaneView implements IPrimitivePaneView {
  private _source: SupertrendBandPrimitive;

  constructor(source: SupertrendBandPrimitive) {
    this._source = source;
  }

  zOrder(): PrimitivePaneViewZOrder {
    return "bottom"; // Draw behind candlesticks and lines
  }

  renderer(): IPrimitivePaneRenderer | null {
    return new SupertrendBandPaneRenderer(
      this._source.data,
      this._source.chart,
      this._source.series,
      this._source.visible
    );
  }
}

export class SupertrendBandPrimitive implements ISeriesPrimitive<Time> {
  private _data: SupertrendBandItem[] = [];
  private _visible: boolean = false;
  private _chart: IChartApi | null = null;
  private _series: ISeriesApi<SeriesType, Time> | null = null;
  private _requestUpdate: (() => void) | null = null;
  private _paneViews: SupertrendBandPaneView[];

  constructor() {
    this._paneViews = [new SupertrendBandPaneView(this)];
  }

  get data(): SupertrendBandItem[] {
    return this._data;
  }

  get visible(): boolean {
    return this._visible;
  }

  get chart(): IChartApi | null {
    return this._chart;
  }

  get series(): ISeriesApi<SeriesType, Time> | null {
    return this._series;
  }

  setData(data: SupertrendBandItem[]): void {
    this._data = data;
    this.requestUpdate();
  }

  setVisible(visible: boolean): void {
    this._visible = visible;
    this.requestUpdate();
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this._chart = param.chart;
    this._series = param.series;
    this._requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this._paneViews;
  }

  updateAllViews(): void {
    // Views are updated on draw
  }

  private requestUpdate(): void {
    if (this._requestUpdate) {
      this._requestUpdate();
    }
  }
}
