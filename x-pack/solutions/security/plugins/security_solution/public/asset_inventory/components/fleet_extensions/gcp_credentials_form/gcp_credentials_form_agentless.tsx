/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiAccordion, EuiButton, EuiCodeBlock, EuiLink, EuiSpacer, EuiText } from '@elastic/eui';
import { FormattedMessage } from '@kbn/i18n-react';
import { getTemplateUrlFromPackageInfo, getAssetPolicy } from '../utils';
import {
  TEMPLATE_URL_ACCOUNT_TYPE_ENV_VAR,
  SUPPORTED_TEMPLATES_URL_FROM_PACKAGE_INFO_INPUT_VARS,
} from '../constants';
import {
  GCPSetupInfoContent,
  type GcpFormProps,
  GcpInputVarFields,
  gcpField,
  getInputVarsFields,
} from './gcp_credential_form';
import { ReadDocumentation } from '../aws_credentials_form/aws_credentials_form';
import { assetIntegrationDocsNavigation } from '../../../constants';
import { GCP_ORGANIZATION_ACCOUNT } from './constants';

const GoogleCloudShellCredentialsGuide = (props: {
  commandText: string;
  isOrganization?: boolean;
}) => {
  const GOOGLE_CLOUD_SHELL_EXTERNAL_DOC_URL = 'https://cloud.google.com/shell/docs';
  const Link = ({ children, url }: { children: React.ReactNode; url: string }) => (
    <EuiLink
      href={url}
      target="_blank"
      rel="noopener nofollow noreferrer"
      data-test-subj="externalLink"
    >
      {children}
    </EuiLink>
  );

  return (
    <>
      <EuiSpacer size="xs" />
      <EuiText size="s" color="subdued">
        <FormattedMessage
          id="xpack.securitySolution.assetInventory.fleetIntegration.googleCloudShellCredentials.guide.description"
          defaultMessage="The Google Cloud Shell Command below will generate a Service Account Credentials JSON key to set up access for assessing your GCP environment's assets. Learn more about {learnMore}."
          values={{
            learnMore: (
              <Link url={GOOGLE_CLOUD_SHELL_EXTERNAL_DOC_URL}>
                <FormattedMessage
                  id="xpack.securitySolution.assetInventory.fleetIntegration.googleCloudShellCredentials.guide.learnMoreLinkText"
                  defaultMessage="Google Cloud Shell"
                />
              </Link>
            ),
          }}
        />
        <EuiSpacer size="l" />
        <EuiText size="s" color="subdued">
          <ol>
            <li>
              <FormattedMessage
                id="xpack.securitySolution.assetInventory.fleetIntegration.googleCloudShellCredentials.guide.steps.launch"
                defaultMessage="Log into your {googleCloudConsole}"
                values={{
                  googleCloudConsole: <strong>{'Google Cloud Console'}</strong>,
                }}
              />
            </li>
            <EuiSpacer size="xs" />
            <li>
              <>
                {props?.isOrganization ? (
                  <FormattedMessage
                    id="xpack.securitySolution.assetInventory.fleetIntegration.googleCloudShellCredentials.guide.steps.copyWithOrgId"
                    defaultMessage="Replace <PROJECT_ID> and <ORG_ID_VALUE> in the following command with your project ID and organization ID then copy the command"
                    ignoreTag
                  />
                ) : (
                  <FormattedMessage
                    id="xpack.securitySolution.assetInventory.fleetIntegration.googleCloudShellCredentials.guide.steps.copyWithProjectId"
                    defaultMessage="Replace <PROJECT_ID> in the following command with your project ID then copy the command"
                    ignoreTag
                  />
                )}
                <EuiSpacer size="m" />
                <EuiCodeBlock language="bash" isCopyable contentEditable="true">
                  {props.commandText}
                </EuiCodeBlock>
              </>
            </li>
            <EuiSpacer size="xs" />
            <li>
              <FormattedMessage
                id="xpack.securitySolution.assetInventory.fleetIntegration.googleCloudShellCredentials.guide.steps.cloudShellButton"
                defaultMessage="Click the {cloudShellButton} button below and login into your account"
                values={{
                  cloudShellButton: <strong>{'Launch Google Cloud Shell'}</strong>,
                }}
                ignoreTag
              />
            </li>
            <EuiSpacer size="xs" />
            <li>
              <FormattedMessage
                id="xpack.securitySolution.assetInventory.fleetIntegration.googleCloudShellCredentials.guide.steps.confirmation"
                defaultMessage="Check {trustRepo} and click {confirmButton}"
                values={{
                  confirmButton: <strong>{'Confirm'}</strong>,
                  trustRepo: <em>{'Trust Repo'}</em>,
                }}
                ignoreTag
              />
            </li>
            <EuiSpacer size="xs" />
            <li>
              <FormattedMessage
                id="xpack.securitySolution.assetInventory.fleetIntegration.googleCloudShellCredentials.guide.steps.runCloudShellScript"
                defaultMessage="Paste and run command in the {googleCloudShell} terminal"
                values={{
                  googleCloudShell: <strong>{'Google Cloud Shell'}</strong>,
                }}
                ignoreTag
              />
            </li>
            <EuiSpacer size="xs" />
            <li>
              <FormattedMessage
                id="xpack.securitySolution.assetInventory.fleetIntegration.googleCloudShellCredentials.guide.steps.copyJsonServiceKey"
                defaultMessage="Run {catCommand} to view the service account key. Copy and paste Credentials JSON below"
                values={{
                  catCommand: <code>{'cat KEY_FILE.json'}</code>,
                }}
                ignoreTag
              />
            </li>
          </ol>
        </EuiText>
      </EuiText>
    </>
  );
};

