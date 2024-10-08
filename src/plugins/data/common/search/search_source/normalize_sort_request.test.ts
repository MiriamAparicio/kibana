/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { normalizeSortRequest } from './normalize_sort_request';
import { SortDirection } from './types';
import type { DataView } from '@kbn/data-views-plugin/common';

describe('SearchSource#normalizeSortRequest', function () {
  const scriptedField = {
    name: 'script number',
    type: 'number',
    scripted: true,
    sortable: true,
    script: 'foo',
    lang: 'painless',
  };
  const stringScriptedField = {
    ...scriptedField,
    name: 'script string',
    type: 'string',
  };
  const booleanScriptedField = {
    ...scriptedField,
    name: 'script boolean',
    type: 'boolean',
  };

  const fields = [scriptedField, stringScriptedField, booleanScriptedField];

  const indexPattern = {
    fields,
    getScriptedField: (name: string) => {
      return fields.find((field) => field.name === name);
    },
    getRuntimeField: (name: string) => null,
  } as DataView;

  it('should return an array', function () {
    const sortable = { someField: SortDirection.desc };
    const result = normalizeSortRequest(sortable, indexPattern);
    expect(result).toEqual([
      {
        someField: {
          order: SortDirection.desc,
        },
      },
    ]);
    // ensure object passed in is not mutated
    expect(result[0]).not.toBe(sortable);
    expect(sortable).toEqual({ someField: SortDirection.desc });
  });

  it('should make plain string sort into the more verbose format', function () {
    const result = normalizeSortRequest([{ someField: SortDirection.desc }], indexPattern);
    expect(result).toEqual([
      {
        someField: {
          order: SortDirection.desc,
        },
      },
    ]);
  });

  it('should append default sort options', function () {
    const defaultSortOptions = {
      unmapped_type: 'boolean' as 'boolean',
    };
    const result = normalizeSortRequest(
      [{ someField: SortDirection.desc }],
      indexPattern,
      defaultSortOptions
    );
    expect(result).toEqual([
      {
        someField: {
          order: SortDirection.desc,
          ...defaultSortOptions,
        },
      },
    ]);
  });

  it('should enable script based sorting', function () {
    const result = normalizeSortRequest(
      {
        [scriptedField.name]: SortDirection.desc,
      },
      indexPattern
    );
    expect(result).toEqual([
      {
        _script: {
          script: {
            source: scriptedField.script,
            lang: scriptedField.lang,
          },
          type: scriptedField.type,
          order: SortDirection.desc,
        },
      },
    ]);
  });

  it('should use script based sorting with string type', function () {
    const result = normalizeSortRequest(
      [
        {
          [stringScriptedField.name]: SortDirection.asc,
        },
      ],
      indexPattern
    );

    expect(result).toEqual([
      {
        _script: {
          script: {
            source: stringScriptedField.script,
            lang: stringScriptedField.lang,
          },
          type: 'string',
          order: SortDirection.asc,
        },
      },
    ]);
  });

  it('should use script based sorting with boolean type as string type', function () {
    const result = normalizeSortRequest(
      [
        {
          [booleanScriptedField.name]: SortDirection.asc,
        },
      ],
      indexPattern
    );

    expect(result).toEqual([
      {
        _script: {
          script: {
            source: booleanScriptedField.script,
            lang: booleanScriptedField.lang,
          },
          type: 'string',
          order: SortDirection.asc,
        },
      },
    ]);
  });

  it('should remove unmapped_type parameter from _score sorting', function () {
    const result = normalizeSortRequest({ _score: SortDirection.desc }, indexPattern, {
      unmapped_type: 'boolean',
    });
    expect(result).toEqual([
      {
        _score: {
          order: SortDirection.desc,
        },
      },
    ]);
  });
});
