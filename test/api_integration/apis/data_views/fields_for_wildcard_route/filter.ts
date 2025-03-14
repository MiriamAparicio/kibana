/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import {
  ELASTIC_HTTP_VERSION_HEADER,
  X_ELASTIC_INTERNAL_ORIGIN_REQUEST,
} from '@kbn/core-http-common';
import { INITIAL_REST_VERSION_INTERNAL } from '@kbn/data-views-plugin/server/constants';
import { FIELDS_FOR_WILDCARD_PATH } from '@kbn/data-views-plugin/common/constants';
import expect from '@kbn/expect';
import { FtrProviderContext } from '../../../ftr_provider_context';

export default function ({ getService }: FtrProviderContext) {
  const supertest = getService('supertest');
  const es = getService('es');

  describe('filter fields', () => {
    before(async () => {
      await es.index({
        index: 'helloworld1',
        refresh: true,
        id: 'helloworld',
        document: { hello: 'world' },
      });

      await es.index({
        index: 'helloworld2',
        refresh: true,
        id: 'helloworld2',
        document: { bye: 'world' },
      });
    });

    it('can filter', async () => {
      const a = await supertest
        .put(FIELDS_FOR_WILDCARD_PATH)
        .set(ELASTIC_HTTP_VERSION_HEADER, INITIAL_REST_VERSION_INTERNAL)
        .set(X_ELASTIC_INTERNAL_ORIGIN_REQUEST, 'kibana')
        .query({ pattern: 'helloworld*' })
        .send({ index_filter: { exists: { field: 'bye' } } });

      const fieldNames = a.body.fields.map((fld: { name: string }) => fld.name);

      expect(fieldNames.indexOf('bye') > -1).to.be(true);
      expect(fieldNames.indexOf('hello') === -1).to.be(true);
    });
  });
}
