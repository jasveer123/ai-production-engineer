data "aws_caller_identity" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  repos      = ["ape-web", "ape-api", "ape-ai-worker", "ape-migrate"]
}

resource "aws_s3_bucket" "artifacts" {
  bucket = "ape-artifacts-${local.account_id}"
}

resource "aws_s3_bucket" "releases" {
  bucket = "ape-releases-${local.account_id}"
}

resource "aws_s3_bucket_public_access_block" "all" {
  for_each                = { artifacts = aws_s3_bucket.artifacts.id, releases = aws_s3_bucket.releases.id }
  bucket                  = each.value
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "all" {
  for_each = { artifacts = aws_s3_bucket.artifacts.id, releases = aws_s3_bucket.releases.id }
  bucket   = each.value
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_lifecycle_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  rule {
    id     = "expire-old-versions"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration { noncurrent_days = 30 }
    abort_incomplete_multipart_upload { days_after_initiation = 7 }
  }
  rule {
    id     = "database-backups"
    status = "Enabled"
    filter { prefix = "backups/" }
    expiration { days = 30 }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "releases" {
  bucket = aws_s3_bucket.releases.id
  rule {
    id     = "expire-old-bundles"
    status = "Enabled"
    filter { prefix = "sandbox/" }
    expiration { days = 30 }
  }
}

resource "aws_ecr_repository" "repo" {
  for_each             = toset(local.repos)
  name                 = each.value
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "AES256" }
}

resource "aws_ecr_lifecycle_policy" "repo" {
  for_each   = aws_ecr_repository.repo
  repository = each.value.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the last 15 images"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 15 }
      action       = { type = "expire" }
    }]
  })
}
