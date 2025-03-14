/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiBadge, EuiFlexGroup, EuiFlexItem, EuiToolTip } from '@elastic/eui';
import React, { useCallback, useMemo } from 'react';
import styled from 'styled-components';

import type { DraggableWrapperProps } from '../../../../../../common/components/drag_and_drop/draggable_wrapper';
import { DraggableWrapper } from '../../../../../../common/components/drag_and_drop/draggable_wrapper';
import { escapeDataProviderId } from '../../../../../../common/components/drag_and_drop/helpers';
import { GoogleLink } from '../../../../../../common/components/links';

import { TokensFlexItem } from '../helpers';
import { getBeginningTokens } from './suricata_links';
import { DefaultDraggable } from '../../../../../../common/components/draggables';
import type { QueryOperator } from '../../../data_providers/data_provider';
import { IS_OPERATOR } from '../../../data_providers/data_provider';

export const SURICATA_SIGNATURE_FIELD_NAME = 'suricata.eve.alert.signature';
export const SURICATA_SIGNATURE_ID_FIELD_NAME = 'suricata.eve.alert.signature_id';

const SignatureFlexItem = styled(EuiFlexItem)`
  min-width: 77px;
`;

SignatureFlexItem.displayName = 'SignatureFlexItem';

const Badge = styled(EuiBadge)`
  vertical-align: top;
` as unknown as typeof EuiBadge;

Badge.displayName = 'Badge';

const LinkFlexItem = styled(EuiFlexItem)`
  margin-left: 6px;
`;

LinkFlexItem.displayName = 'LinkFlexItem';

export const Tokens = React.memo<{ tokens: string[] }>(({ tokens }) => (
  <>
    {tokens.map((token) => (
      <TokensFlexItem key={token} grow={false}>
        <EuiBadge iconType="tag" color="hollow" title="">
          {token}
        </EuiBadge>
      </TokensFlexItem>
    ))}
  </>
));

Tokens.displayName = 'Tokens';

export const DraggableSignatureId = React.memo<{
  id: string;
  signatureId: number;
}>(({ id, signatureId }) => {
  const dataProviderProp = useMemo(
    () => ({
      and: [],
      enabled: true,
      id: escapeDataProviderId(`suricata-draggable-signature-id-${id}-sig-${signatureId}`),
      name: String(signatureId),
      excluded: false,
      kqlQuery: '',
      queryMatch: {
        field: SURICATA_SIGNATURE_ID_FIELD_NAME,
        value: signatureId,
        operator: IS_OPERATOR as QueryOperator,
      },
    }),
    [id, signatureId]
  );

  const render: DraggableWrapperProps['render'] = useCallback(
    () => (
      <EuiToolTip data-test-subj="signature-id-tooltip" content={SURICATA_SIGNATURE_ID_FIELD_NAME}>
        <Badge iconType="number" color="hollow" title="">
          {signatureId}
        </Badge>
      </EuiToolTip>
    ),
    [signatureId]
  );

  return (
    <SignatureFlexItem grow={false}>
      <DraggableWrapper
        dataProvider={dataProviderProp}
        render={render}
        isAggregatable={true}
        fieldType={'keyword'}
      />
    </SignatureFlexItem>
  );
});

DraggableSignatureId.displayName = 'DraggableSignatureId';

export const SuricataSignature = React.memo<{
  contextId: string;
  id: string;
  signature: string;
  signatureId: number;
}>(({ contextId, id, signature, signatureId }) => {
  const tokens = getBeginningTokens(signature);
  return (
    <EuiFlexGroup justifyContent="center" gutterSize="none" wrap={true}>
      <DraggableSignatureId
        id={`draggable-signature-id-${contextId}-${id}`}
        signatureId={signatureId}
      />
      <Tokens tokens={tokens} />
      <LinkFlexItem grow={false}>
        <DefaultDraggable
          data-test-subj="draggable-signature-link"
          field={SURICATA_SIGNATURE_FIELD_NAME}
          id={`suricata-signature-default-draggable-${contextId}-${id}-${SURICATA_SIGNATURE_FIELD_NAME}`}
          value={signature}
          tooltipPosition="bottom"
        >
          <div>
            <GoogleLink link={signature}>
              {signature.split(' ').splice(tokens.length).join(' ')}
            </GoogleLink>
          </div>
        </DefaultDraggable>
      </LinkFlexItem>
    </EuiFlexGroup>
  );
});

SuricataSignature.displayName = 'SuricataSignature';
