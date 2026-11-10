{{- define "pramaan-collector.name" -}}pramaan-collector{{- end -}}

{{- define "pramaan-collector.secretName" -}}
{{- if .Values.existingSecret -}}{{ .Values.existingSecret }}{{- else -}}pramaan-collector-token{{- end -}}
{{- end -}}
