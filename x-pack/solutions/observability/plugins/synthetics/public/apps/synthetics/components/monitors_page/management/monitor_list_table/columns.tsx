/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiBasicTableColumn, EuiButtonIcon } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import React from 'react';
import { useHistory } from 'react-router-dom';
import { FETCH_STATUS, TagsList } from '@kbn/observability-shared-plugin/public';
import { useKibana } from '@kbn/kibana-react-plugin/public';
import { isEmpty } from 'lodash';
import { ClientPluginsStart } from '../../../../../../plugin';
import { useKibanaSpace } from '../../../../../../hooks/use_kibana_space';
import { getMonitorSpaceToAppend, useEnablement } from '../../../../hooks';
import { useCanEditSynthetics } from '../../../../../../hooks/use_capabilities';
import {
  isStatusEnabled,
  toggleStatusAlert,
} from '../../../../../../../common/runtime_types/monitor_management/alert_config';
import {
  CANNOT_PERFORM_ACTION_SYNTHETICS,
  NoPermissionsTooltip,
} from '../../../common/components/permissions';
import { useMonitorAlertEnable } from '../../../../hooks/use_monitor_alert_enable';
import * as labels from './labels';
import { MonitorDetailsLink } from './monitor_details_link';

import {
  ConfigKey,
  EncryptedSyntheticsSavedMonitor,
  OverviewStatusState,
  ServiceLocations,
  SyntheticsMonitorSchedule,
} from '../../../../../../../common/runtime_types';

import { MonitorTypeBadge } from '../../../common/components/monitor_type_badge';
import { getFrequencyLabel } from './labels';
import { MonitorEnabled } from './monitor_enabled';
import { MonitorLocations } from './monitor_locations';

