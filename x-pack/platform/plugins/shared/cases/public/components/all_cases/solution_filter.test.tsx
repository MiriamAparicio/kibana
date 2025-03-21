/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { screen } from '@testing-library/react';
import { waitForEuiPopoverOpen } from '@elastic/eui/lib/test/rtl';

import { renderWithTestingProviders } from '../../common/mock';
import { SECURITY_SOLUTION_OWNER, OBSERVABILITY_OWNER } from '../../../common/constants';

import { SolutionFilter } from './solution_filter';
import userEvent from '@testing-library/user-event';

describe('SolutionFilter ', () => {
  const onChange = jest.fn();
  const solutions = [SECURITY_SOLUTION_OWNER, OBSERVABILITY_OWNER];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders button correctly', () => {
    renderWithTestingProviders(
      <SolutionFilter onChange={onChange} selectedOptionKeys={[]} availableSolutions={solutions} />
    );

    expect(screen.getByTestId('options-filter-popover-button-owner')).toBeInTheDocument();
  });

  describe('when the owner is a single solution', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('renders options correctly', async () => {
      renderWithTestingProviders(
        <SolutionFilter
          onChange={onChange}
          selectedOptionKeys={[]}
          availableSolutions={solutions}
        />
      );

      expect(screen.getByTestId('options-filter-popover-button-owner')).toBeInTheDocument();

      await userEvent.click(screen.getByTestId('options-filter-popover-button-owner'));

      await waitForEuiPopoverOpen();

      expect(screen.getByTestId(`options-filter-popover-item-${solutions[0]}`)).toBeInTheDocument();
      expect(
        screen.queryByTestId(`options-filter-popover-item-${solutions[1]}`)
      ).not.toBeInTheDocument();
    });

    it('should call onChange with selected solution id when no option selected yet', async () => {
      renderWithTestingProviders(
        <SolutionFilter
          onChange={onChange}
          selectedOptionKeys={[]}
          availableSolutions={solutions}
        />
      );

      await userEvent.click(screen.getByTestId('options-filter-popover-button-owner'));

      await waitForEuiPopoverOpen();

      await userEvent.click(screen.getByTestId(`options-filter-popover-item-${solutions[0]}`));

      expect(onChange).toHaveBeenCalledWith({
        filterId: 'owner',
        selectedOptionKeys: [solutions[0]],
      });
    });

    it('should call onChange with [owner] when the last solution option selected is deselected', async () => {
      renderWithTestingProviders(
        <SolutionFilter
          onChange={onChange}
          selectedOptionKeys={[solutions[0]]}
          availableSolutions={solutions}
        />
      );

      await userEvent.click(screen.getByTestId('options-filter-popover-button-owner'));

      await waitForEuiPopoverOpen();

      await userEvent.click(screen.getByTestId(`options-filter-popover-item-${solutions[0]}`));

      expect(onChange).toHaveBeenCalledWith({
        filterId: 'owner',
        selectedOptionKeys: [],
      });
    });
  });

  describe('when no owner set', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('renders options correctly', async () => {
      renderWithTestingProviders(
        <SolutionFilter
          onChange={onChange}
          selectedOptionKeys={[]}
          availableSolutions={solutions}
        />,
        { wrapperProps: { owner: [] } }
      );

      expect(screen.getByTestId('options-filter-popover-button-owner')).toBeInTheDocument();

      await userEvent.click(screen.getByTestId('options-filter-popover-button-owner'));

      await waitForEuiPopoverOpen();

      expect(screen.getByTestId(`options-filter-popover-item-${solutions[0]}`)).toBeInTheDocument();
      expect(screen.getByTestId(`options-filter-popover-item-${solutions[1]}`)).toBeInTheDocument();
    });

    it('should call onChange with selected solution id when no option selected yet', async () => {
      renderWithTestingProviders(
        <SolutionFilter
          onChange={onChange}
          selectedOptionKeys={[]}
          availableSolutions={solutions}
        />,
        { wrapperProps: { owner: [] } }
      );

      await userEvent.click(screen.getByTestId('options-filter-popover-button-owner'));

      await waitForEuiPopoverOpen();

      await userEvent.click(screen.getByTestId(`options-filter-popover-item-${solutions[0]}`));

      expect(onChange).toHaveBeenCalledWith({
        filterId: 'owner',
        selectedOptionKeys: [solutions[0]],
      });
    });

    it('should call onChange with [all solutions] when the last solution option selected is deselected', async () => {
      renderWithTestingProviders(
        <SolutionFilter
          onChange={onChange}
          selectedOptionKeys={[solutions[0]]}
          availableSolutions={solutions}
        />,
        { wrapperProps: { owner: [] } }
      );

      await userEvent.click(screen.getByTestId('options-filter-popover-button-owner'));

      await waitForEuiPopoverOpen();

      await userEvent.click(screen.getByTestId(`options-filter-popover-item-${solutions[0]}`));

      expect(onChange).toHaveBeenCalledWith({
        filterId: 'owner',
        selectedOptionKeys: [],
      });
    });
  });
});
