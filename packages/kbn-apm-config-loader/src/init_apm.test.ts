/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { mockLoadConfiguration } from './init_apm.test.mocks';

import { initApm } from './init_apm';
import apm from 'elastic-apm-node';

describe('initApm', () => {
  let apmAddFilterMock: jest.Mock;
  let apmStartMock: jest.Mock;
  let getConfig: jest.Mock;
  let isUsersRedactionEnabled: jest.Mock;

  beforeEach(() => {
    apmAddFilterMock = apm.addFilter as jest.Mock;
    apmStartMock = apm.start as jest.Mock;
    getConfig = jest.fn();
    isUsersRedactionEnabled = jest.fn();

    mockLoadConfiguration.mockImplementation(() => ({
      getConfig,
      isUsersRedactionEnabled,
    }));
  });

  afterEach(() => {
    apmAddFilterMock.mockReset();
    apmStartMock.mockReset();
    mockLoadConfiguration.mockReset();
  });

  it('calls `loadConfiguration` with the correct options', () => {
    initApm(['foo', 'bar'], 'rootDir', true, 'service-name');

    expect(mockLoadConfiguration).toHaveBeenCalledTimes(1);
    expect(mockLoadConfiguration).toHaveBeenCalledWith(['foo', 'bar'], 'rootDir', true);
  });

  it('calls `apmConfigLoader.getConfig` with the correct options', () => {
    initApm(['foo', 'bar'], 'rootDir', true, 'service-name');

    expect(getConfig).toHaveBeenCalledTimes(1);
    expect(getConfig).toHaveBeenCalledWith('service-name');
  });

  it('calls `apmConfigLoader.isUsersRedactionEnabled`', () => {
    initApm(['foo', 'bar'], 'rootDir', true, 'service-name');

    expect(isUsersRedactionEnabled).toHaveBeenCalledTimes(1);
  });

  it('registers a filter using `addFilter` when user redaction is enabled', () => {
    isUsersRedactionEnabled.mockReturnValue(true);

    initApm(['foo', 'bar'], 'rootDir', true, 'service-name');

    expect(apmAddFilterMock).toHaveBeenCalledTimes(1);
    expect(apmAddFilterMock).toHaveBeenCalledWith(expect.any(Function));
  });

  it('does not register a filter using `addFilter` when user redaction is disabled', () => {
    isUsersRedactionEnabled.mockReturnValue(false);

    initApm(['foo', 'bar'], 'rootDir', true, 'service-name');

    expect(apmAddFilterMock).not.toHaveBeenCalled();
  });

  it('starts apm with the config returned from `getConfig`', () => {
    const config = {
      foo: 'bar',
    };
    getConfig.mockReturnValue(config);

    initApm(['foo', 'bar'], 'rootDir', true, 'service-name');

    expect(apmStartMock).toHaveBeenCalledTimes(1);
    expect(apmStartMock).toHaveBeenCalledWith(config);
  });
});
