{{/*
PICKStack umbrella — helpers compartilhados pelos templates do próprio umbrella.
Sub-charts têm seu próprio _helpers.tpl em infra/helm/charts/<svc>/templates/.
*/}}

{{- define "pickstack.name" -}}
{{- default "pickstack" .Chart.Name -}}
{{- end -}}

{{- define "pickstack.fullname" -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "pickstack.labels" -}}
app.kubernetes.io/name: {{ include "pickstack.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: pickstack
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
{{- end -}}
