# Pramaan collector

Reads logs from outside your apps and sends them to Pramaan. Built on Vector.

Docker:

    docker build -t pramaan/collector:0.1.0 .
    docker run -d --name pramaan-collector \
      -e PRAMAAN_INGEST_URL=https://YOUR_INGEST_URL -e PRAMAAN_TOKEN=YOUR_TOKEN \
      -v /var/run/docker.sock:/var/run/docker.sock pramaan/collector:0.1.0

Kubernetes:

    helm install pramaan-collector ./chart --set ingestUrl=https://YOUR_INGEST_URL --set token=YOUR_TOKEN
