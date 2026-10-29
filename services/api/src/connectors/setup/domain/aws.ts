// eslint-disable-next-line max-lines-per-function -- embedded CloudFormation YAML; one template reads best whole
export function cloudFormationTemplate(): string {
  return `AWSTemplateFormatVersion: '2010-09-09'
Description: AI Production Engineer - read CloudWatch logs and receive CloudWatch alarms
Parameters:
  CallbackUrl:
    Type: String
    Description: Where the read-only key is sent once (contains a single-use token)
    NoEcho: true
  AlertUrl:
    Type: String
    Description: HTTPS alert intake for this workspace (contains its alert token)
    NoEcho: true
  LogGroupPrefix:
    Type: String
    Default: ''
    Description: Only report log groups starting with this prefix (empty = all)
Resources:
  ReadOnlyUser:
    Type: AWS::IAM::User
    Properties:
      Policies:
        - PolicyName: ape-read-logs
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action: ['logs:FilterLogEvents', 'logs:DescribeLogGroups']
                Resource: '*'
  ReadOnlyKey:
    Type: AWS::IAM::AccessKey
    Properties:
      UserName: !Ref ReadOnlyUser
  AlarmTopic:
    Type: AWS::SNS::Topic
    Properties:
      DisplayName: AI Production Engineer alarms
      Subscription:
        - Protocol: https
          Endpoint: !Ref AlertUrl
  CallbackRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal: { Service: lambda.amazonaws.com }
            Action: sts:AssumeRole
      ManagedPolicyArns: ['arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']
      Policies:
        - PolicyName: list-log-groups
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action: ['logs:DescribeLogGroups']
                Resource: '*'
  CallbackFunction:
    Type: AWS::Lambda::Function
    Properties:
      Runtime: python3.12
      Handler: index.handler
      Timeout: 60
      Role: !GetAtt CallbackRole.Arn
      Code:
        ZipFile: |
          import json, urllib.request, boto3, cfnresponse
          def handler(event, context):
              if event['RequestType'] != 'Create':
                  return cfnresponse.send(event, context, cfnresponse.SUCCESS, {})
              p = event['ResourceProperties']
              try:
                  logs = boto3.client('logs')
                  groups, kw = [], {}
                  if p.get('LogGroupPrefix'):
                      kw['logGroupNamePrefix'] = p['LogGroupPrefix']
                  for page in logs.get_paginator('describe_log_groups').paginate(**kw):
                      groups += [g['logGroupName'] for g in page['logGroups']]
                      if len(groups) >= 20:
                          break
                  body = json.dumps({
                      'accessKeyId': p['AccessKeyId'], 'secretAccessKey': p['SecretAccessKey'],
                      'region': p['Region'], 'logGroups': groups[:20], 'topicArn': p['TopicArn'],
                  }).encode()
                  req = urllib.request.Request(p['CallbackUrl'], data=body, method='POST',
                                               headers={'Content-Type': 'application/json'})
                  urllib.request.urlopen(req, timeout=30)
                  cfnresponse.send(event, context, cfnresponse.SUCCESS, {})
              except Exception as e:
                  cfnresponse.send(event, context, cfnresponse.FAILED, {}, reason=str(e)[:200])
  SendKeyBack:
    Type: Custom::ApeCallback
    Properties:
      ServiceToken: !GetAtt CallbackFunction.Arn
      CallbackUrl: !Ref CallbackUrl
      AccessKeyId: !Ref ReadOnlyKey
      SecretAccessKey: !GetAtt ReadOnlyKey.SecretAccessKey
      Region: !Ref AWS::Region
      TopicArn: !Ref AlarmTopic
      LogGroupPrefix: !Ref LogGroupPrefix
Outputs:
  AlarmTopicArn:
    Description: Point CloudWatch alarm actions (ALARM and OK) at this topic
    Value: !Ref AlarmTopic
`;
}

export function cloudFormationCommand(opts: {
  templateUrl: string;
  callbackUrl: string;
  alertUrl: string;
  region?: string;
}): string {
  const q = (s: string) => `'${s.replace(/'/g, `'"'"'`)}'`;
  return [
    `curl -fsSL ${q(opts.templateUrl)} -o ape-cloudwatch.yaml && \\`,
    'aws cloudformation deploy --stack-name ai-production-engineer \\',
    '  --template-file ape-cloudwatch.yaml --capabilities CAPABILITY_IAM \\',
    ...(opts.region ? [`  --region ${q(opts.region)} \\`] : []),
    `  --parameter-overrides CallbackUrl=${q(opts.callbackUrl)} AlertUrl=${q(opts.alertUrl)}`,
  ].join('\n');
}
