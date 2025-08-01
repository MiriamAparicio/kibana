/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createStatefulTestConfig } from '../../../api_integration_deployment_agnostic/default_configs/stateful.config.base';
import { deploymentAgnosticSpacesServices } from '../services';

export default createStatefulTestConfig<typeof deploymentAgnosticSpacesServices>({
  services: deploymentAgnosticSpacesServices,
  testFiles: [require.resolve('./apis/copy_to_space/index_trial')],
  junit: {
    reportName:
      'X-Pack Spaces API Deployment Agnostic Integration Tests -- copy_to_space - trial license',
  },
});
