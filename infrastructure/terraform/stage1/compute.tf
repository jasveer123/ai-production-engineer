data "aws_ssm_parameter" "al2023_arm64" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

locals {
  host_files = {
    "compose.prod.yml"    = "${path.module}/../../docker/compose.prod.yml"
    "Caddyfile"           = "${path.module}/../../docker/Caddyfile"
    "otel-collector.yaml" = "${path.module}/../../docker/otel-collector.yaml"
    "deploy.sh"           = "${path.module}/../../deploy/deploy.sh"
    "deploy-sandbox.sh"   = "${path.module}/../../deploy/deploy-sandbox.sh"
    "backup.sh"           = "${path.module}/../../deploy/backup.sh"
    "ape-sandbox.service" = "${path.module}/../../deploy/ape-sandbox.service"
  }
}

# Files the hosts run. CI uploads fresh copies before every deploy; this seeds the first boot.
resource "aws_s3_object" "host" {
  for_each = local.host_files
  bucket   = aws_s3_bucket.releases.id
  key      = "host/${each.key}"
  source   = each.value
  etag     = filemd5(each.value)
}

resource "aws_ebs_volume" "app_data" {
  availability_zone = aws_subnet.public[0].availability_zone
  size              = 30
  type              = "gp3"
  encrypted         = true
  tags              = { Name = "ape-app-data" }
  lifecycle { prevent_destroy = true }
}

resource "aws_instance" "app" {
  ami                    = nonsensitive(data.aws_ssm_parameter.al2023_arm64.value)
  instance_type          = var.app_instance_type
  subnet_id              = aws_subnet.public[0].id
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.app.name

  # "standard" throttles at zero credits instead of billing surplus CPU: a hard cost ceiling.
  credit_specification { cpu_credits = "standard" }

  metadata_options {
    http_tokens                 = "required"
    http_put_response_hop_limit = 2 # containers on this host use the role for S3
  }
  root_block_device {
    volume_size = 20
    volume_type = "gp3"
    encrypted   = true
  }
  user_data = templatefile("${path.module}/user-data-app.sh.tpl", {
    releases_bucket  = aws_s3_bucket.releases.id
    artifacts_bucket = aws_s3_bucket.artifacts.id
    region           = var.region
    data_volume_id   = replace(aws_ebs_volume.app_data.id, "-", "")
  })
  user_data_replace_on_change = false
  depends_on                  = [aws_s3_object.host]
  tags                        = { Name = "ape-app", role = "app" }
  lifecycle { ignore_changes = [ami, user_data] }
}

resource "aws_volume_attachment" "app_data" {
  device_name = "/dev/sdf"
  volume_id   = aws_ebs_volume.app_data.id
  instance_id = aws_instance.app.id
}

# Stable address so CloudFront keeps working across the nightly stop/start.
resource "aws_eip" "app" {
  domain   = "vpc"
  instance = aws_instance.app.id
  tags     = { Name = "ape-app" }
}

resource "aws_instance" "sandbox" {
  ami                    = nonsensitive(data.aws_ssm_parameter.al2023_arm64.value)
  instance_type          = var.sandbox_instance_type
  subnet_id              = aws_subnet.public[1].id
  vpc_security_group_ids = [aws_security_group.sandbox.id]
  iam_instance_profile   = aws_iam_instance_profile.sandbox.name

  credit_specification { cpu_credits = "standard" }

  metadata_options {
    http_tokens = "required"
    # One hop: the sandbox worker on the host can use the role, containers it starts cannot.
    http_put_response_hop_limit = 1
  }
  root_block_device {
    volume_size = 40
    volume_type = "gp3"
    encrypted   = true
  }
  user_data = templatefile("${path.module}/user-data-sandbox.sh.tpl", {
    releases_bucket  = aws_s3_bucket.releases.id
    artifacts_bucket = aws_s3_bucket.artifacts.id
    region           = var.region
    temporal_address = "${aws_instance.app.private_ip}:7233"
  })
  depends_on = [aws_s3_object.host]
  tags       = { Name = "ape-sandbox", role = "sandbox" }
  lifecycle { ignore_changes = [ami, user_data] }
}
