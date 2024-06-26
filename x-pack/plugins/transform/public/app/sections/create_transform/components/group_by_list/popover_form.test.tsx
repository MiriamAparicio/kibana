/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { render } from '@testing-library/react';

import { KibanaContextProvider } from '@kbn/kibana-react-plugin/public';

import { coreMock } from '@kbn/core/public/mocks';
import { dataPluginMock } from '@kbn/data-plugin/public/mocks';
const startMock = coreMock.createStart();

import type { AggName } from '../../../../../../common/types/aggregations';

import type { PivotGroupByConfig } from '../../../../common';
import { PIVOT_SUPPORTED_GROUP_BY_AGGS } from '../../../../common';

import { isIntervalValid, PopoverForm } from './popover_form';

describe('isIntervalValid()', () => {
  test('intervalType: histogram', () => {
    const isValid = (interval: string) =>
      isIntervalValid(interval, PIVOT_SUPPORTED_GROUP_BY_AGGS.HISTOGRAM);

    expect(isValid('0')).toBe(false);
    expect(isValid('00')).toBe(false);
    expect(isValid('001')).toBe(false);
    expect(isValid('10.')).toBe(false);
    expect(isValid('10.5')).toBe(true);
    expect(isValid('10.5.')).toBe(false);
    expect(isValid('10.5.1')).toBe(false);
    expect(isValid('0.5')).toBe(true);
    expect(isValid('0.0')).toBe(false);
    expect(isValid('0.00')).toBe(false);
    expect(isValid('.5')).toBe(false);
    expect(isValid('.5.')).toBe(false);
    expect(isValid('.5')).toBe(false);
    expect(isValid('5m')).toBe(false);
    expect(isValid('asdf')).toBe(false);
  });

  test('intervalType: date_histogram', () => {
    const isValid = (interval: string) =>
      isIntervalValid(interval, PIVOT_SUPPORTED_GROUP_BY_AGGS.DATE_HISTOGRAM);

    expect(isValid('0')).toBe(false);
    expect(isValid('10')).toBe(false);
    expect(isValid('10.5')).toBe(false);
    expect(isValid('10.5.')).toBe(false);
    expect(isValid('10.5.1')).toBe(false);
    expect(isValid('0.5')).toBe(false);
    expect(isValid('0.0')).toBe(false);
    expect(isValid('0.0m')).toBe(false);
    expect(isValid('0.00')).toBe(false);
    expect(isValid('0.00m')).toBe(false);
    expect(isValid('.5')).toBe(false);
    expect(isValid('.5.')).toBe(false);
    expect(isValid('ms')).toBe(false);
    expect(isValid('0ms')).toBe(false);
    expect(isValid('1ms')).toBe(true);
    expect(isValid('2s')).toBe(true);
    expect(isValid('5m')).toBe(true);
    expect(isValid('6h')).toBe(true);
    expect(isValid('7d')).toBe(true);
    expect(isValid('1w')).toBe(true);
    expect(isValid('8w')).toBe(false);
    expect(isValid('1y')).toBe(true);
    expect(isValid('9y')).toBe(false);
    expect(isValid('12ms')).toBe(true);
    expect(isValid('23s')).toBe(true);
    expect(isValid('54m')).toBe(true);
    expect(isValid('65h')).toBe(true);
    expect(isValid('76d')).toBe(true);
    expect(isValid('87w')).toBe(false);
    expect(isValid('98y')).toBe(false);
    expect(isValid('1M')).toBe(true);
    expect(isValid('3M')).toBe(false);
    expect(isValid('asdf')).toBe(false);
  });
});

describe('Transform: Group By <PopoverForm />', () => {
  test('Minimal initialization', () => {
    const defaultData: PivotGroupByConfig = {
      agg: PIVOT_SUPPORTED_GROUP_BY_AGGS.DATE_HISTOGRAM,
      aggName: 'the-agg-name',
      dropDownName: 'the-drop-down-name',
      field: 'the-field',
      calendar_interval: '1m',
    };
    const otherAggNames: AggName[] = [];
    const onChange = (item: PivotGroupByConfig) => {};

    // mock services for QueryStringInput
    const services = {
      ...startMock,
      data: dataPluginMock.createStartContract(),
      appName: 'the-test-app',
    };

    const { getByDisplayValue } = render(
      <KibanaContextProvider services={services}>
        <PopoverForm
          defaultData={defaultData}
          otherAggNames={otherAggNames}
          options={{}}
          onChange={onChange}
        />
      </KibanaContextProvider>
    );

    expect(getByDisplayValue('the-agg-name')).toBeInTheDocument();
    expect(getByDisplayValue('1m')).toBeInTheDocument();
  });
});
