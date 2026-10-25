# ADR-026: AWS deployment architecture (staged, credit-aware)

Status: accepted; stage 1 implemented in `infrastructure/terraform/stage1` and `.github/workflows/deploy.yml`. Region: `ap-southeast-2` (single Region; the new AWS
experience does not allow cross-Region features).

## Context

- Account: new AWS experience, **Free plan**, **$100 credits**, plan ends 2027-04-25.
- Components to host: Next.js web, NestJS API, Python AI worker, Temporal worker + Temporal server,
  Postgres (pgvector), Redis, object storage (local RustFS), OpenTelemetry collector + Jaeger,
  telemetry-gateway, and **sandbox-manager, which runs untrusted code**.
- Repo today: no Dockerfiles, empty `infrastructure/terraform`, local-only Compose file.
- Free plan includes: EC2, ECS, EKS, ECR, RDS, Aurora, ElastiCache, S3, ELB, CloudFront, WAF,
  Route 53, ACM, Secrets Manager, KMS, CloudWatch, X-Ray, CloudFormation, CodeBuild, Budgets,
  Bedrock. **Not available:** App Runner, Managed Grafana, Shield, Private CA, Transit Gateway,
  Organizations, IAM Identity Center.

The "textbook" production layout (ALB + Fargate + Multi-AZ RDS + NAT + ElastiCache) costs roughly
$150-250 a month and would spend the credits in 2-3 weeks. So we build the same *shape* in stages:
the network, IAM, registry, storage, secrets and CI are production-grade from day one, and only the
compute and data tier change between stages. Moving up is a Terraform variable, not a rewrite.

## Stage 1: Launch (budget ceiling $40/month)

```
Users -> Route 53 -> CloudFront (TLS from ACM) -> EC2 t4g.medium (Graviton, private SG)
                                                    Caddy -> web, api, ai-worker,
                                                    temporal(+worker), redis, postgres,
                                                    otel-collector, jaeger  (Docker Compose)
          S3 (artifacts, versioned, SSE-KMS)   ECR (images)   SSM Parameter Store / Secrets Manager
          CloudWatch Logs + alarms   AWS Budgets   AWS Backup (EBS snapshots) + nightly pg_dump -> S3
          Sandbox: separate t4g.small host (own security group and IAM role), same schedule
```

Why: one small Graviton box carries everything for a few dollars a day, while CloudFront means the
origin is not exposed directly and caching, TLS and (later) WAF are already in place.

Non-negotiables even at this size:
1. **Sandbox on its own host**, never beside secrets or the database. It runs the sandbox worker
   natively (so Docker bind-mount paths are real host paths) and starts one container per run.
   Its security group admits no inbound traffic, and outbound only to web ports and Temporal on the
   app host. Its IAM role can read and write the artifacts bucket and nothing else (no SSM
   secrets, no ECR). Instance metadata is limited to one hop, so containers the worker starts
   cannot reach the role credentials. Per-run isolation of the host itself (a fresh Fargate task
   per run) is a stage 2 item.
2. Postgres data on a dedicated gp3 EBS volume with daily snapshots and a tested restore.
3. No access keys anywhere. GitHub Actions deploys through **OIDC**; instances use IAM roles;
   humans use the `ape-aws` login. Shell access through **SSM Session Manager**, port 22 closed.
4. **Budgets** alerts at 50%, 80% and 100% of the monthly target plus a forecast alert.
5. Everything created by Terraform (state in S3 with locking), tagged `project=ape`, `stage=1`.
6. No NAT gateway (about $45/month): the instance sits in a public subnet behind security groups
   that only accept CloudFront's managed prefix list.

## Stage 2: Real users (about $180-300/month, needs paid plan or credits)

