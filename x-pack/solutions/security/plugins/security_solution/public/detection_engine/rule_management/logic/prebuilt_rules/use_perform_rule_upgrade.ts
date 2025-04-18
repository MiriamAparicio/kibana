/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { useAppToasts } from '../../../../common/hooks/use_app_toasts';
import { usePerformRulesUpgradeMutation } from '../../api/hooks/prebuilt_rules/use_perform_rules_upgrade_mutation';

import * as i18n from './translations';

export const usePerformUpgradeRules = () => {
  const { addError, addSuccess } = useAppToasts();

  return usePerformRulesUpgradeMutation({
    onError: (err) => {
      addError(err, { title: i18n.RULE_UPGRADE_FAILED });
    },
    onSuccess: (result, vars) => {
      if (vars.dry_run) {
        // This is a preflight check, no need to show toast
        return;
      }
      addSuccess(getSuccessToastMessage(result));
    },
  });
};

const getSuccessToastMessage = (result: {
  summary: {
    total: number;
    succeeded: number;
    skipped: number;
    failed: number;
  };
}) => {
  const toastMessage: string[] = [];
  const {
    summary: { succeeded, skipped, failed },
  } = result;
  if (succeeded > 0) {
    toastMessage.push(i18n.UPGRADE_RULE_SUCCESS(succeeded));
  }
  if (skipped > 0) {
    toastMessage.push(i18n.UPGRADE_RULE_SKIPPED(skipped));
  }
  if (failed > 0) {
    toastMessage.push(i18n.UPGRADE_RULE_FAILED(failed));
  }
  return toastMessage.join(' ');
};
