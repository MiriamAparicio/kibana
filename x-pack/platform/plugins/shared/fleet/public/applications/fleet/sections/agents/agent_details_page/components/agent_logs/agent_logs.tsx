/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React, { memo, useMemo, useState, useCallback } from 'react';
import styled from 'styled-components';
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiSuperDatePicker,
  EuiFilterGroup,
  EuiPanel,
  EuiCallOut,
  EuiLink,
} from '@elastic/eui';
import { FormattedMessage } from '@kbn/i18n-react';
import { fromKueryExpression } from '@kbn/es-query';
import semverGte from 'semver/functions/gte';
import semverCoerce from 'semver/functions/coerce';

import { createStateContainerReactHelpers } from '@kbn/kibana-utils-plugin/public';
import { RedirectAppLinks } from '@kbn/shared-ux-link-redirect-app';
import type { TimeRange } from '@kbn/es-query';
import { LazySavedSearchComponent } from '@kbn/saved-search-component';
import useAsync from 'react-use/lib/useAsync';

import type { Agent, AgentPolicy } from '../../../../../types';
import { useLink, useStartServices } from '../../../../../hooks';

import { DatasetFilter } from './filter_dataset';
import { LogLevelFilter } from './filter_log_level';
import { LogQueryBar } from './query_bar';
import { buildQuery } from './build_query';
import { ViewLogsButton, getFormattedRange } from './view_logs_button';

const WrapperFlexGroup = styled(EuiFlexGroup)`
  height: 100%;
`;

const DatePickerFlexItem = styled(EuiFlexItem)`
  max-width: 312px;
`;

export interface AgentLogsProps {
  agent: Agent;
  agentPolicy?: AgentPolicy;
  state: AgentLogsState;
}

export interface AgentLogsState {
  start: string;
  end: string;
  logLevels: string[];
  datasets: string[];
  query: string;
}

export const AgentLogsUrlStateHelper = createStateContainerReactHelpers();

const AgentPolicyLogsNotEnabledCallout: React.FunctionComponent<{ agentPolicy: AgentPolicy }> = ({
  agentPolicy,
}) => {
  const { getHref } = useLink();

  return (
    <EuiFlexItem>
      <EuiCallOut
        size="m"
        color="primary"
        iconType="info"
        title={
          <FormattedMessage
            id="xpack.fleet.agentLogs.logDisabledCallOutTitle"
            defaultMessage="Log collection is disabled"
          />
        }
      >
        {agentPolicy.is_managed ? null : (
          <FormattedMessage
            id="xpack.fleet.agentLogs.logDisabledCallOutDescription"
            defaultMessage="Update the agent's policy {settingsLink} to enable logs collection."
            values={{
              settingsLink: (
                <EuiLink
                  href={getHref('policy_details', {
                    policyId: agentPolicy.id,
                    tabId: 'settings',
                  })}
                >
                  <FormattedMessage
                    id="xpack.fleet.agentLogs.settingsLink"
                    defaultMessage="settings"
                  />
                </EuiLink>
              ),
            }}
          />
        )}
      </EuiCallOut>
    </EuiFlexItem>
  );
};

