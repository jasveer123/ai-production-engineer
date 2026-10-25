output "public_url" {
  value = "https://${aws_cloudfront_distribution.main.domain_name}"
}

output "app_instance_id" {
  value = aws_instance.app.id
}

output "sandbox_instance_id" {
  value = aws_instance.sandbox.id
}

output "registry" {
  value = "${local.account_id}.dkr.ecr.${var.region}.amazonaws.com"
}

output "github_deploy_role_arn" {
  value = one(aws_iam_role.github_deploy[*].arn)
}

output "releases_bucket" {
  value = aws_s3_bucket.releases.id
}

output "artifacts_bucket" {
  value = aws_s3_bucket.artifacts.id
}

output "console_home" {
  value = "https://${var.region}.console.aws.amazon.com/resource-groups/group/ape?region=${var.region}"
}
