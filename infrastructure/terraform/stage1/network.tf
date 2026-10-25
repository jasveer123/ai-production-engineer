data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 2)
}

# No NAT gateway in stage 1 (about $45 a month): hosts sit in public subnets and the security
# groups below decide what can reach them.
resource "aws_vpc" "main" {
  cidr_block           = "10.20.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "ape" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true
  tags                    = { Name = "ape-public-${local.azs[count.index]}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.public.id]
}

data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

# App host: only CloudFront reaches port 80. No SSH (use Session Manager).
resource "aws_security_group" "app" {
  name        = "ape-app"
  description = "App host"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_ingress_rule" "app_http_from_cloudfront" {
  security_group_id = aws_security_group.app.id
  description       = "HTTP from CloudFront only"
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront.id
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "app_temporal_from_sandbox" {
  security_group_id            = aws_security_group.app.id
  description                  = "Sandbox worker to Temporal (the only way in from the sandbox)"
  referenced_security_group_id = aws_security_group.sandbox.id
  from_port                    = 7233
  to_port                      = 7233
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "app_all" {
  security_group_id = aws_security_group.app.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

# Sandbox host: runs untrusted test code. Nothing can connect in.
resource "aws_security_group" "sandbox" {
  name        = "ape-sandbox"
  description = "Sandbox host"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_egress_rule" "sandbox_https" {
  security_group_id = aws_security_group.sandbox.id
  description       = "Package registries, AWS APIs"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "sandbox_http" {
  security_group_id = aws_security_group.sandbox.id
  description       = "OS package mirrors"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "sandbox_temporal" {
  security_group_id            = aws_security_group.sandbox.id
  description                  = "Temporal on the app host"
  referenced_security_group_id = aws_security_group.app.id
  from_port                    = 7233
  to_port                      = 7233
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "sandbox_dns" {
  security_group_id = aws_security_group.sandbox.id
  description       = "DNS"
  cidr_ipv4         = aws_vpc.main.cidr_block
  from_port         = 53
  to_port           = 53
  ip_protocol       = "udp"
}
