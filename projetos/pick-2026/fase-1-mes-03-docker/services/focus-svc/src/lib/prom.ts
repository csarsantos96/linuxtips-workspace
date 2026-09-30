// Coletor mínimo de métricas Prometheus (sem dependência externa).
// Suporta counters e histograms; gera o texto no formato de exposição 0.0.4.

type Labels = Record<string, string>;

function labelKey(labels: Labels): string {
  const keys = Object.keys(labels).sort();
  return keys.map((k) => `${k}=${labels[k]}`).join(",");
}

function renderLabels(labels: Labels): string {
  const keys = Object.keys(labels).sort();
  if (keys.length === 0) return "";
  const parts = keys.map((k) => `${k}="${escapeLabel(labels[k])}"`);
  return `{${parts.join(",")}}`;
}

function escapeLabel(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

class Counter {
  readonly name: string;
  readonly help: string;
  readonly values = new Map<string, { labels: Labels; value: number }>();
  constructor(name: string, help: string) {
    this.name = name;
    this.help = help;
  }
  inc(labels: Labels = {}, value = 1) {
    const k = labelKey(labels);
    const cur = this.values.get(k);
    if (cur) cur.value += value;
    else this.values.set(k, { labels, value });
  }
  render(): string {
    let out = `# HELP ${this.name} ${this.help}\n# TYPE ${this.name} counter\n`;
    for (const { labels, value } of this.values.values()) {
      out += `${this.name}${renderLabels(labels)} ${value}\n`;
    }
    return out;
  }
}

class Histogram {
  readonly name: string;
  readonly help: string;
  readonly buckets: number[];
  readonly series = new Map<
    string,
    { labels: Labels; counts: number[]; sum: number; count: number }
  >();
  constructor(name: string, help: string, buckets: number[]) {
    this.name = name;
    this.help = help;
    this.buckets = buckets;
  }
  observe(labels: Labels, value: number) {
    const k = labelKey(labels);
    let s = this.series.get(k);
    if (!s) {
      s = { labels, counts: new Array(this.buckets.length).fill(0), sum: 0, count: 0 };
      this.series.set(k, s);
    }
    s.sum += value;
    s.count += 1;
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]) s.counts[i] += 1;
    }
  }
  render(): string {
    let out = `# HELP ${this.name} ${this.help}\n# TYPE ${this.name} histogram\n`;
    for (const s of this.series.values()) {
      for (let i = 0; i < this.buckets.length; i++) {
        const lbl = { ...s.labels, le: String(this.buckets[i]) };
        out += `${this.name}_bucket${renderLabels(lbl)} ${s.counts[i]}\n`;
      }
      const lblInf = { ...s.labels, le: "+Inf" };
      out += `${this.name}_bucket${renderLabels(lblInf)} ${s.count}\n`;
      out += `${this.name}_sum${renderLabels(s.labels)} ${s.sum}\n`;
      out += `${this.name}_count${renderLabels(s.labels)} ${s.count}\n`;
    }
    return out;
  }
}

export const httpRequestsTotal = new Counter(
  "http_requests_total",
  "Total HTTP requests",
);

export const httpRequestDurationSeconds = new Histogram(
  "http_request_duration_seconds",
  "HTTP request duration in seconds",
  [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
);

export const focusSessionDurationSeconds = new Histogram(
  "focus_session_duration_seconds",
  "Actual focus session duration (seconds)",
  [60, 300, 600, 1500, 1800, 2700, 3600, 7200],
);

export const focusSessionsTotal = new Counter(
  "focus_sessions_total",
  "Total focus sessions by status",
);

export function renderMetrics(): string {
  return [
    httpRequestsTotal.render(),
    httpRequestDurationSeconds.render(),
    focusSessionDurationSeconds.render(),
    focusSessionsTotal.render(),
  ].join("\n");
}
