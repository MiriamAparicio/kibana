/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createTestConfig } from './config.base';

export default createTestConfig({
  license: 'trial',
  ssl: true,
  esSnapshotStorageConfig: { size: '0.1GB', path: '/tmp' },
  ilmPollInterval: '5s',
});
