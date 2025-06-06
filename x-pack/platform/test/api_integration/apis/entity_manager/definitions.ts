/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import semver from 'semver';
import expect from '@kbn/expect';
import { entityLatestSchema } from '@kbn/entities-schema';
import { entityDefinition as mockDefinition } from '@kbn/entityManager-plugin/server/lib/entities/helpers/fixtures';
import { PartialConfig, cleanup, generate } from '@kbn/data-forge';
import { generateLatestIndexName } from '@kbn/entityManager-plugin/server/lib/entities/helpers/generate_component_id';
import { FtrProviderContext } from '../../ftr_provider_context';
import {
  installDefinition,
  uninstallDefinition,
  updateDefinition,
  getInstalledDefinitions,
} from './helpers/request';

export default function ({ getService }: FtrProviderContext) {
  const supertest = getService('supertest');
  const logger = getService('log');
  const esClient = getService('es');
  const esDeleteAllIndices = getService('esDeleteAllIndices');
  const alertingApi = getService('alertingApi');

  describe('Entity definitions', () => {
    describe('definitions installations', () => {
      it('can install multiple definitions', async () => {
        const mockDefinitionDup = { ...mockDefinition, id: 'mock_definition_dup' };
        await installDefinition(supertest, { definition: mockDefinition });
        await installDefinition(supertest, { definition: mockDefinitionDup });

        const { definitions } = await getInstalledDefinitions(supertest);
        expect(definitions.length).to.eql(2);
        expect(
          definitions.some(
            (definition) =>
              definition.id === mockDefinition.id &&
              definition.state.installed === true &&
              definition.state.running === true
          )
        ).to.eql(true);
        expect(
          definitions.some(
            (definition) =>
              definition.id === mockDefinitionDup.id &&
              definition.state.installed === true &&
              definition.state.running === true
          )
        ).to.eql(true);

        await Promise.all([
          uninstallDefinition(supertest, { id: mockDefinition.id, deleteData: true }),
          uninstallDefinition(supertest, { id: mockDefinitionDup.id, deleteData: true }),
        ]);
      });

      it('does not start transforms when specified', async () => {
        await installDefinition(supertest, { definition: mockDefinition, installOnly: true });

        const { definitions } = await getInstalledDefinitions(supertest);
        expect(definitions.length).to.eql(1);
        expect(definitions[0].state.installed).to.eql(true);
        expect(definitions[0].state.running).to.eql(false);

        await uninstallDefinition(supertest, { id: mockDefinition.id });
      });
    });

    describe('definitions update', () => {
      it('returns 404 if the definitions does not exist', async () => {
        await updateDefinition(supertest, {
          id: 'i-dont-exist',
          update: { version: '1.0.0' },
          expectedCode: 404,
        });
      });

      it('accepts partial updates', async () => {
        const incVersion = semver.inc(mockDefinition.version, 'major');
        await installDefinition(supertest, { definition: mockDefinition, installOnly: true });
        await updateDefinition(supertest, {
          id: mockDefinition.id,
          update: {
            version: incVersion!,
            latest: {
              timestampField: '@updatedTimestampField',
            },
          },
        });

        const {
          definitions: [updatedDefinition],
        } = await getInstalledDefinitions(supertest);
        expect(updatedDefinition.version).to.eql(incVersion);
        expect(updatedDefinition.latest.timestampField).to.eql('@updatedTimestampField');

        await uninstallDefinition(supertest, { id: mockDefinition.id });
      });
    });

    describe('entity data', () => {
      let dataForgeConfig: PartialConfig;
      let dataForgeIndices: string[];

      before(async () => {
        dataForgeConfig = {
          indexing: {
            dataset: 'fake_stack',
            eventsPerCycle: 100,
            interval: 60_000,
          },
          schedule: [
            {
              template: 'good',
              start: 'now-15m',
              end: 'now+5m',
            },
          ],
        };
        dataForgeIndices = await generate({ client: esClient, config: dataForgeConfig, logger });
        await alertingApi.waitForDocumentInIndex({
          esClient,
          indexName: 'kbn-data-forge-fake_stack.admin-console-*',
          docCountTarget: 2020,
        });
      });

      after(async () => {
        await esDeleteAllIndices(dataForgeIndices);
        await cleanup({ client: esClient, config: dataForgeConfig, logger });
      });

      it('should create the proper entities in the latest index', async () => {
        await installDefinition(supertest, { definition: mockDefinition });
        const sample = await alertingApi.waitForDocumentInIndex({
          esClient,
          indexName: generateLatestIndexName(mockDefinition),
          docCountTarget: 5,
        });

        const parsedSample = entityLatestSchema.safeParse(sample.hits.hits[0]._source);
        expect(parsedSample.success).to.be(true);
        expect(parsedSample.data?.entity.id).to.be('admin-console');
      });

      it('should delete entities data when specified', async () => {
        const index = generateLatestIndexName(mockDefinition);
        expect(await esClient.indices.exists({ index })).to.be(true);
        await uninstallDefinition(supertest, { id: mockDefinition.id, deleteData: true });
        expect(await esClient.indices.exists({ index })).to.be(false);
      });
    });
  });
}
