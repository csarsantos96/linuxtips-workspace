// Coletor mínimo de métricas Prometheus.

type Labels = Record<string, string>;

function labelKey(labels: Labels): string {
  const keys = Object.keys(labels).sort();
  return keys.map((k) => `${k}=${labels[k]}`).join(",");
}
function renderLabels(labels: Labels): string {
  const keys = Object.keys(labels).sort();
  if (keys.length === 0) return "";
  return `{${keys.map((k) => `${k}="${esc(labels[k])}"`).join(",")}}`;
}
function esc(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

class Counter {
  values = new Map<string, { labels: Labels; value: number }>();
  constructor(public name: string, public help: string) {}
  inc(labels: Labels = {}, value = 1) {
    const k = labelKey(labels);
    const c = this.values.get(k);
    if (c) c.value += value;
    else this.values.set(k, { labels, value });
  }
  render() {
    let out = `# HELP ${this.name} ${this.help}\n# TYPE ${this.name} counter\n`;
    for (const { labels, value } of this.values.values()) {
      out += `${this.name}${renderLabels(labels)} ${value}\n`;
    }
    return out;
  }
}

class Histogram {
  series = new Map<
    string,
    { labels: Labels; counts: number[]; sum: number; count: number }
  >();
  constructor(public name: string, public help: string, public buckets: number[]) {}
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
  render() {
    let out = `# HELP ${this.name} ${this.help}\n# TYPE ${this.name} histogram\n`;
    for (const s of this.series.values()) {
      for (let i = 0; i < this.buckets.length; i++) {
        out += `${this.name}_bucket${renderLabels({ ...s.labels, le: String(this.buckets[i]) })} ${
          s.counts[i]
        }\n`;
      }
      out += `${this.name}_bucket${renderLabels({ ...s.labels, le: "+Inf" })} ${s.count}\n`;
      out += `${this.name}_sum${renderLabels(s.labels)} ${s.sum}\n`;
      out += `${this.name}_count${renderLabels(s.labels)} ${s.count}\n`;
    }
    return out;
  }
}

export const httpRequestsTotal = new Counter("http_requests_total", "Total HTTP requests");
export const httpRequestDurationSeconds = new Histogram(
  "http_request_duration_seconds",
  "HTTP request duration in seconds",
  [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
);
export const trilhaProgressTotal = new Counter(
  "trilha_progress_total",
  "Total progress changes by status",
);

export function renderMetrics(): string {
  return [
    httpRequestsTotal.render(),
    httpRequestDurationSeconds.render(),
    trilhaProgressTotal.render(),
  ].join("\n");
}
