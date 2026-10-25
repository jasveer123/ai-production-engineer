locals {
  ssm_prefix_arn = "arn:aws:ssm:${var.region}:${local.account_id}:parameter/ape/prod"
  repo_arns      = [for r in aws_ecr_repository.repo : r.arn]
}

data "aws_iam_policy_document" "ec2_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

# ---- App host ---------------------------------------------------------------------------
resource "aws_iam_role" "app" {
  name               = "ape-app"
  assume_role_policy = data.aws_iam_policy_document.ec2_trust.json
}

resource "aws_iam_role_policy_attachment" "app_ssm" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "app" {
  statement {
    sid       = "EcrLogin"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    sid       = "EcrPull"
    actions   = ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:BatchCheckLayerAvailability"]
    resources = local.repo_arns
  }
  statement {
    sid       = "ArtifactsReadWrite"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:ListBucket"]
    resources = [aws_s3_bucket.artifacts.arn, "${aws_s3_bucket.artifacts.arn}/*"]
  }
  statement {
    sid       = "ReleasesRead"
    actions   = ["s3:GetObject", "s3:ListBucket"]
    resources = [aws_s3_bucket.releases.arn, "${aws_s3_bucket.releases.arn}/*"]
  }
  statement {
    sid       = "PublishSandboxBundle"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.releases.arn}/sandbox/*", "${aws_s3_bucket.releases.arn}/host/*"]
  }
  statement {
    sid       = "ReadOwnSecrets"
    actions   = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
    resources = [local.ssm_prefix_arn, "${local.ssm_prefix_arn}/*"]
  }
}

resource "aws_iam_role_policy" "app" {
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.app.json
}

resource "aws_iam_instance_profile" "app" {
  name = "ape-app"
  role = aws_iam_role.app.name
}

# ---- Sandbox host: no database, no GitHub, no secrets ------------------------------------
resource "aws_iam_role" "sandbox" {
  name               = "ape-sandbox"
  assume_role_policy = data.aws_iam_policy_document.ec2_trust.json
}

resource "aws_iam_role_policy_attachment" "sandbox_ssm" {
  role       = aws_iam_role.sandbox.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "sandbox" {
  statement {
    sid       = "ArtifactsReadWrite"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:ListBucket"]
    resources = [aws_s3_bucket.artifacts.arn, "${aws_s3_bucket.artifacts.arn}/*"]
  }
  statement {
    sid       = "SandboxBundleRead"
    actions   = ["s3:GetObject", "s3:ListBucket"]
    resources = [aws_s3_bucket.releases.arn, "${aws_s3_bucket.releases.arn}/*"]
  }
}

resource "aws_iam_role_policy" "sandbox" {
  role   = aws_iam_role.sandbox.id
  policy = data.aws_iam_policy_document.sandbox.json
}

resource "aws_iam_instance_profile" "sandbox" {
  name = "ape-sandbox"
  role = aws_iam_role.sandbox.name
}

# ---- GitHub Actions deploys through OIDC: no stored AWS keys -------------------------------
resource "aws_iam_openid_connect_provider" "github" {
  count          = var.use_github_oidc ? 1 : 0
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_policy_document" "github_trust" {
  count = var.use_github_oidc ? 1 : 0
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github[0].arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  count                = var.use_github_oidc ? 1 : 0
  name                 = "ape-github-deploy"
  assume_role_policy   = data.aws_iam_policy_document.github_trust[0].json
  max_session_duration = 3600
}

data "aws_iam_policy_document" "github_deploy" {
  count = var.use_github_oidc ? 1 : 0
  statement {
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    actions = [
      "ecr:BatchCheckLayerAvailability", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload", "ecr:PutImage", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer",
      "ecr:DescribeImages",
    ]
    resources = local.repo_arns
  }
  statement {
    actions   = ["s3:PutObject", "s3:GetObject", "s3:ListBucket", "s3:DeleteObject"]
    resources = [aws_s3_bucket.releases.arn, "${aws_s3_bucket.releases.arn}/*"]
  }
  statement {
    sid     = "RunDeployCommands"
    actions = ["ssm:SendCommand"]
    resources = [
      "arn:aws:ssm:${var.region}::document/AWS-RunShellScript",
      aws_instance.app.arn,
      aws_instance.sandbox.arn,
    ]
  }
  statement {
    actions   = ["ssm:GetCommandInvocation", "ssm:ListCommandInvocations", "ssm:DescribeInstanceInformation"]
    resources = ["*"]
  }
  statement {
    sid       = "WakeHosts"
    actions   = ["ec2:StartInstances"]
    resources = [aws_instance.app.arn, aws_instance.sandbox.arn]
  }
  statement {
    actions   = ["ec2:DescribeInstances", "ec2:DescribeInstanceStatus"]
    resources = ["*"]
  }
  statement {
    actions   = ["ssm:GetParameter"]
    resources = ["${local.ssm_prefix_arn}/PUBLIC_URL"]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  count  = var.use_github_oidc ? 1 : 0
  role   = aws_iam_role.github_deploy[0].id
  policy = data.aws_iam_policy_document.github_deploy[0].json
}
