/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ConstructorOptions } from '../../../../rules_client/rules_client';
import { RulesClient } from '../../../../rules_client/rules_client';
import {
  savedObjectsClientMock,
  loggingSystemMock,
  savedObjectsRepositoryMock,
  uiSettingsServiceMock,
} from '@kbn/core/server/mocks';
import { taskManagerMock } from '@kbn/task-manager-plugin/server/mocks';
import { ruleTypeRegistryMock } from '../../../../rule_type_registry.mock';
import { alertingAuthorizationMock } from '../../../../authorization/alerting_authorization.mock';
import { encryptedSavedObjectsMock } from '@kbn/encrypted-saved-objects-plugin/server/mocks';
import { actionsAuthorizationMock } from '@kbn/actions-plugin/server/mocks';
import type { AlertingAuthorization } from '../../../../authorization/alerting_authorization';
import type { ActionsAuthorization } from '@kbn/actions-plugin/server';
import { auditLoggerMock } from '@kbn/security-plugin/server/audit/mocks';
import { getBeforeSetup, setGlobalDate } from '../../../../rules_client/tests/lib';
import { bulkMarkApiKeysForInvalidation } from '../../../../invalidate_pending_api_keys/bulk_mark_api_keys_for_invalidation';
import { ConnectorAdapterRegistry } from '../../../../connector_adapters/connector_adapter_registry';
import { RULE_SAVED_OBJECT_TYPE } from '../../../../saved_objects';
import { backfillClientMock } from '../../../../backfill_client/backfill_client.mock';

jest.mock('../../../../invalidate_pending_api_keys/bulk_mark_api_keys_for_invalidation', () => ({
  bulkMarkApiKeysForInvalidation: jest.fn(),
}));

const bulkMarkApiKeysForInvalidationMock = bulkMarkApiKeysForInvalidation as jest.Mock;
const taskManager = taskManagerMock.createStart();
const ruleTypeRegistry = ruleTypeRegistryMock.create();
const unsecuredSavedObjectsClient = savedObjectsClientMock.create();
const encryptedSavedObjects = encryptedSavedObjectsMock.createClient();
const authorization = alertingAuthorizationMock.create();
const actionsAuthorization = actionsAuthorizationMock.create();
const auditLogger = auditLoggerMock.create();
const internalSavedObjectsRepository = savedObjectsRepositoryMock.create();

const kibanaVersion = 'v7.10.0';
const ruleName = 'fakeRuleName';

const rulesClientParams: jest.Mocked<ConstructorOptions> = {
  taskManager,
  ruleTypeRegistry,
  unsecuredSavedObjectsClient,
  authorization: authorization as unknown as AlertingAuthorization,
  actionsAuthorization: actionsAuthorization as unknown as ActionsAuthorization,
  spaceId: 'default',
  namespace: 'default',
  maxScheduledPerMinute: 10000,
  minimumScheduleInterval: { value: '1m', enforce: false },
  getUserName: jest.fn(),
  createAPIKey: jest.fn(),
  logger: loggingSystemMock.create().get(),
  internalSavedObjectsRepository,
  encryptedSavedObjectsClient: encryptedSavedObjects,
  getActionsClient: jest.fn(),
  getEventLogClient: jest.fn(),
  kibanaVersion,
  auditLogger,
  isAuthenticationTypeAPIKey: jest.fn(),
  getAuthenticationAPIKey: jest.fn(),
  connectorAdapterRegistry: new ConnectorAdapterRegistry(),
  getAlertIndicesAlias: jest.fn(),
  alertsService: null,
  backfillClient: backfillClientMock.create(),
  uiSettings: uiSettingsServiceMock.createStartContract(),
  isSystemAction: jest.fn(),
};

beforeEach(() => {
  getBeforeSetup(rulesClientParams, taskManager, ruleTypeRegistry);
  (auditLogger.log as jest.Mock).mockClear();
});

setGlobalDate();

