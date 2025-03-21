/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { RequestHandler } from '@kbn/core/server';
import type { TypeOf } from '@kbn/config-schema';

import Boom from '@hapi/boom';

import type {
  GetOneDownloadSourcesRequestSchema,
  PutDownloadSourcesRequestSchema,
  PostDownloadSourcesRequestSchema,
  DeleteDownloadSourcesRequestSchema,
} from '../../types';
import type {
  GetOneDownloadSourceResponse,
  DeleteDownloadSourceResponse,
  PutDownloadSourceResponse,
  GetDownloadSourceResponse,
  DownloadSource,
} from '../../../common/types';
import { downloadSourceService } from '../../services/download_source';
import { agentPolicyService } from '../../services';

function ensureNoDuplicateSecrets(downloadSource: Partial<DownloadSource>) {
  if (downloadSource.ssl?.key && downloadSource.secrets?.ssl?.key) {
    throw Boom.badRequest('Cannot specify both ssl.key and secrets.ssl.key');
  }
}

export const getDownloadSourcesHandler: RequestHandler = async (context, request, response) => {
  const soClient = (await context.core).savedObjects.client;
  const downloadSources = await downloadSourceService.list(soClient);

  const body: GetDownloadSourceResponse = {
    items: downloadSources.items,
    page: downloadSources.page,
    perPage: downloadSources.perPage,
    total: downloadSources.total,
  };

  return response.ok({ body });
};

export const getOneDownloadSourcesHandler: RequestHandler<
  TypeOf<typeof GetOneDownloadSourcesRequestSchema.params>
> = async (context, request, response) => {
  const soClient = (await context.core).savedObjects.client;
  try {
    const downloadSource = await downloadSourceService.get(soClient, request.params.sourceId);

    const body: GetOneDownloadSourceResponse = {
      item: downloadSource,
    };

    return response.ok({ body });
  } catch (error) {
    if (error.isBoom && error.output.statusCode === 404) {
      return response.notFound({
        body: { message: `Agent binary source ${request.params.sourceId} not found` },
      });
    }

    throw error;
  }
};

export const putDownloadSourcesHandler: RequestHandler<
  TypeOf<typeof PutDownloadSourcesRequestSchema.params>,
  undefined,
  TypeOf<typeof PutDownloadSourcesRequestSchema.body>
> = async (context, request, response) => {
  const coreContext = await context.core;
  const soClient = coreContext.savedObjects.client;
  const esClient = coreContext.elasticsearch.client.asInternalUser;
  ensureNoDuplicateSecrets(request.body);

  try {
    await downloadSourceService.update(soClient, esClient, request.params.sourceId, request.body);
    const downloadSource = await downloadSourceService.get(soClient, request.params.sourceId);
    if (downloadSource.is_default) {
      await agentPolicyService.bumpAllAgentPolicies(esClient);
    } else {
      await agentPolicyService.bumpAllAgentPoliciesForDownloadSource(esClient, downloadSource.id);
    }
    const body: PutDownloadSourceResponse = {
      item: downloadSource,
    };

    return response.ok({ body });
  } catch (error) {
    if (error.isBoom && error.output.statusCode === 404) {
      return response.notFound({
        body: { message: `Download source ${request.params.sourceId} not found` },
      });
    }

    throw error;
  }
};

export const postDownloadSourcesHandler: RequestHandler<
  undefined,
  undefined,
  TypeOf<typeof PostDownloadSourcesRequestSchema.body>
> = async (context, request, response) => {
  const coreContext = await context.core;
  const soClient = coreContext.savedObjects.client;
  const esClient = coreContext.elasticsearch.client.asInternalUser;
  const { id, ...data } = request.body;

  ensureNoDuplicateSecrets(data);

  const downloadSource = await downloadSourceService.create(soClient, esClient, data, { id });
  if (downloadSource.is_default) {
    await agentPolicyService.bumpAllAgentPolicies(esClient);
  }
  const body: GetOneDownloadSourceResponse = {
    item: downloadSource,
  };

  return response.ok({ body });
};

export const deleteDownloadSourcesHandler: RequestHandler<
  TypeOf<typeof DeleteDownloadSourcesRequestSchema.params>
> = async (context, request, response) => {
  const soClient = (await context.core).savedObjects.client;
  try {
    await downloadSourceService.delete(soClient, request.params.sourceId);

    const body: DeleteDownloadSourceResponse = {
      id: request.params.sourceId,
    };

    return response.ok({ body });
  } catch (error) {
    if (error.isBoom && error.output.statusCode === 404) {
      return response.notFound({
        body: { message: `Agent binary source ${request.params.sourceId} not found` },
      });
    }

    throw error;
  }
};
