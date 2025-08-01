/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { createEsqlDataSource } from '../../../common/data_sources';
import { FEATURE_ID_1, FEATURE_ID_2, createContextAwarenessMocks } from '../__mocks__';
import { createExampleRootProfileProvider } from './example/example_root_profile';
import { registerEnabledProfileProviders } from './register_enabled_profile_providers';
import type { CellRenderersExtensionParams } from '../types';

const exampleRootProfileProvider = createExampleRootProfileProvider();

describe('registerEnabledProfileProviders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should register all profile providers', async () => {
    const { rootProfileServiceMock, rootProfileProviderMock, profileProviderServices } =
      createContextAwarenessMocks({
        shouldRegisterProviders: false,
      });

    registerEnabledProfileProviders({
      profileService: rootProfileServiceMock,
      providers: [rootProfileProviderMock],
      enabledExperimentalProfileIds: [],
      services: profileProviderServices,
    });
    const context = await rootProfileServiceMock.resolve({ solutionNavId: null });
    const profile = rootProfileServiceMock.getProfile({ context });
    const baseImpl = () => ({});
    profile.getCellRenderers?.(baseImpl)({} as unknown as CellRenderersExtensionParams);
    expect(rootProfileProviderMock.profile.getCellRenderers).toHaveBeenCalledTimes(1);
    expect(rootProfileProviderMock.profile.getCellRenderers).toHaveBeenCalledWith(baseImpl, {
      context,
    });
  });

  it('should not register experimental profile providers by default', async () => {
    jest.spyOn(exampleRootProfileProvider.profile, 'getCellRenderers');
    const { rootProfileServiceMock, profileProviderServices } = createContextAwarenessMocks({
      shouldRegisterProviders: false,
    });
    registerEnabledProfileProviders({
      profileService: rootProfileServiceMock,
      providers: [exampleRootProfileProvider],
      enabledExperimentalProfileIds: [],
      services: profileProviderServices,
    });
    const context = await rootProfileServiceMock.resolve({ solutionNavId: null });
    const profile = rootProfileServiceMock.getProfile({ context });
    const baseImpl = () => ({});
    profile.getCellRenderers?.(baseImpl)({} as unknown as CellRenderersExtensionParams);
    expect(exampleRootProfileProvider.profile.getCellRenderers).not.toHaveBeenCalled();
    expect(profile).toMatchObject({});
  });

  it('should register experimental profile providers when enabled by config', async () => {
    jest.spyOn(exampleRootProfileProvider.profile, 'getCellRenderers');
    const { rootProfileServiceMock, rootProfileProviderMock, profileProviderServices } =
      createContextAwarenessMocks({
        shouldRegisterProviders: false,
      });
    registerEnabledProfileProviders({
      profileService: rootProfileServiceMock,
      providers: [exampleRootProfileProvider],
      enabledExperimentalProfileIds: [exampleRootProfileProvider.profileId],
      services: profileProviderServices,
    });
    const context = await rootProfileServiceMock.resolve({ solutionNavId: null });
    const profile = rootProfileServiceMock.getProfile({ context });
    const baseImpl = () => ({});
    profile.getCellRenderers?.(baseImpl)({} as unknown as CellRenderersExtensionParams);
    expect(exampleRootProfileProvider.profile.getCellRenderers).toHaveBeenCalledTimes(1);
    expect(exampleRootProfileProvider.profile.getCellRenderers).toHaveBeenCalledWith(baseImpl, {
      context,
    });
    expect(rootProfileProviderMock.profile.getCellRenderers).not.toHaveBeenCalled();
  });

  it('should register restricted profile when product feature is available', async () => {
    const {
      rootProfileServiceMock,
      dataSourceProfileServiceMock,
      dataSourceProfileProviderMock,
      profileProviderServices,
    } = createContextAwarenessMocks({
      shouldRegisterProviders: false,
    });

    // Mock feature availability
    jest
      .spyOn(profileProviderServices.core.pricing, 'isFeatureAvailable')
      .mockImplementation((featureId) => {
        if (featureId === FEATURE_ID_1) {
          return true;
        }
        return false;
      });

    // Sanity check
    expect(profileProviderServices.core.pricing.isFeatureAvailable(FEATURE_ID_1)).toBeTruthy();

    registerEnabledProfileProviders({
      profileService: dataSourceProfileServiceMock,
      providers: [dataSourceProfileProviderMock],
      enabledExperimentalProfileIds: [],
      services: profileProviderServices,
    });
    const rootContext = await rootProfileServiceMock.resolve({ solutionNavId: null });
    const dataSourceContext = await dataSourceProfileServiceMock.resolve({
      rootContext,
      dataSource: createEsqlDataSource(),
      query: { esql: 'from my-example-logs' },
    });

    const profile = dataSourceProfileServiceMock.getProfile({ context: dataSourceContext });
    const baseImpl = () => ({});
    profile.getCellRenderers?.(baseImpl)({} as unknown as CellRenderersExtensionParams);
    expect(dataSourceProfileProviderMock.profile.getCellRenderers).toHaveBeenCalledTimes(1);
    expect(dataSourceProfileProviderMock.profile.getCellRenderers).toHaveBeenCalledWith(baseImpl, {
      context: dataSourceContext,
    });
  });

  it('should not register restricted profile when product feature is not available', async () => {
    const {
      rootProfileServiceMock,
      dataSourceProfileServiceMock,
      dataSourceProfileProviderMock,
      profileProviderServices,
    } = createContextAwarenessMocks({
      shouldRegisterProviders: false,
    });

    // Mock feature availability
    jest
      .spyOn(profileProviderServices.core.pricing, 'isFeatureAvailable')
      .mockImplementation((featureId) => {
        if (featureId === FEATURE_ID_2) {
          return true;
        }
        return false;
      });

    // Sanity check
    expect(profileProviderServices.core.pricing.isFeatureAvailable(FEATURE_ID_1)).not.toBeTruthy();

    registerEnabledProfileProviders({
      profileService: dataSourceProfileServiceMock,
      providers: [dataSourceProfileProviderMock],
      enabledExperimentalProfileIds: [],
      services: profileProviderServices,
    });
    const rootContext = await rootProfileServiceMock.resolve({ solutionNavId: null });
    const dataSourceContext = await dataSourceProfileServiceMock.resolve({
      rootContext,
      dataSource: createEsqlDataSource(),
      query: { esql: 'from my-example-logs' },
    });

    const profile = dataSourceProfileServiceMock.getProfile({ context: dataSourceContext });
    const baseImpl = () => ({});
    profile.getCellRenderers?.(baseImpl)({} as unknown as CellRenderersExtensionParams);
    expect(dataSourceProfileProviderMock.profile.getCellRenderers).not.toHaveBeenCalled();
    expect(profile).toMatchObject({});
  });
});
