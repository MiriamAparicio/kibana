/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { PureComponent } from 'react';
import { FormattedMessage } from '@kbn/i18n-react';

import {
  EuiButtonEmpty,
  EuiCodeBlock,
  EuiFlyout,
  EuiFlyoutBody,
  EuiFlyoutFooter,
  EuiFlyoutHeader,
  EuiSpacer,
  EuiText,
  EuiTitle,
  htmlIdGenerator,
} from '@elastic/eui';

import { ClusterPayload, serializeCluster } from '../../../../../../common/lib';
import { SNIFF_MODE, PROXY_MODE } from '../../../../../../common/constants';

interface Props {
  close: () => void;
  cluster: ClusterPayload;
  previousClusterMode?: typeof PROXY_MODE | typeof SNIFF_MODE;
}

export class RequestFlyout extends PureComponent<Props> {
  render() {
    const { close, cluster } = this.props;
    const { name } = cluster;
    const endpoint = 'PUT _cluster/settings';
    const payload = JSON.stringify(
      serializeCluster(cluster, this.props.previousClusterMode),
      null,
      2
    );
    const request = `${endpoint}\n${payload}`;

    const flyoutTitleId = htmlIdGenerator()('requestFlyoutTitle');

    return (
      <EuiFlyout maxWidth={480} onClose={close} aria-labelledby={flyoutTitleId}>
        <EuiFlyoutHeader>
          <EuiTitle data-test-subj="remoteClusterRequestFlyoutTitle">
            <h2 id={flyoutTitleId}>
              {name ? (
                <FormattedMessage
                  id="xpack.remoteClusters.requestFlyout.namedTitle"
                  defaultMessage="Request for ''{name}''"
                  values={{ name }}
                />
              ) : (
                <FormattedMessage
                  id="xpack.remoteClusters.requestFlyout.unnamedTitle"
                  defaultMessage="Request"
                />
              )}
            </h2>
          </EuiTitle>
        </EuiFlyoutHeader>

        <EuiFlyoutBody>
          <EuiText>
            <p>
              <FormattedMessage
                id="xpack.remoteClusters.requestFlyout.descriptionText"
                defaultMessage="This Elasticsearch request will create or update this remote cluster."
              />
            </p>
          </EuiText>

          <EuiSpacer />

          <EuiCodeBlock language="json" isCopyable>
            {request}
          </EuiCodeBlock>
        </EuiFlyoutBody>

        <EuiFlyoutFooter>
          <EuiButtonEmpty iconType="cross" onClick={close} flush="left">
            <FormattedMessage
              id="xpack.remoteClusters.requestFlyout.closeButtonLabel"
              defaultMessage="Close"
            />
          </EuiButtonEmpty>
        </EuiFlyoutFooter>
      </EuiFlyout>
    );
  }
}
