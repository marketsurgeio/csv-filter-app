#!/bin/bash

# Build the frontend
cd frontend
npm install
npm run build

# Deploy frontend to S3
aws s3 sync build/ s3://surgeaudience-email-file-download-link --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id E3501X6FL42OGE --paths "/*"

# Deploy backend to EC2
cd ..
ssh -i csv-filter.pem ec2-user@ec2-3-148-175-139.us-east-2.compute.amazonaws.com "cd /home/ec2-user/csv-filter && git pull && npm install && pm2 restart csv-filter" 