export const GcpCredentialsFormAgentless = ({
  input,
  newPolicy,
  updatePolicy,
  disabled,
  packageInfo,
  hasInvalidRequiredVars,
}: GcpFormProps) => {
  const accountType = input.streams?.[0]?.vars?.['gcp.account_type']?.value;
  const isOrganization = accountType === GCP_ORGANIZATION_ACCOUNT;
  const organizationFields = ['gcp.organization_id', 'gcp.credentials.json'];
  const singleAccountFields = ['gcp.project_id', 'gcp.credentials.json'];

  /*
    For Agentless only JSON credentials type is supported.
    Also in case of organisation setup, project_id is not required in contrast to Agent-based.
   */
  const fields = getInputVarsFields(input, gcpField.fields).filter((field) => {
    if (isOrganization) {
      return organizationFields.includes(field.id);
    } else {
      return singleAccountFields.includes(field.id);
    }
  });

  const cloudShellUrl = getTemplateUrlFromPackageInfo(
    packageInfo,
    input.policy_template,
    SUPPORTED_TEMPLATES_URL_FROM_PACKAGE_INFO_INPUT_VARS.CLOUD_SHELL_URL
  )?.replace(TEMPLATE_URL_ACCOUNT_TYPE_ENV_VAR, accountType);

  const commandText = `gcloud config set project ${
    isOrganization ? `<PROJECT_ID> && ORG_ID=<ORG_ID_VALUE>` : `<PROJECT_ID>`
  } && ./deploy_service_account.sh`;

  return (
    <>
      <GCPSetupInfoContent isAgentless={true} />
      <EuiSpacer size="m" />
      <EuiSpacer size="m" />
      <EuiAccordion
        id="cloudShellAccordianInstructions"
        data-test-subj="launchGoogleCloudShellAccordianInstructions"
        buttonContent={<EuiLink>{'Steps to Generate GCP Account Credentials'}</EuiLink>}
        paddingSize="l"
      >
        <GoogleCloudShellCredentialsGuide
          isOrganization={isOrganization}
          commandText={commandText}
        />
      </EuiAccordion>
      <EuiSpacer size="l" />
      <EuiButton
        data-test-subj="launchGoogleCloudShellAgentlessButton"
        target="_blank"
        iconSide="left"
        iconType="launch"
        href={cloudShellUrl}
      >
        <FormattedMessage
          id="xpack.securitySolution.assetInventory.fleetIntegration.agentlessForm.googleCloudShell.cloudCredentials.button"
          defaultMessage="Launch Google Cloud Shell"
        />
      </EuiButton>
      <EuiSpacer size="l" />
      <GcpInputVarFields
        disabled={disabled}
        fields={fields}
        onChange={(key, value) =>
          updatePolicy(getAssetPolicy(newPolicy, input.type, { [key]: { value } }))
        }
        isOrganization={isOrganization}
        packageInfo={packageInfo}
        hasInvalidRequiredVars={hasInvalidRequiredVars}
      />
      <EuiSpacer size="s" />
      <ReadDocumentation url={assetIntegrationDocsNavigation.gcpGetStartedPath} />
      <EuiSpacer />
    </>
  );
};
