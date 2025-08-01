/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { sharedMetrics } from './shared/metrics';
import { metrics as podMetrics } from './kubernetes/pod/metrics';
import { metrics as awsEC2Metrics } from './aws_ec2/metrics';
import { metrics as awsS3Metrics } from './aws_s3/metrics';
import { metrics as awsRDSMetrics } from './aws_rds/metrics';
import { metrics as awsSQSMetrics } from './aws_sqs/metrics';

export const metrics = {
  tsvb: {
    ...sharedMetrics.tsvb,
    ...podMetrics.tsvb,
    ...awsEC2Metrics.tsvb,
    ...awsS3Metrics.tsvb,
    ...awsRDSMetrics.tsvb,
    ...awsSQSMetrics.tsvb,
  },
};
