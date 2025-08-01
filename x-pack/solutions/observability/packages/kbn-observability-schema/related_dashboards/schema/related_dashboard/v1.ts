/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z } from '@kbn/zod';
import { relevantPanelSchema } from '../relevant_panel/latest';

const commonDashboardSchema = {
  id: z.string(),
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()).optional(),
};

export const linkedDashboardSchema = z.object({
  ...commonDashboardSchema,
  matchedBy: z.object({
    fields: z.array(z.string()).optional(),
    index: z.array(z.string()).optional(),
    linked: z.boolean().optional(),
  }),
  relevantPanelCount: z.number().optional(),
  relevantPanels: z.array(relevantPanelSchema).optional(),
});

export const suggestedDashboardSchema = z.object({
  ...commonDashboardSchema,
  matchedBy: z.object({
    fields: z.array(z.string()).optional(),
    index: z.array(z.string()).optional(),
  }),
  relevantPanelCount: z.number(),
  relevantPanels: z.array(relevantPanelSchema),
  score: z.number(),
});

export type LinkedDashboard = z.output<typeof linkedDashboardSchema>;
export type SuggestedDashboard = z.output<typeof suggestedDashboardSchema>;
export type RelatedDashboard = LinkedDashboard | SuggestedDashboard;
