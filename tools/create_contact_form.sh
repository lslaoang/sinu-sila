#!/usr/bin/env bash
# Run this YOURSELF as the AWS root/admin user (aws login). It makes the "Report an error" form work without publishing your email:
# the page posts to a tiny Lambda, and the Lambda emails [removed] through Amazon SES.
set -euo pipefail
REGION=ap-southeast-1
TO=[removed]
ORIGIN=https://d3kbf1pju0ogt8.cloudfront.net
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
ROLE=sino-sila-report-role
FN=sino-sila-report

aws ses verify-email-identity --email-address "$TO" --region $REGION
echo ">>> Amazon SES just emailed $TO a verification link. Click it before testing (the form cannot send until you do)."

aws iam create-role --role-name $ROLE --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
aws iam put-role-policy --role-name $ROLE --policy-name send-report --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[
 {\"Effect\":\"Allow\",\"Action\":\"ses:SendEmail\",\"Resource\":\"arn:aws:ses:$REGION:$ACCOUNT:identity/$TO\"},
 {\"Effect\":\"Allow\",\"Action\":[\"logs:CreateLogGroup\",\"logs:CreateLogStream\",\"logs:PutLogEvents\"],\"Resource\":\"*\"}]}"
sleep 12   # let the new role propagate

( cd "$(dirname "$0")/contact_lambda" && zip -q /tmp/sino-sila-report.zip handler.py )
aws lambda create-function --function-name $FN --runtime python3.12 --handler handler.lambda_handler --timeout 10 --memory-size 128 \
  --role "arn:aws:iam::$ACCOUNT:role/$ROLE" --zip-file fileb:///tmp/sino-sila-report.zip \
  --environment "Variables={TO=$TO,ORIGIN=$ORIGIN,SES_REGION=$REGION}" --region $REGION >/dev/null
aws lambda create-function-url-config --function-name $FN --auth-type NONE --region $REGION \
  --cors "AllowOrigins=$ORIGIN,AllowMethods=POST,AllowHeaders=content-type,MaxAge=3600" --query FunctionUrl --output text
aws lambda add-permission --function-name $FN --statement-id public-url --action lambda:InvokeFunctionUrl --principal '*' --function-url-auth-type NONE --region $REGION >/dev/null
echo ">>> Copy the https://....lambda-url...on.aws/ address printed above and give it to Claude. It is not a secret."