```
CloudFront + WAF -> ALB (2 AZ) -> ECS Fargate services (autoscaling):
   web, api, ai-worker (scales on Temporal task-queue depth), temporal-worker
RDS Postgres Multi-AZ (or Aurora Serverless v2)   ElastiCache Redis   Temporal (ECS, RDS-backed)
S3   Secrets Manager   VPC endpoints + one NAT   ADOT collector -> X-Ray / CloudWatch / AMP
Sandbox: ECS RunTask per execution (Fargate = one microVM per task), no task role, egress deny
```

Triggers to move up: sustained CPU above 60%, more than a handful of paying workspaces, a need for
zero-downtime deploys, or a customer asking for an availability commitment.

## Stage 3: Scale

Aurora with read replicas, Temporal Cloud or a dedicated Temporal cluster, SQS/EventBridge in front
of telemetry intake, Kinesis or MSK when event volume justifies it (paid plan only), separate
accounts for staging and production, and a second Region only if a customer requires it (the
current project type cannot do it).

## What the repo needs first

| Item | Why |
|---|---|
| Dockerfile per service (multi-stage, non-root, pinned base, `HEALTHCHECK`) | nothing deploys without images |
| Production Compose file (`infrastructure/docker/compose.prod.yml`) | stage 1 runtime |
| Terraform modules: `network`, `edge`, `compute`, `data`, `registry`, `secrets`, `ci`, `budgets` | repeatable infra |
| GitHub Actions: test -> build -> push to ECR -> deploy via SSM (stage 1) / ECS (stage 2) | no manual deploys |
| Swap RustFS for S3 via the existing S3 endpoint setting | one code path |
| Run DB migrations as a one-off step before the new version starts | safe releases |
| Anthropic key, GitHub App key, session secret in the secret store | no secrets in images |

## Decisions that need the owner

1. A domain name (a `.com` is about $15/year and is not covered by credits). Without one, CloudFront's
   default URL works but GitHub App callbacks and email links are awkward.
2. Monthly spend ceiling (suggested: $40).
3. Whether the sandbox features (reproduce, fix) run in the first release or stay off until the
   isolated sandbox host exists.

## Risks

- Credits end or the plan expires on 2027-04-25: the account then needs the Paid plan, so budget alarms and a
  teardown script (`terraform destroy`) are part of stage 1.
- A single instance is a single point of failure; accepted for stage 1, with snapshots and a
  documented rebuild from Terraform in under an hour.
- Prices above are estimates for `ap-southeast-2`; confirm before applying.

## Operating stage 1

- Deploys: merge to `main`, CI passes, `Deploy` builds arm64 images, pushes to ECR (immutable
  tags = first 12 characters of the commit), starts the hosts if the schedule stopped them, runs
  `deploy.sh` through SSM (pull, migrate, start, health-check, automatic rollback to the previous
  tag), then smoke-tests the public URL.
- Hosts stop at 23:00 and start at 08:00 Sydney time (`enable_schedule`, `schedule_*` variables).
  The elastic IP keeps the CloudFront origin stable across stops. A deploy wakes the hosts.
- Access: Session Manager only (`aws ssm start-session --target <id> --profile ape-aws`).
- Secrets: `/ape/prod/*` in SSM. Generated ones are created by Terraform; set the rest with
  `aws ssm put-parameter --name /ape/prod/ANTHROPIC_API_KEY --type SecureString --overwrite --value ...`.
- Backups: nightly `pg_dump` to `s3://<artifacts>/backups/` (30 days), versioned artifacts bucket.
- Cost levers: `t4g` instances use standard credits (throttle, never surplus charges), no NAT
  gateway, schedule, ECR keeps 15 images, budget alerts at 50/80/100% and forecast.

## Known limits of stage 1

- CloudFront reaches the host over HTTP (no domain, so no origin certificate). The security group
  admits only CloudFront's address list and Caddy requires a secret header; the hop itself is not
  encrypted. A domain plus ACM fixes this.
- Temporal runs as the single-node dev server on the data volume. Move it to a Postgres-backed
  deployment before relying on long-running workflows across host rebuilds.
- Syslog intake (TCP 6514) is disabled: CloudFront cannot proxy it.
- One host: a reboot is a few minutes of downtime.
