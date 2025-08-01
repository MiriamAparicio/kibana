/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import { cleanup, generate, Dataset, PartialConfig } from '@kbn/data-forge';
import type { InternalRequestHeader, RoleCredentials } from '@kbn/ftr-common-functional-services';
import { Aggregators } from '@kbn/observability-plugin/common/custom_threshold_rule/types';
import { COMPARATORS } from '@kbn/alerting-comparators';
import { FIRED_ACTIONS_ID } from '@kbn/observability-plugin/server/lib/rules/custom_threshold/constants';
import { OBSERVABILITY_THRESHOLD_RULE_TYPE_ID } from '@kbn/rule-data-utils';
import { kbnTestConfig } from '@kbn/test';
import { DeploymentAgnosticFtrProviderContext } from '../../../ftr_provider_context';
import { ActionDocument } from './types';

export default function ({ getService }: DeploymentAgnosticFtrProviderContext) {
  const esClient = getService('es');
  const samlAuth = getService('samlAuth');
  const supertestWithoutAuth = getService('supertestWithoutAuth');
  const esDeleteAllIndices = getService('esDeleteAllIndices');
  const alertingApi = getService('alertingApi');
  const dataViewApi = getService('dataViewApi');
  const logger = getService('log');
  const config = getService('config');
  const isServerless = config.get('serverless');
  const expectedConsumer = isServerless ? 'observability' : 'logs';
  let roleAuthc: RoleCredentials;
  let internalReqHeader: InternalRequestHeader;

  describe('RATE - GROUP_BY - BYTES - FIRED', () => {
    const CUSTOM_THRESHOLD_RULE_ALERT_INDEX = '.alerts-observability.threshold.alerts-default';
    const ALERT_ACTION_INDEX = 'alert-action-threshold';
    const DATE_VIEW = 'kbn-data-forge-fake_hosts.fake_hosts-*';
    const DATA_VIEW_ID = 'data-view-id';
    let dataForgeConfig: PartialConfig;
    let dataForgeIndices: string[];
    let actionId: string;
    let ruleId: string;
    let alertId: string;

    before(async () => {
      roleAuthc = await samlAuth.createM2mApiKeyWithRoleScope('admin');
      internalReqHeader = samlAuth.getInternalRequestHeader();
      dataForgeConfig = {
        schedule: [
          {
            template: 'good',
            start: 'now-10m',
            end: 'now+5m',
            metrics: [
              { name: 'system.network.in.bytes', method: 'linear', start: 0, end: 54000000 },
            ],
          },
        ],
        indexing: {
          dataset: 'fake_hosts' as Dataset,
          eventsPerCycle: 1,
          interval: 10000,
          alignEventsToInterval: true,
        },
      };
      dataForgeIndices = await generate({ client: esClient, config: dataForgeConfig, logger });
      await alertingApi.waitForDocumentInIndex({
        indexName: dataForgeIndices.join(','),
        docCountTarget: 270,
      });
      await dataViewApi.create({
        name: DATE_VIEW,
        id: DATA_VIEW_ID,
        title: DATE_VIEW,
        roleAuthc,
      });
    });

    after(async () => {
      await supertestWithoutAuth
        .delete(`/api/alerting/rule/${ruleId}`)
        .set(roleAuthc.apiKeyHeader)
        .set(internalReqHeader);
      await supertestWithoutAuth
        .delete(`/api/actions/connector/${actionId}`)
        .set(roleAuthc.apiKeyHeader)
        .set(internalReqHeader);
      await esClient.deleteByQuery({
        index: CUSTOM_THRESHOLD_RULE_ALERT_INDEX,
        query: { term: { 'kibana.alert.rule.uuid': ruleId } },
      });
      await esClient.deleteByQuery({
        index: '.kibana-event-log-*',
        query: { term: { 'kibana.alert.rule.consumer': expectedConsumer } },
      });
      await dataViewApi.delete({
        id: DATA_VIEW_ID,
        roleAuthc,
      });
      await esDeleteAllIndices([ALERT_ACTION_INDEX, ...dataForgeIndices]);
      await cleanup({ client: esClient, config: dataForgeConfig, logger });
      await samlAuth.invalidateM2mApiKeyWithRoleScope(roleAuthc);
    });

    describe('Rule creation', () => {
      it('creates rule successfully', async () => {
        actionId = await alertingApi.createIndexConnector({
          roleAuthc,
          name: 'Index Connector: Threshold API test',
          indexName: ALERT_ACTION_INDEX,
        });

        const createdRule = await alertingApi.createRule({
          roleAuthc,
          tags: ['observability'],
          consumer: expectedConsumer,
          name: 'Threshold rule',
          ruleTypeId: OBSERVABILITY_THRESHOLD_RULE_TYPE_ID,
          params: {
            criteria: [
              {
                comparator: COMPARATORS.GREATER_THAN_OR_EQUALS,
                threshold: [50_000],
                timeSize: 1,
                timeUnit: 'm',
                metrics: [
                  { name: 'A', field: 'system.network.in.bytes', aggType: Aggregators.RATE },
                ],
              },
            ],
            alertOnNoData: true,
            alertOnGroupDisappear: true,
            searchConfiguration: {
              query: {
                query: '',
                language: 'kuery',
              },
              index: DATA_VIEW_ID,
            },
            groupBy: ['host.name', 'container.id'],
          },
          actions: [
            {
              group: FIRED_ACTIONS_ID,
              id: actionId,
              params: {
                documents: [
                  {
                    ruleType: '{{rule.type}}',
                    alertDetailsUrl: '{{context.alertDetailsUrl}}',
                    reason: '{{context.reason}}',
                    value: '{{context.value}}',
                    host: '{{context.host}}',
                    group: '{{context.group}}',
                    grouping: '{{context.grouping}}',
                  },
                ],
              },
              frequency: {
                notify_when: 'onActionGroupChange',
                throttle: null,
                summary: false,
              },
            },
          ],
        });
        ruleId = createdRule.id;
        expect(ruleId).not.to.be(undefined);
      });

      it('should be active', async () => {
        const executionStatus = await alertingApi.waitForRuleStatus({
          roleAuthc,
          ruleId,
          expectedStatus: 'active',
        });
        expect(executionStatus).to.be('active');
      });

      it('should set correct information in the alert document', async () => {
        const resp = await alertingApi.waitForAlertInIndex({
          indexName: CUSTOM_THRESHOLD_RULE_ALERT_INDEX,
          ruleId,
        });
        alertId = (resp.hits.hits[0]._source as any)['kibana.alert.uuid'];

        expect(resp.hits.hits[0]._source).property(
          'kibana.alert.rule.category',
          'Custom threshold'
        );
        expect(resp.hits.hits[0]._source).property('kibana.alert.rule.consumer', expectedConsumer);
        expect(resp.hits.hits[0]._source).property('kibana.alert.rule.name', 'Threshold rule');
        expect(resp.hits.hits[0]._source).property('kibana.alert.rule.producer', 'observability');
        expect(resp.hits.hits[0]._source).property('kibana.alert.rule.revision', 0);
        expect(resp.hits.hits[0]._source).property(
          'kibana.alert.rule.rule_type_id',
          'observability.rules.custom_threshold'
        );
        expect(resp.hits.hits[0]._source).property('kibana.alert.rule.uuid', ruleId);
        expect(resp.hits.hits[0]._source).property('kibana.space_ids').contain('default');
        expect(resp.hits.hits[0]._source)
          .property('kibana.alert.rule.tags')
          .contain('observability');
        expect(resp.hits.hits[0]._source).property(
          'kibana.alert.action_group',
          'custom_threshold.fired'
        );
        expect(resp.hits.hits[0]._source).property('tags').contain('observability');
        expect(resp.hits.hits[0]._source).property(
          'kibana.alert.instance.id',
          'host-0,container-0'
        );
        expect(resp.hits.hits[0]._source).property('kibana.alert.workflow_status', 'open');
        expect(resp.hits.hits[0]._source).property('event.kind', 'signal');
        expect(resp.hits.hits[0]._source).property('event.action', 'open');

        expect(resp.hits.hits[0]._source).property('host.name', 'host-0');
        expect(resp.hits.hits[0]._source)
          .property('host.mac')
          .eql(['00-00-5E-00-53-23', '00-00-5E-00-53-24']);
        expect(resp.hits.hits[0]._source).property('container.id', 'container-0');
        expect(resp.hits.hits[0]._source).property('container.name', 'container-name');
        expect(resp.hits.hits[0]._source).not.property('container.cpu');

        expect(resp.hits.hits[0]._source)
          .property('kibana.alert.group')
          .eql([
            {
              field: 'host.name',
              value: 'host-0',
            },
            {
              field: 'container.id',
              value: 'container-0',
            },
          ]);
        expect(resp.hits.hits[0]._source)
          .property('kibana.alert.grouping')
          .eql({
            host: {
              name: 'host-0',
            },
            container: {
              id: 'container-0',
            },
          });

        expect(resp.hits.hits[0]._source)
          .property('kibana.alert.rule.parameters')
          .eql({
            criteria: [
              {
                comparator: '>=',
                threshold: [50_000],
                timeSize: 1,
                timeUnit: 'm',
                metrics: [{ name: 'A', field: 'system.network.in.bytes', aggType: 'rate' }],
              },
            ],
            alertOnNoData: true,
            alertOnGroupDisappear: true,
            searchConfiguration: { index: 'data-view-id', query: { query: '', language: 'kuery' } },
            groupBy: ['host.name', 'container.id'],
          });
      });

      it('should set correct action variables', async () => {
        const resp = await alertingApi.waitForDocumentInIndex<ActionDocument>({
          indexName: ALERT_ACTION_INDEX,
          docCountTarget: 1,
        });

        const { protocol, hostname, port } = kbnTestConfig.getUrlPartsWithStrippedDefaultPort();
        expect(resp.hits.hits[0]._source?.ruleType).eql('observability.rules.custom_threshold');
        expect(resp.hits.hits[0]._source?.alertDetailsUrl).eql(
          `${protocol}://${hostname}${port ? `:${port}` : ''}/app/observability/alerts/${alertId}`
        );
        expect(resp.hits.hits[0]._source?.reason).eql(
          `Rate of system.network.in.bytes is 60 kB/s, above or equal the threshold of 50 kB/s. (duration: 1 min, data view: kbn-data-forge-fake_hosts.fake_hosts-*, group: host-0,container-0)`
        );
        expect(resp.hits.hits[0]._source?.value).eql('60 kB/s');
        expect(resp.hits.hits[0]._source?.host).eql(
          '{"name":"host-0","mac":["00-00-5E-00-53-23","00-00-5E-00-53-24"]}'
        );
        expect(resp.hits.hits[0]._source?.group).eql(
          '{"field":"host.name","value":"host-0"},{"field":"container.id","value":"container-0"}'
        );
        expect(resp.hits.hits[0]._source?.grouping).eql(
          '{"host":{"name":"host-0"},"container":{"id":"container-0"}}'
        );
      });
    });
  });
}
