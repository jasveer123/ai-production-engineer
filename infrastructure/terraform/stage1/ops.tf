# ---- Cost guard -----------------------------------------------------------------------------
resource "aws_budgets_budget" "monthly" {
  name         = "ape-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  dynamic "notification" {
    for_each = [50, 80, 100]
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = [var.alert_email]
    }
  }
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
}

# ---- Health alarms --------------------------------------------------------------------------
resource "aws_sns_topic" "alerts" {
  name = "ape-alerts"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_cloudwatch_metric_alarm" "app_status" {
  alarm_name          = "ape-app-status-check-failed"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed"
  dimensions          = { InstanceId = aws_instance.app.id }
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 2
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "app_cpu_credits" {
  alarm_name          = "ape-app-cpu-credits-low"
  namespace           = "AWS/EC2"
  metric_name         = "CPUCreditBalance"
  dimensions          = { InstanceId = aws_instance.app.id }
  statistic           = "Minimum"
  period              = 300
  evaluation_periods  = 3
  threshold           = 30
  comparison_operator = "LessThanThreshold"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"
}

# ---- Nightly stop / morning start (the main lever for staying under the budget) -------------
data "aws_iam_policy_document" "scheduler_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "scheduler" {
  statement {
    actions   = ["ec2:StartInstances", "ec2:StopInstances"]
    resources = [aws_instance.app.arn, aws_instance.sandbox.arn]
  }
}

resource "aws_iam_role" "scheduler" {
  name               = "ape-scheduler"
  assume_role_policy = data.aws_iam_policy_document.scheduler_trust.json
}

resource "aws_iam_role_policy" "scheduler" {
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.scheduler.json
}

resource "aws_scheduler_schedule" "hosts" {
  for_each                     = var.enable_schedule ? { start = var.schedule_start, stop = var.schedule_stop } : {}
  name                         = "ape-${each.key}-hosts"
  schedule_expression          = each.value
  schedule_expression_timezone = var.schedule_timezone
  flexible_time_window { mode = "OFF" }
  target {
    arn      = "arn:aws:scheduler:::aws-sdk:ec2:${each.key}Instances"
    role_arn = aws_iam_role.scheduler.arn
    input    = jsonencode({ InstanceIds = [aws_instance.app.id, aws_instance.sandbox.id] })
  }
}

# One console page that lists every resource of the project (all are tagged project=ape).
resource "aws_resourcegroups_group" "ape" {
  name        = "ape"
  description = "Everything in the AI Production Engineer platform"
  resource_query {
    query = jsonencode({
      ResourceTypeFilters = ["AWS::AllSupported"]
      TagFilters          = [{ Key = "project", Values = ["ape"] }]
    })
  }
}