describe('updateRuleApiKey()', () => {
  let rulesClient: RulesClient;
  const existingAlert = {
    id: '1',
    type: RULE_SAVED_OBJECT_TYPE,
    attributes: {
      name: ruleName,
      revision: 0,
      schedule: { interval: '10s' },
      alertTypeId: 'myType',
      consumer: 'myApp',
      enabled: true,
      actions: [
        {
          group: 'default',
          id: '1',
          actionTypeId: '1',
          actionRef: '1',
          params: {
            foo: true,
          },
        },
      ],
    },
    version: '123',
    references: [],
  };
  const existingEncryptedAlert = {
    ...existingAlert,
    attributes: {
      ...existingAlert.attributes,
      apiKey: Buffer.from('123:abc').toString('base64'),
    },
  };

  beforeEach(() => {
    rulesClient = new RulesClient(rulesClientParams);
    unsecuredSavedObjectsClient.get.mockResolvedValue(existingAlert);
    encryptedSavedObjects.getDecryptedAsInternalUser.mockResolvedValue(existingEncryptedAlert);
  });

  test('updates the API key for the alert', async () => {
    rulesClientParams.isAuthenticationTypeAPIKey.mockReturnValueOnce(false);
    rulesClientParams.createAPIKey.mockResolvedValueOnce({
      apiKeysEnabled: true,
      result: { id: '234', name: '123', api_key: 'abc' },
    });
    await rulesClient.updateRuleApiKey({ id: '1' });
    expect(unsecuredSavedObjectsClient.get).not.toHaveBeenCalled();
    expect(encryptedSavedObjects.getDecryptedAsInternalUser).toHaveBeenCalledWith(
      RULE_SAVED_OBJECT_TYPE,
      '1',
      {
        namespace: 'default',
      }
    );
    expect(unsecuredSavedObjectsClient.update).toHaveBeenCalledWith(
      RULE_SAVED_OBJECT_TYPE,
      '1',
      {
        schedule: { interval: '10s' },
        name: ruleName,
        alertTypeId: 'myType',
        consumer: 'myApp',
        enabled: true,
        apiKey: Buffer.from('234:abc').toString('base64'),
        apiKeyOwner: 'elastic',
        apiKeyCreatedByUser: false,
        revision: 0,
        updatedBy: 'elastic',
        updatedAt: '2019-02-12T21:01:22.479Z',
        actions: [
          {
            group: 'default',
            id: '1',
            actionTypeId: '1',
            actionRef: '1',
            params: {
              foo: true,
            },
          },
        ],
        meta: {
          versionApiKeyLastmodified: kibanaVersion,
        },
      },
      { version: '123' }
    );
    expect(bulkMarkApiKeysForInvalidation).toHaveBeenCalledTimes(1);
    expect(bulkMarkApiKeysForInvalidation).toHaveBeenCalledWith(
      { apiKeys: ['MTIzOmFiYw=='] },
      expect.any(Object),
      expect.any(Object)
    );
  });

  test('updates the API key for the alert and does not invalidate the old api key if created by a user authenticated using an api key', async () => {
    encryptedSavedObjects.getDecryptedAsInternalUser.mockResolvedValue({
      ...existingEncryptedAlert,
      attributes: {
        ...existingEncryptedAlert.attributes,
        apiKeyCreatedByUser: true,
      },
    });
    rulesClientParams.isAuthenticationTypeAPIKey.mockReturnValueOnce(false);
    rulesClientParams.createAPIKey.mockResolvedValueOnce({
      apiKeysEnabled: true,
      result: { id: '234', name: '123', api_key: 'abc' },
    });
    await rulesClient.updateRuleApiKey({ id: '1' });
    expect(unsecuredSavedObjectsClient.get).not.toHaveBeenCalled();
    expect(encryptedSavedObjects.getDecryptedAsInternalUser).toHaveBeenCalledWith(
      RULE_SAVED_OBJECT_TYPE,
      '1',
      {
        namespace: 'default',
      }
    );
    expect(unsecuredSavedObjectsClient.update).toHaveBeenCalledWith(
      RULE_SAVED_OBJECT_TYPE,
      '1',
      {
        schedule: { interval: '10s' },
        name: ruleName,
        alertTypeId: 'myType',
        consumer: 'myApp',
        enabled: true,
        apiKey: Buffer.from('234:abc').toString('base64'),
        apiKeyOwner: 'elastic',
        apiKeyCreatedByUser: false,
        revision: 0,
        updatedBy: 'elastic',
        updatedAt: '2019-02-12T21:01:22.479Z',
        actions: [
          {
            group: 'default',
            id: '1',
            actionTypeId: '1',
            actionRef: '1',
            params: {
              foo: true,
            },
          },
        ],
        meta: {
          versionApiKeyLastmodified: kibanaVersion,
        },
      },
      { version: '123' }
    );
    expect(bulkMarkApiKeysForInvalidation).not.toHaveBeenCalled();
  });

  test('calls the authentication API key function if the user is authenticated using an api key', async () => {
    encryptedSavedObjects.getDecryptedAsInternalUser.mockResolvedValue({
      ...existingEncryptedAlert,
      attributes: {
        ...existingEncryptedAlert.attributes,
        apiKeyCreatedByUser: true,
      },
    });
    rulesClientParams.isAuthenticationTypeAPIKey.mockReturnValueOnce(true);
    rulesClientParams.getAuthenticationAPIKey.mockReturnValueOnce({
      apiKeysEnabled: true,
      result: { id: '234', name: '123', api_key: 'abc' },
    });
    await rulesClient.updateRuleApiKey({ id: '1' });
    expect(unsecuredSavedObjectsClient.get).not.toHaveBeenCalled();
    expect(encryptedSavedObjects.getDecryptedAsInternalUser).toHaveBeenCalledWith(
      RULE_SAVED_OBJECT_TYPE,
      '1',
      {
        namespace: 'default',
      }
    );
    expect(unsecuredSavedObjectsClient.update).toHaveBeenCalledWith(
      RULE_SAVED_OBJECT_TYPE,
      '1',
      {
        schedule: { interval: '10s' },
        name: ruleName,
        alertTypeId: 'myType',
        consumer: 'myApp',
        enabled: true,
        apiKey: Buffer.from('234:abc').toString('base64'),
        apiKeyOwner: 'elastic',
        apiKeyCreatedByUser: true,
        revision: 0,
        updatedBy: 'elastic',
        updatedAt: '2019-02-12T21:01:22.479Z',
        actions: [
          {
            group: 'default',
            id: '1',
            actionTypeId: '1',
            actionRef: '1',
            params: {
              foo: true,
            },
          },
        ],
        meta: {
          versionApiKeyLastmodified: kibanaVersion,
        },
      },
      { version: '123' }
    );
    expect(bulkMarkApiKeysForInvalidation).not.toHaveBeenCalled();
  });

  test('throws an error if API key creation throws', async () => {
    rulesClientParams.createAPIKey.mockImplementation(() => {
      throw new Error('no');
    });
    await expect(
      async () => await rulesClient.updateRuleApiKey({ id: '1' })
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Error updating API key for rule: could not create API key - no"`
    );
  });

  test('throws an error if API params do not match the schema', async () => {
    await expect(
      // @ts-ignore: this is what we are testing
      async () => await rulesClient.updateRuleApiKey({ id: 1 })
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Error validating update api key parameters - [id]: expected value of type [string] but got [number]"`
    );
  });

  test('falls back to SOC when getDecryptedAsInternalUser throws an error', async () => {
    rulesClientParams.createAPIKey.mockResolvedValueOnce({
      apiKeysEnabled: true,
      result: { id: '234', name: '123', api_key: 'abc' },
    });
    encryptedSavedObjects.getDecryptedAsInternalUser.mockRejectedValueOnce(new Error('Fail'));

    await rulesClient.updateRuleApiKey({ id: '1' });
    expect(unsecuredSavedObjectsClient.get).toHaveBeenCalledWith(RULE_SAVED_OBJECT_TYPE, '1');
    expect(encryptedSavedObjects.getDecryptedAsInternalUser).toHaveBeenCalledWith(
      RULE_SAVED_OBJECT_TYPE,
      '1',
      {
        namespace: 'default',
      }
    );
    expect(unsecuredSavedObjectsClient.update).toHaveBeenCalledWith(
      RULE_SAVED_OBJECT_TYPE,
      '1',
      {
        schedule: { interval: '10s' },
        name: ruleName,
        alertTypeId: 'myType',
        consumer: 'myApp',
        enabled: true,
        apiKey: Buffer.from('234:abc').toString('base64'),
        apiKeyOwner: 'elastic',
        revision: 0,
        updatedAt: '2019-02-12T21:01:22.479Z',
        updatedBy: 'elastic',
        actions: [
          {
            group: 'default',
            id: '1',
            actionTypeId: '1',
            actionRef: '1',
            params: {
              foo: true,
            },
          },
        ],
        meta: {
          versionApiKeyLastmodified: kibanaVersion,
        },
      },
      { version: '123' }
    );
    expect(unsecuredSavedObjectsClient.create).not.toHaveBeenCalled();
  });

  test('swallows error when invalidate API key throws', async () => {
    bulkMarkApiKeysForInvalidationMock.mockImplementationOnce(() => new Error('Fail'));

    await rulesClient.updateRuleApiKey({ id: '1' });
    expect(unsecuredSavedObjectsClient.update).toHaveBeenCalled();
    expect(bulkMarkApiKeysForInvalidation).toHaveBeenCalledTimes(1);
    expect(bulkMarkApiKeysForInvalidation).toHaveBeenCalledWith(
      { apiKeys: ['MTIzOmFiYw=='] },
      expect.any(Object),
      expect.any(Object)
    );
  });

  test('swallows error when getting decrypted object throws', async () => {
    encryptedSavedObjects.getDecryptedAsInternalUser.mockRejectedValueOnce(new Error('Fail'));

    await rulesClient.updateRuleApiKey({ id: '1' });
    expect(rulesClientParams.logger.error).toHaveBeenCalledWith(
      'updateApiKey(): Failed to load API key to invalidate on alert 1: Fail'
    );
    expect(unsecuredSavedObjectsClient.update).toHaveBeenCalled();
  });

  test('throws when unsecuredSavedObjectsClient update fails and invalidates newly created API key', async () => {
    rulesClientParams.createAPIKey.mockResolvedValueOnce({
      apiKeysEnabled: true,
      result: { id: '234', name: '234', api_key: 'abc' },
    });
    unsecuredSavedObjectsClient.update.mockRejectedValueOnce(new Error('Fail'));

    await expect(
      rulesClient.updateRuleApiKey({ id: '1' })
    ).rejects.toThrowErrorMatchingInlineSnapshot(`"Fail"`);
    expect(bulkMarkApiKeysForInvalidation).toHaveBeenCalledTimes(1);
    expect(bulkMarkApiKeysForInvalidation).toHaveBeenCalledWith(
      { apiKeys: ['MjM0OmFiYw=='] },
      expect.any(Object),
      expect.any(Object)
    );
  });

  describe('authorization', () => {
    test('ensures user is authorised to updateRuleApiKey this type of alert under the consumer', async () => {
      await rulesClient.updateRuleApiKey({ id: '1' });

      expect(actionsAuthorization.ensureAuthorized).toHaveBeenCalledWith({ operation: 'execute' });
      expect(authorization.ensureAuthorized).toHaveBeenCalledWith({
        entity: 'rule',
        consumer: 'myApp',
        operation: 'updateApiKey',
        ruleTypeId: 'myType',
      });
    });

    test('throws when user is not authorised to updateRuleApiKey this type of alert', async () => {
      authorization.ensureAuthorized.mockRejectedValue(
        new Error(`Unauthorized to updateRuleApiKey a "myType" alert for "myApp"`)
      );

      await expect(rulesClient.updateRuleApiKey({ id: '1' })).rejects.toMatchInlineSnapshot(
        `[Error: Unauthorized to updateRuleApiKey a "myType" alert for "myApp"]`
      );

      expect(authorization.ensureAuthorized).toHaveBeenCalledWith({
        entity: 'rule',
        consumer: 'myApp',
        operation: 'updateApiKey',
        ruleTypeId: 'myType',
      });
    });
  });

  describe('auditLogger', () => {
    test('logs audit event when updating the API key of a rule', async () => {
      await rulesClient.updateRuleApiKey({ id: '1' });

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({
            action: 'rule_update_api_key',
            outcome: 'unknown',
          }),
          kibana: {
            saved_object: { id: '1', type: RULE_SAVED_OBJECT_TYPE, name: ruleName },
          },
        })
      );
    });

    test('logs audit event when not authorised to update the API key of a rule', async () => {
      authorization.ensureAuthorized.mockRejectedValue(new Error('Unauthorized'));

      await expect(rulesClient.updateRuleApiKey({ id: '1' })).rejects.toThrow();
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({
            outcome: 'failure',
            action: 'rule_update_api_key',
          }),
          kibana: {
            saved_object: {
              id: '1',
              type: RULE_SAVED_OBJECT_TYPE,
              name: ruleName,
            },
          },
          error: {
            code: 'Error',
            message: 'Unauthorized',
          },
        })
      );
    });
  });
});
