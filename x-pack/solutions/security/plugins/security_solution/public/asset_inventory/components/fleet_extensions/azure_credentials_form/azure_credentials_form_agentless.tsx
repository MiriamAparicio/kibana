/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';

import { EuiLink, EuiSpacer, EuiText } from '@elastic/eui';
import { FormattedMessage } from '@kbn/i18n-react';
import { i18n } from '@kbn/i18n';

import { assetIntegrationDocsNavigation } from '../../../constants';
import {
  type AzureCredentialsFormProps,
  AzureSetupInfoContent,
  AzureInputVarFields,
  ARM_TEMPLATE_EXTERNAL_DOC_URL,
} from './azure_credentials_form';
import { getAssetPolicy } from '../utils';
import {
  getAzureCredentialsFormOptions,
  getInputVarsFields,
} from './azure_credentials_form_options';
import { AZURE_CREDENTIALS_TYPE } from './constants';

export const AzureCredentialsFormAgentless = ({
  input,
  newPolicy,
  updatePolicy,
  packageInfo,
  hasInvalidRequiredVars,
}: AzureCredentialsFormProps) => {
  const documentationLink = assetIntegrationDocsNavigation.azureGetStartedPath;
  const options = getAzureCredentialsFormOptions();
  const group = options[AZURE_CREDENTIALS_TYPE.SERVICE_PRINCIPAL_WITH_CLIENT_SECRET];
  const fields = getInputVarsFields(input, group.fields);

  return (
    <>
      <AzureSetupInfoContent documentationLink={documentationLink} />
      <EuiSpacer size="l" />
      <AzureInputVarFields
        packageInfo={packageInfo}
        fields={fields}
        onChange={(key, value) => {
          updatePolicy(getAssetPolicy(newPolicy, input.type, { [key]: { value } }));
        }}
        hasInvalidRequiredVars={hasInvalidRequiredVars}
      />
      <EuiSpacer size="m" />
      <EuiText color="subdued" size="s">
        <FormattedMessage
          id="xpack.securitySolution.assetInventory.fleetIntegration.azureIntegration.armTemplateSetupNote"
          defaultMessage="Read the {documentation} for more details"
          values={{
            documentation: (
              <EuiLink
                href={ARM_TEMPLATE_EXTERNAL_DOC_URL}
                target="_blank"
                rel="noopener nofollow noreferrer"
                data-test-subj="externalLink"
              >
                {i18n.translate(
                  'xpack.securitySolution.assetInventory.fleetIntegration.azureIntegration.documentationLinkText',
                  {
                    defaultMessage: 'documentation',
                  }
                )}
              </EuiLink>
            ),
          }}
        />
      </EuiText>
    </>
  );
};
