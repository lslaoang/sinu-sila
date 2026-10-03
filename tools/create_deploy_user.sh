#!/usr/bin/env bash
# Run this YOURSELF in a terminal signed in as the AWS root/admin user (`aws login`), then use the new user's keys for deploys.
# It creates an IAM user that can only upload to this site's bucket and clear its CloudFront cache.
set -euo pipefail
ACCOUNT=773994910221
BUCKET=sino-sila-$ACCOUNT
DIST=E1QGRO3D7NQZVA
USER=sino-sila-deployer

cat > /tmp/sino-sila-deploy-policy.json <<EOF
{"Version":"2012-10-17","Statement":[
 {"Sid":"ListBucket","Effect":"Allow","Action":["s3:ListBucket","s3:GetBucketLocation"],"Resource":"arn:aws:s3:::$BUCKET"},
 {"Sid":"WriteObjects","Effect":"Allow","Action":["s3:PutObject","s3:GetObject","s3:DeleteObject"],"Resource":"arn:aws:s3:::$BUCKET/*"},
 {"Sid":"ClearCache","Effect":"Allow","Action":["cloudfront:CreateInvalidation","cloudfront:GetInvalidation","cloudfront:GetDistribution"],"Resource":"arn:aws:cloudfront::$ACCOUNT:distribution/$DIST"}
]}
EOF

aws iam create-user --user-name "$USER"
aws iam put-user-policy --user-name "$USER" --policy-name deploy-site --policy-document file:///tmp/sino-sila-deploy-policy.json
aws iam create-access-key --user-name "$USER"   # prints AccessKeyId and SecretAccessKey ONCE. Do not paste them in chat or commit them.

echo
echo "Next: aws configure --profile sino-sila   (paste the new keys, region ap-southeast-1)"
echo "Then deploy with: AWS_PROFILE=sino-sila aws s3 sync ..."
