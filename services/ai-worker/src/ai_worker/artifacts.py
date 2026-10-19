"""Evidence bundles and reports in S3-compatible storage (RustFS locally)."""

import asyncio
import json
from typing import Any

import boto3
from botocore.config import Config

from ai_worker.config import Settings


class ArtifactStore:
    def __init__(self, settings: Settings) -> None:
        self.bucket = settings.s3_bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key.get_secret_value(),
            region_name="us-east-1",
            config=Config(s3={"addressing_style": "path"}, retries={"max_attempts": 3}),
        )

    @staticmethod
    def key_of(ref: str) -> str:
        prefix = "s3://"
        if not ref.startswith(prefix):
            raise ValueError(f"Not an artifact reference: {ref}")
        return ref[len(prefix) :].split("/", 1)[1]

    async def get_json(self, ref: str) -> Any:
        def _get() -> Any:
            body = self.client.get_object(Bucket=self.bucket, Key=self.key_of(ref))["Body"]
            return json.loads(body.read())

        return await asyncio.to_thread(_get)

    async def put_json(self, key: str, data: Any) -> str:
        def _put() -> None:
            self.client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=json.dumps(data, indent=1).encode(),
                ContentType="application/json",
            )

        await asyncio.to_thread(_put)
        return f"s3://{self.bucket}/{key}"