export function useMonitorListColumns({
  loading,
  overviewStatus,
  setMonitorPendingDeletion,
}: {
  loading: boolean;
  overviewStatus: OverviewStatusState | null;
  setMonitorPendingDeletion: (configs: string[]) => void;
}): Array<EuiBasicTableColumn<EncryptedSyntheticsSavedMonitor>> {
  const history = useHistory();
  const { http, spaces } = useKibana<ClientPluginsStart>().services;
  const canEditSynthetics = useCanEditSynthetics();

  const { isServiceAllowed } = useEnablement();
  const { space } = useKibanaSpace();

  const { alertStatus, updateAlertEnabledState } = useMonitorAlertEnable();

  const isActionLoading = (fields: EncryptedSyntheticsSavedMonitor) => {
    return alertStatus(fields[ConfigKey.CONFIG_ID]) === FETCH_STATUS.LOADING;
  };

  const canUsePublicLocations =
    useKibana().services?.application?.capabilities.uptime.elasticManagedLocationsEnabled ?? true;

  const isPublicLocationsAllowed = (fields: EncryptedSyntheticsSavedMonitor) => {
    const publicLocations = fields.locations.some((loc) => loc.isServiceManaged);

    return publicLocations ? Boolean(canUsePublicLocations) : true;
  };
  const LazySpaceList = spaces?.ui.components.getSpaceList ?? (() => null);

  const columns: Array<EuiBasicTableColumn<EncryptedSyntheticsSavedMonitor>> = [
    {
      align: 'left' as const,
      field: ConfigKey.NAME as string,
      name: i18n.translate('xpack.synthetics.management.monitorList.monitorName', {
        defaultMessage: 'Monitor',
      }),
      sortable: true,
      render: (_: string, monitor: EncryptedSyntheticsSavedMonitor) => (
        <MonitorDetailsLink monitor={monitor} />
      ),
    },
    // Only show Project ID column if project monitors are present
    ...(overviewStatus?.projectMonitorsCount ?? 0 > 0
      ? [
          {
            align: 'left' as const,
            field: ConfigKey.PROJECT_ID as string,
            name: i18n.translate('xpack.synthetics.management.monitorList.projectId', {
              defaultMessage: 'Project ID',
            }),
            sortable: true,
          },
        ]
      : []),
    {
      align: 'left' as const,
      field: ConfigKey.MONITOR_TYPE,
      name: i18n.translate('xpack.synthetics.management.monitorList.monitorType', {
        defaultMessage: 'Type',
      }),
      sortable: true,
      render: (_: string, monitor: EncryptedSyntheticsSavedMonitor) => (
        <MonitorTypeBadge
          monitorType={monitor[ConfigKey.MONITOR_TYPE]}
          ariaLabel={labels.getFilterForTypeMessage(monitor[ConfigKey.MONITOR_TYPE])}
          onClick={() => {
            history.push({
              search: `monitorTypes=${encodeURIComponent(
                JSON.stringify([monitor[ConfigKey.MONITOR_TYPE]])
              )}`,
            });
          }}
        />
      ),
    },
    {
      align: 'left' as const,
      field: ConfigKey.SCHEDULE,
      sortable: true,
      name: i18n.translate('xpack.synthetics.management.monitorList.frequency', {
        defaultMessage: 'Frequency',
      }),
      render: (schedule: SyntheticsMonitorSchedule) => getFrequencyLabel(schedule),
    },
    {
      align: 'left' as const,
      field: ConfigKey.LOCATIONS,
      name: i18n.translate('xpack.synthetics.management.monitorList.locations', {
        defaultMessage: 'Locations',
      }),
      render: (locations: ServiceLocations, monitor: EncryptedSyntheticsSavedMonitor) =>
        locations ? (
          <MonitorLocations
            monitorId={monitor[ConfigKey.CONFIG_ID] ?? monitor.id}
            locations={locations}
            overviewStatus={overviewStatus}
          />
        ) : null,
    },
    {
      align: 'left' as const,
      field: ConfigKey.TAGS,
      name: i18n.translate('xpack.synthetics.management.monitorList.tags', {
        defaultMessage: 'Tags',
      }),
      render: (tags: string[]) => (
        <TagsList
          tags={tags}
          onClick={(tag) => {
            history.push({ search: `tags=${encodeURIComponent(JSON.stringify([tag]))}` });
          }}
        />
      ),
    },
    {
      align: 'left' as const,
      field: ConfigKey.ENABLED as string,
      sortable: true,
      name: i18n.translate('xpack.synthetics.management.monitorList.enabled', {
        defaultMessage: 'Enabled',
      }),
      render: (_enabled: boolean, monitor: EncryptedSyntheticsSavedMonitor) => (
        <MonitorEnabled
          configId={monitor[ConfigKey.CONFIG_ID]}
          monitor={monitor}
          reloadPage={() => {}}
          isSwitchable={!loading}
        />
      ),
    },
    {
      name: i18n.translate('xpack.synthetics.management.monitorList.spacesColumnTitle', {
        defaultMessage: 'Spaces',
      }),
      field: 'spaces',
      sortable: false,
      render: (monSpaces: string[]) => {
        return (
          <LazySpaceList
            namespaces={monSpaces ?? (space ? [space?.id] : [])}
            behaviorContext="outside-space"
          />
        );
      },
    },
    {
      align: 'right' as const,
      name: i18n.translate('xpack.synthetics.management.monitorList.actions', {
        defaultMessage: 'Actions',
      }),
      actions: [
        {
          'data-test-subj': 'syntheticsMonitorEditAction',
          isPrimary: true,
          name: (fields) => (
            <NoPermissionsTooltip
              canEditSynthetics={canEditSynthetics}
              canUsePublicLocations={isPublicLocationsAllowed(fields)}
            >
              <span
                aria-label={i18n.translate('xpack.synthetics.management.monitorList.editLabel', {
                  defaultMessage: 'Edit monitor {monitorName}',
                  values: {
                    monitorName: fields[ConfigKey.NAME],
                  },
                })}
              >
                {labels.EDIT_LABEL}
              </span>
            </NoPermissionsTooltip>
          ),
          description: labels.EDIT_LABEL,
          icon: 'pencil' as const,
          type: 'icon' as const,
          enabled: (fields) =>
            canEditSynthetics &&
            !isActionLoading(fields) &&
            isPublicLocationsAllowed(fields) &&
            isServiceAllowed,
          href: (fields) => {
            const appendSpaceId = getMonitorSpaceToAppend(space, fields.spaces);
            if (!isEmpty(appendSpaceId)) {
              return http?.basePath.prepend(
                `edit-monitor/${fields[ConfigKey.CONFIG_ID]}?spaceId=${fields.spaces?.[0]}`
              )!;
            }
            return http?.basePath.prepend(`edit-monitor/${fields[ConfigKey.CONFIG_ID]}`)!;
          },
        },
        {
          'data-test-subj': 'syntheticsMonitorCopyAction',
          isPrimary: false,
          name: (fields) => (
            <NoPermissionsTooltip
              canEditSynthetics={canEditSynthetics}
              canUsePublicLocations={isPublicLocationsAllowed(fields)}
            >
              <span
                aria-label={i18n.translate('xpack.synthetics.management.monitorList.cloneLabel', {
                  defaultMessage: 'Clone monitor {monitorName}',
                  values: {
                    monitorName: fields[ConfigKey.NAME],
                  },
                })}
              >
                {labels.CLONE_LABEL}
              </span>
            </NoPermissionsTooltip>
          ),
          description: labels.CLONE_LABEL,
          icon: 'copy' as const,
          type: 'icon' as const,
          enabled: (fields) =>
            canEditSynthetics &&
            !isActionLoading(fields) &&
            isPublicLocationsAllowed(fields) &&
            isServiceAllowed,
          href: (fields) => {
            return http?.basePath.prepend(`add-monitor?cloneId=${fields[ConfigKey.CONFIG_ID]}`)!;
          },
        },
        {
          'data-test-subj': 'syntheticsMonitorDeleteAction',
          isPrimary: true,
          name: (fields) => (
            <NoPermissionsTooltip
              canEditSynthetics={canEditSynthetics}
              canUsePublicLocations={isPublicLocationsAllowed(fields)}
            >
              <span
                aria-label={i18n.translate('xpack.synthetics.management.monitorList.deleteLabel', {
                  defaultMessage: 'Delete monitor {monitorName}',
                  values: {
                    monitorName: fields[ConfigKey.NAME],
                  },
                })}
              >
                {labels.DELETE_LABEL}
              </span>
            </NoPermissionsTooltip>
          ),
          description: labels.DELETE_LABEL,
          icon: 'trash' as const,
          type: 'icon' as const,
          color: 'danger' as const,
          enabled: (fields) =>
            canEditSynthetics && !isActionLoading(fields) && isPublicLocationsAllowed(fields),
          onClick: (fields) => {
            setMonitorPendingDeletion([fields[ConfigKey.CONFIG_ID]]);
          },
        },
        {
          description: labels.DISABLE_STATUS_ALERT,
          name: (fields) => (
            <span
              aria-label={
                isStatusEnabled(fields[ConfigKey.ALERT_CONFIG])
                  ? i18n.translate('xpack.synthetics.management.monitorList.disableAlert', {
                      defaultMessage: 'Disable alert for {monitorName}',
                      values: { monitorName: fields[ConfigKey.NAME] },
                    })
                  : i18n.translate('xpack.synthetics.management.monitorList.enableAlert', {
                      defaultMessage: 'Enable alert for {monitorName}',
                      values: { monitorName: fields[ConfigKey.NAME] },
                    })
              }
            >
              {isStatusEnabled(fields[ConfigKey.ALERT_CONFIG])
                ? labels.DISABLE_STATUS_ALERT
                : labels.ENABLE_STATUS_ALERT}
            </span>
          ),
          icon: (fields) =>
            isStatusEnabled(fields[ConfigKey.ALERT_CONFIG]) ? 'bellSlash' : 'bell',
          type: 'icon' as const,
          color: 'danger' as const,
          enabled: (fields) =>
            canEditSynthetics &&
            !isActionLoading(fields) &&
            isPublicLocationsAllowed(fields) &&
            isServiceAllowed,
          onClick: (fields) => {
            updateAlertEnabledState({
              monitor: {
                [ConfigKey.ALERT_CONFIG]: toggleStatusAlert(fields[ConfigKey.ALERT_CONFIG]),
              },
              name: fields[ConfigKey.NAME],
              configId: fields[ConfigKey.CONFIG_ID],
            });
          },
        },
      ],
    },
  ];

  if (!canEditSynthetics) {
    // replace last column with a tooltip
    columns[columns.length - 1] = {
      align: 'right' as const,
      name: i18n.translate('xpack.synthetics.management.monitorList.actions', {
        defaultMessage: 'Actions',
      }),
      render: () => (
        <NoPermissionsTooltip canEditSynthetics={canEditSynthetics}>
          <EuiButtonIcon
            data-test-subj="syntheticsUseMonitorListColumnsButton"
            iconType="boxesHorizontal"
            isDisabled={true}
            aria-label={CANNOT_PERFORM_ACTION_SYNTHETICS}
          />
        </NoPermissionsTooltip>
      ),
    };
  }

  return columns;
}
