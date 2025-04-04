/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { RedirectAppLinks } from '@kbn/shared-ux-link-redirect-app';
import React from 'react';
import { type AppMountParameters, type CoreStart } from '@kbn/core/public';
import {
  BreadcrumbsContextProvider,
  RouteRenderer,
  RouterProvider,
} from '@kbn/typed-react-router-config';
import { EuiFlexGroup, EuiFlexItem } from '@elastic/eui';
import { StreamsAppContextProvider } from '../streams_app_context_provider';
import { streamsAppRouter } from '../../routes/config';
import { StreamsAppStartDependencies } from '../../types';
import { StreamsAppServices } from '../../services/types';
import { HeaderMenuPortal } from '../header_menu';
import { TimeFilterProvider } from '../../hooks/use_timefilter';

export function AppRoot({
  coreStart,
  pluginsStart,
  services,
  appMountParameters,
  isServerless,
}: {
  coreStart: CoreStart;
  pluginsStart: StreamsAppStartDependencies;
  services: StreamsAppServices;
  isServerless: boolean;
} & { appMountParameters: AppMountParameters }) {
  const { history } = appMountParameters;

  const context = {
    appParams: appMountParameters,
    core: coreStart,
    dependencies: {
      start: pluginsStart,
    },
    services,
    isServerless,
  };

  return (
    <StreamsAppContextProvider context={context}>
      <RedirectAppLinks coreStart={coreStart}>
        <TimeFilterProvider timefilter={pluginsStart.data.query.timefilter.timefilter}>
          <RouterProvider history={history} router={streamsAppRouter}>
            <BreadcrumbsContextProvider>
              <RouteRenderer />
            </BreadcrumbsContextProvider>
            <StreamsAppHeaderActionMenu appMountParameters={appMountParameters} />
          </RouterProvider>
        </TimeFilterProvider>
      </RedirectAppLinks>
    </StreamsAppContextProvider>
  );
}

export function StreamsAppHeaderActionMenu({
  appMountParameters,
}: {
  appMountParameters: AppMountParameters;
}) {
  const { setHeaderActionMenu, theme$ } = appMountParameters;

  return (
    <HeaderMenuPortal setHeaderActionMenu={setHeaderActionMenu} theme$={theme$}>
      <EuiFlexGroup responsive={false} gutterSize="s">
        <EuiFlexItem>
          <></>
        </EuiFlexItem>
      </EuiFlexGroup>
    </HeaderMenuPortal>
  );
}
