/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import * as t from 'io-ts';

// This should be replaced by TLSParams from @kbn/response-ops-rule-params
export const TLSParamsType = t.partial({
  search: t.string,
  certAgeThreshold: t.number,
  certExpirationThreshold: t.number,
});
