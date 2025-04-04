/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { PluginConfigDescriptor } from '@kbn/core-plugins-server';
import type { TypeOf } from '@kbn/config-schema';
import { schema } from '@kbn/config-schema';

export const configSchema = schema.object({
  enableUiSettingsValidations: schema.boolean({ defaultValue: false }),
  experimental: schema.maybe(
    schema.object({
      ruleFormV2Enabled: schema.maybe(schema.boolean({ defaultValue: false })),
      enabledProfiles: schema.maybe(schema.arrayOf(schema.string(), { defaultValue: [] })),
    })
  ),
});

export type ConfigSchema = TypeOf<typeof configSchema>;
export type ExperimentalFeatures = NonNullable<ConfigSchema['experimental']>;

export const config: PluginConfigDescriptor<ConfigSchema> = {
  schema: configSchema,
  exposeToBrowser: {
    experimental: true,
  },
};
