/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { composeStories } from '@storybook/react';
import { screen, waitFor } from '@testing-library/react';
import React from 'react';
import * as stories from './popover.stories';
import { renderWithTheme } from '../../../../utils/test_helpers';

const { Dependency, ExternalsList, Resource, Service } = composeStories(stories);

describe('Popover', () => {
  describe('with dependency data', () => {
    it('renders a dependency link', async () => {
      renderWithTheme(<Dependency />);

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /Dependency Details/i })).toBeInTheDocument();
      });
    });
  });

  describe('with externals list data', () => {
    it('renders an externals list', async () => {
      renderWithTheme(<ExternalsList />);

      await waitFor(() => {
        expect(screen.getByText(/813-mam-392.mktoresp.com:443/)).toBeInTheDocument();
      });
    });
  });

  describe('with resource data', () => {
    it('renders with no buttons', async () => {
      renderWithTheme(<Resource />);

      await waitFor(() => {
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
      });
    });
  });

  describe('with service data', () => {
    it('renders contents for a service', async () => {
      renderWithTheme(<Service />);

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /service details/i })).toBeInTheDocument();
      });
    });
  });
});
