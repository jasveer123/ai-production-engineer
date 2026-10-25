variable "region" {
  type    = string
  default = "ap-southeast-2"
}

variable "aws_profile" {
  description = "Local AWS CLI profile. Leave null in CI (credentials come from OIDC)."
  type        = string
  default     = null
}

variable "github_repo" {
  description = "owner/name of the repository allowed to deploy through OIDC."
  type        = string
  default     = "jasveer123/ai-production-engineer"
}

variable "monthly_budget_usd" {
  type    = number
  default = 40
}

variable "alert_email" {
  description = "Receives AWS Budgets alerts."
  type        = string
}

# The Free plan only allows free-tier-eligible instance types (t4g.small is the largest Graviton
# one, 2 GB). The app host adds swap to cope; upgrade the plan to use t4g.medium.
variable "app_instance_type" {
  type    = string
  default = "t4g.small"
}

variable "sandbox_instance_type" {
  type    = string
  default = "t4g.small"
}

variable "enable_schedule" {
  description = "Stop both hosts outside working hours to save money."
  type        = bool
  default     = true
}

variable "schedule_timezone" {
  type    = string
  default = "Australia/Sydney"
}

variable "schedule_start" {
  description = "Cron (EventBridge Scheduler syntax) for starting the hosts."
  type        = string
  default     = "cron(0 8 * * ? *)"
}

variable "schedule_stop" {
  type    = string
  default = "cron(0 23 * * ? *)"
}

variable "use_github_oidc" {
  description = "Create the GitHub OIDC provider and deploy role. The Free plan's service control policy denies this today; set true after upgrading the plan."
  type        = bool
  default     = false
}
