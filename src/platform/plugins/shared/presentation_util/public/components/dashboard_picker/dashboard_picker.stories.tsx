/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React from 'react';
import { action } from '@storybook/addon-actions';

import { DashboardPicker } from './dashboard_picker';

export default {
  component: DashboardPicker,
  title: 'Dashboard Picker',
  argTypes: {
    isDisabled: {
      control: 'boolean',
      defaultValue: false,
    },
  },
};

export const Example = {
  render: ({ isDisabled }: { isDisabled: boolean }) => (
    <DashboardPicker onChange={action('onChange')} isDisabled={isDisabled} />
  ),
};