export const AgentLogsUI: React.FunctionComponent<AgentLogsProps> = memo(
  ({ agent, agentPolicy, state }) => {
    const {
      application,
      logsDataAccess: {
        services: { logSourcesService },
      },
      embeddable,
      data: {
        search: { searchSource },
        query: {
          timefilter: { timefilter: dataTimefilter },
        },
        dataViews,
      },
    } = useStartServices();

    const logSources = useAsync(logSourcesService.getFlattenedLogSources);

    const { update: updateState } = AgentLogsUrlStateHelper.useTransitions();

    // Util to convert date expressions (returned by datepicker) to timestamps (used by LogStream)
    const getDateRangeTimestamps = useCallback(
      (timeRange: TimeRange) => {
        const { min, max } = dataTimefilter.calculateBounds(timeRange);
        return min && max
          ? {
              start: min.valueOf(),
              end: max.valueOf(),
            }
          : undefined;
      },
      [dataTimefilter]
    );

    const tryUpdateDateRange = useCallback(
      (timeRange: TimeRange) => {
        const timestamps = getDateRangeTimestamps(timeRange);
        if (timestamps) {
          updateState({
            start: timeRange.from,
            end: timeRange.to,
          });
        }
      },
      [getDateRangeTimestamps, updateState]
    );
    // Query validation helper
    const isQueryValid = useCallback((testQuery: string) => {
      try {
        fromKueryExpression(testQuery);
        return true;
      } catch (err) {
        return false;
      }
    }, []);

    // User query state
    const [draftQuery, setDraftQuery] = useState<string>(state.query);
    const [isDraftQueryValid, setIsDraftQueryValid] = useState<boolean>(isQueryValid(state.query));
    const onUpdateDraftQuery = useCallback(
      (newDraftQuery: string, runQuery?: boolean) => {
        setDraftQuery(newDraftQuery);
        if (isQueryValid(newDraftQuery)) {
          setIsDraftQueryValid(true);
          if (runQuery) {
            updateState({ query: newDraftQuery });
          }
        } else {
          setIsDraftQueryValid(false);
        }
      },
      [isQueryValid, updateState]
    );

    // Build final log stream query from agent id, datasets, log levels, and user input
    const logStreamQuery = useMemo(
      () => ({
        language: 'kuery',
        query: buildQuery({
          agentId: agent.id,
          datasets: state.datasets,
          logLevels: state.logLevels,
          userQuery: state.query,
        }),
      }),
      [agent.id, state.datasets, state.logLevels, state.query]
    );

    const agentVersion = agent.local_metadata?.elastic?.agent?.version;
    const isLogFeatureAvailable = useMemo(() => {
      if (!agentVersion) {
        return false;
      }
      const agentVersionWithPrerelease = semverCoerce(agentVersion)?.version;
      if (!agentVersionWithPrerelease) {
        return false;
      }
      return semverGte(agentVersionWithPrerelease, '7.11.0');
    }, [agentVersion]);

    if (!isLogFeatureAvailable) {
      return (
        <EuiCallOut
          size="m"
          color="warning"
          title={
            <FormattedMessage
              id="xpack.fleet.agentLogs.oldAgentWarningTitle"
              defaultMessage="The Logs view requires Elastic Agent 7.11 or higher. To upgrade an agent, go to the Actions menu, or {downloadLink} a newer version."
              values={{
                downloadLink: (
                  <EuiLink href="https://ela.st/download-elastic-agent" external target="_blank">
                    <FormattedMessage
                      id="xpack.fleet.agentLogs.downloadLink"
                      defaultMessage="download"
                    />
                  </EuiLink>
                ),
              }}
            />
          }
        />
      );
    }

    return (
      <WrapperFlexGroup direction="column" gutterSize="m">
        {agentPolicy && !agentPolicy.monitoring_enabled?.includes('logs') && (
          <AgentPolicyLogsNotEnabledCallout agentPolicy={agentPolicy} />
        )}
        <EuiFlexItem grow={false}>
          <EuiFlexGroup gutterSize="m">
            <EuiFlexItem>
              <LogQueryBar
                query={draftQuery}
                onUpdateQuery={onUpdateDraftQuery}
                isQueryValid={isDraftQueryValid}
              />
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiFilterGroup>
                <DatasetFilter
                  selectedDatasets={state.datasets}
                  onToggleDataset={(dataset: string) => {
                    const currentDatasets = [...state.datasets];
                    const datasetPosition = currentDatasets.indexOf(dataset);
                    if (datasetPosition >= 0) {
                      currentDatasets.splice(datasetPosition, 1);
                      updateState({ datasets: currentDatasets });
                    } else {
                      updateState({ datasets: [...state.datasets, dataset] });
                    }
                  }}
                />
                <LogLevelFilter
                  selectedLevels={state.logLevels}
                  onToggleLevel={(level: string) => {
                    const currentLevels = [...state.logLevels];
                    const levelPosition = currentLevels.indexOf(level);
                    if (levelPosition >= 0) {
                      currentLevels.splice(levelPosition, 1);
                      updateState({ logLevels: currentLevels });
                    } else {
                      updateState({ logLevels: [...state.logLevels, level] });
                    }
                  }}
                />
              </EuiFilterGroup>
            </EuiFlexItem>
            <DatePickerFlexItem grow={false}>
              <EuiSuperDatePicker
                showUpdateButton={false}
                start={state.start}
                end={state.end}
                onTimeChange={({ start, end }) => {
                  tryUpdateDateRange({
                    from: start,
                    to: end,
                  });
                }}
              />
            </DatePickerFlexItem>
            <EuiFlexItem grow={false}>
              <RedirectAppLinks
                coreStart={{
                  application,
                }}
              >
                <ViewLogsButton
                  logStreamQuery={logStreamQuery.query}
                  startTime={getFormattedRange(state.start)}
                  endTime={getFormattedRange(state.end)}
                />
              </RedirectAppLinks>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiPanel paddingSize="none" grow={false}>
            {logSources.value ? (
              <LazySavedSearchComponent
                dependencies={{ embeddable, searchSource, dataViews }}
                index={logSources.value}
                timeRange={{
                  from: state.start,
                  to: state.end,
                }}
                query={logStreamQuery}
                height="60vh"
                displayOptions={{
                  enableDocumentViewer: true,
                  enableFilters: false,
                }}
                columns={[
                  '@timestamp',
                  'event.dataset',
                  'component.id',
                  'message',
                  'error.message',
                ]}
              />
            ) : null}
          </EuiPanel>
        </EuiFlexItem>
      </WrapperFlexGroup>
    );
  }
);
