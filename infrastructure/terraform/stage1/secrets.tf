# Generated once, kept in SSM Parameter Store (SecureString), read by the hosts at deploy time.
resource "random_id" "jwt" {
  byte_length = 32
}

resource "random_id" "encryption" {
  byte_length = 32
}

resource "random_id" "origin_verify" {
  byte_length = 24
}

resource "random_password" "postgres" {
  length  = 32
  special = false
}

locals {
  secrets = {
    JWT_SECRET             = random_id.jwt.hex
    SECRETS_ENCRYPTION_KEY = random_id.encryption.hex
    POSTGRES_PASSWORD      = random_password.postgres.result
    ORIGIN_VERIFY          = random_id.origin_verify.hex
  }
  # Set by hand after the first apply: `aws ssm put-parameter --overwrite ...` (never in Git).
  manual_secrets = [
    "GHCR_TOKEN",
    "ANTHROPIC_API_KEY",
    "GITHUB_APP_PRIVATE_KEY",
    "GITHUB_APP_ID",
    "GITHUB_WEBHOOK_SECRET",
    "GITHUB_OAUTH_CLIENT_ID",
    "GITHUB_OAUTH_CLIENT_SECRET",
    "RESEND_API_KEY",
  ]
}

resource "aws_ssm_parameter" "generated" {
  for_each = nonsensitive(toset(keys(local.secrets)))
  name     = "/ape/prod/${each.value}"
  type     = "SecureString"
  value    = local.secrets[each.value]
}

resource "aws_ssm_parameter" "manual" {
  for_each = toset(local.manual_secrets)
  name     = "/ape/prod/${each.value}"
  type     = "SecureString"
  value    = "unset"
  lifecycle { ignore_changes = [value] }
}

# Non-secret settings the deploy script and CI read.
resource "aws_ssm_parameter" "public_url" {
  name  = "/ape/prod/PUBLIC_URL"
  type  = "String"
  value = "https://${aws_cloudfront_distribution.main.domain_name}"
}

# GitHub account that owns the container images, and the read-only token the app host pulls with.
resource "aws_ssm_parameter" "ghcr_user" {
  name  = "/ape/prod/GHCR_USER"
  type  = "String"
  value = split("/", var.github_repo)[0]
}
