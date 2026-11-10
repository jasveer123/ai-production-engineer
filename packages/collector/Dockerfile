FROM timberio/vector:0.46.1-debian
COPY docker.yaml /etc/pramaan/docker.yaml
COPY kubernetes.yaml /etc/pramaan/kubernetes.yaml
CMD ["--config", "/etc/pramaan/docker.yaml"]
