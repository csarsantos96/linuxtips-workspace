// Mini-implementação de métricas Prometheus, sem dependências.
// Mantém apenas o necessário para http_requests_total + http_request_duration_seconds.

type Labels = Record<string, string>;

function labelKey(labels: Labels): string {
  const keys = Object.keys(labels).sort();
  return keys.map((k) => `${k}="${escapeLabel(labels[k])}"`).join(",");
}

function escapeLabel(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}

class Counter {
  private values = new Map<string, number>();
  constructor(public name: string, public help: string, public labelNames: string[]) {}
  inc(labels: Labels, n = 1) {
    const k = labelKey(labels);
    this.values.set(k, (this.values.get(k) ?? 0) + n);
  }
  render(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    for (const [k, v] of this.values) {
      lines.push(`${this.name}{${k}} ${v}`);
    }
    return lines.join("\n");
  }
}

class Histogram {
  private buckets: number[];
  private counts = new Map<string, number[]>();
  private sums = new Map<string, number>();
  private totals = new Map<string, number>();
  constructor(
    public name: string,
    public help: string,
    public labelNames: string[],
    buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  ) {
    this.buckets = buckets;
  }
  observe(labels: Labels, value: number) {
    const k = labelKey(labels);
    let arr = this.counts.get(k);
    if (!arr) {
      arr = new Array(this.buckets.length).fill(0);
      this.counts.set(k, arr);
    }
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]) arr[i] += 1;
    }
    this.sums.set(k, (this.sums.get(k) ?? 0) + value);
    this.totals.set(k, (this.totals.get(k) ?? 0) + 1);
  }
  render(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    for (const [k, arr] of this.counts) {
      for (let i = 0; i < this.buckets.length; i++) {
        const label = k ? `${k},le="${this.buckets[i]}"` : `le="${this.buckets[i]}"`;
        lines.push(`${this.name}_bucket{${label}} ${arr[i]}`);
      }
      const infLabel = k ? `${k},le="+Inf"` : `le="+Inf"`;
      lines.push(`${this.name}_bucket{${infLabel}} ${this.totals.get(k) ?? 0}`);
      lines.push(`${this.name}_sum{${k}} ${this.sums.get(k) ?? 0}`);
      lines.push(`${this.name}_count{${k}} ${this.totals.get(k) ?? 0}`);
    }
    return lines.join("\n");
  }
}

export const httpRequestsTotal = new Counter(
  "http_requests_total",
  "Total de requisições HTTP",
  ["method", "route", "status"],
);

export const httpRequestDurationSeconds = new Histogram(
  "http_request_duration_seconds",
  "Duração das requisições HTTP em segundos",
  ["method", "route", "status"],
);

export function renderMetrics(): string {
  return [httpRequestsTotal.render(), httpRequestDurationSeconds.render()].join("\n") + "\n";
}
