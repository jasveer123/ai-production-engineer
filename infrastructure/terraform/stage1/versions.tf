terraform {
  required_version = ">= 1.10"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 6.0" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
  # State lives in S3 with native locking. Bucket name is passed at init time:
  #   terraform init -backend-config="bucket=ape-tfstate-<account-id>"
  backend "s3" {
    key          = "stage1/terraform.tfstate"
    region       = "ap-southeast-2"
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region  = var.region
  profile = var.aws_profile
  default_tags {
    tags = { project = "ape", stage = "1", managed_by = "terraform" }
  }
}
