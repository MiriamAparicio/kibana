/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { DataViewFieldMap } from '@kbn/data-views-plugin/common';
import type { EsqlQueryOrInvalidFields } from './helpers';
import { getPrivilegedMonitorUsersJoin, removeInvalidForkBranchesFromESQL } from './helpers';
import { isLeft, left, right } from 'fp-ts/Either';

describe('getPrivilegedMonitorUsersJoin', () => {
  it('should return the correct ESQL join string with the given namespace', () => {
    const namespace = 'default';
    const result = getPrivilegedMonitorUsersJoin(namespace);

    expect(result).toMatchInlineSnapshot(`
      "| RENAME @timestamp AS event_timestamp
        | LOOKUP JOIN .entity_analytics.monitoring.users-default ON user.name
        | RENAME event_timestamp AS @timestamp
        | WHERE user.is_privileged == true"
    `);
  });
});

const getRight = (v: EsqlQueryOrInvalidFields) => {
  if (isLeft(v)) {
    throw new Error('Error: Expected a right value, but got a left value');
  }
  return v.right;
};

describe('removeInvalidForkBranchesFromESQL', () => {
  const fields: DataViewFieldMap = {
    foo: {
      name: 'foo',
      type: 'number',
      esTypes: ['long'],
      count: 10,
      searchable: true,
      aggregatable: true,
    },
    bar: {
      name: 'bar',
      type: 'number',
      esTypes: ['long'],
      count: 10,
      searchable: true,
      aggregatable: true,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return the original esql if there is no fork command', () => {
    const esql = 'FROM test-index | EVAL new_field=foo+bar';

    expect(removeInvalidForkBranchesFromESQL(fields, esql)).toEqual(right(esql));
  });

  it('should throw if fork command has less than two arguments', () => {
    const esql = 'FROM test-index | FORK (WHERE foo IS NULL)';
    expect(() => removeInvalidForkBranchesFromESQL(fields, esql)).toThrow(
      'Invalid ESQL query: FORK command must have at least two arguments'
    );
  });

  it('should throw if there are more than one fork command in the query', () => {
    const esql =
      'FROM test-index | FORK (WHERE foo IS NULL) (WHERE bar IS NULL) | FORK (WHERE foo IS NULL) (WHERE bar IS NULL)';
    expect(() => removeInvalidForkBranchesFromESQL(fields, esql)).toThrow(
      'removeInvalidForkBranchesFromESQL does not support Multiple FORK commands'
    );
  });

  it('should return invalid fields if all branches are invalid', () => {
    const esql = 'FROM test-index | FORK (WHERE not_a_field IS NULL) (WHERE not_a_field IS NULL)';
    const invalidFields = removeInvalidForkBranchesFromESQL(fields, esql);

    expect(invalidFields).toEqual(left(['not_a_field']));
  });

  it('should remove fork and insert valid branch into root if only one valid branch exists', () => {
    const esql = 'FROM test-index | FORK (WHERE foo IS NULL) (WHERE not_a_field IS NULL)';
    expect(getRight(removeInvalidForkBranchesFromESQL(fields, esql))).toMatchInlineSnapshot(`
      "FROM test-index
        | WHERE foo IS NULL"
    `);
  });

  it('should remove fork and insert valid branch into the right position', () => {
    const esql = `
    FROM test-index
      | EVAL new_field_1 = foo
      | EVAL new_field_2 = foo
      | FORK
        (
          EVAL new_field_3 = foo
          | EVAL new_field_4 = foo
        ) (
          WHERE not_a_field IS NULL
        )
      | EVAL new_field_5 = foo
      | EVAL new_field_6 = foo`;

    expect(esql).not.toBe(undefined);
    expect(getRight(removeInvalidForkBranchesFromESQL(fields, esql))).toMatchInlineSnapshot(`
      "FROM test-index
        | EVAL new_field_1 = foo
        | EVAL new_field_2 = foo
        | EVAL new_field_3 = foo
        | EVAL new_field_4 = foo
        | EVAL new_field_5 = foo
        | EVAL new_field_6 = foo"
    `);
  });

  it('should remove invalid branches and return FORK query if multiple valid branches exist', () => {
    const esql =
      'FROM test-index | FORK (WHERE foo IS NULL) (WHERE bar IS NULL) (WHERE not_a_field IS NULL)';
    const result = removeInvalidForkBranchesFromESQL(fields, esql);
    expect(getRight(result)).toMatchInlineSnapshot(`
      "FROM test-index
        | FORK
          (WHERE foo IS NULL)
          (WHERE bar IS NULL)"
    `);
  });

  it('should return the original esql if all branches are valid', () => {
    const esql = 'FROM test-index | FORK (WHERE foo IS NULL) (WHERE bar IS NULL)';
    expect(removeInvalidForkBranchesFromESQL(fields, esql)).toEqual(right(esql));
  });

  it('should remove fork if the invalid field is present inside a SORT command', () => {
    const esql = 'FROM test-index | FORK (WHERE foo IS NULL) (SORT not_a_field)';
    expect(getRight(removeInvalidForkBranchesFromESQL(fields, esql))).toMatchInlineSnapshot(`
      "FROM test-index
        | WHERE foo IS NULL"
    `);
  });

  it('should remove fork if the invalid field is present inside a SORT command with order', () => {
    const esql = 'FROM test-index | FORK (SORT foo) (SORT not_a_field ASC)';
    expect(getRight(removeInvalidForkBranchesFromESQL(fields, esql))).toMatchInlineSnapshot(`
      "FROM test-index
        | SORT foo"
    `);
  });

  it('should remove fork if the invalid field is present inside a WHERE command', () => {
    const esql = 'FROM test-index | FORK (WHERE foo IS NULL) (WHERE not_a_field IS NULL)';
    expect(getRight(removeInvalidForkBranchesFromESQL(fields, esql))).toMatchInlineSnapshot(`
      "FROM test-index
        | WHERE foo IS NULL"
    `);
  });

  it('should remove fork if the invalid field is present inside a STATS command', () => {
    const esql = 'FROM test-index | FORK (STATS AVG(foo)) (STATS AVG(not_a_field))';
    expect(getRight(removeInvalidForkBranchesFromESQL(fields, esql))).toMatchInlineSnapshot(`
      "FROM test-index
        | STATS AVG(foo)"
    `);
  });

  it('should remove fork if the invalid field is present inside a DISSECT command', () => {
    const esql =
      'FROM test-index | FORK (DISSECT foo "%{a}-%{b}") (DISSECT not_a_field "%{a}-%{b}")';
    expect(getRight(removeInvalidForkBranchesFromESQL(fields, esql))).toMatchInlineSnapshot(`
      "FROM test-index
        | DISSECT foo \\"%{a}-%{b}\\""
    `);
  });

  it('should not remove fork if an EVAL commands created a new field inside a branch', () => {
    const esql =
      'FROM test-index | FORK (WHERE foo IS NULL) (EVAL new_field = foo | WHERE new_field IS NULL)';
    expect(getRight(removeInvalidForkBranchesFromESQL(fields, esql))).toEqual(esql);
  });

  it('should not remove fork if an previous EVAL commands created a new field with an complex expression', () => {
    const esql = `FROM test-index | FORK 
      (WHERE foo IS NULL) 
      (EVAL new_field =  
        CASE(
            STARTS_WITH(foo, "/api/v1/authn"), "Direct",
            STARTS_WITH(bar, "/oauth2/v1/authorize") OR STARTS_WITH(bar, "/oauth2/v1/token") OR LOCATE(bar, "/sso/saml") > 0, "Federated",
          null) 
        | WHERE new_field IS NULL)`;

    expect(getRight(removeInvalidForkBranchesFromESQL(fields, esql))).toEqual(esql);
  });

  it('should remove fork if an EVAL command uses an invalid field inside a complex expression', () => {
    const esql = `FROM test-index | FORK 
      (WHERE foo IS NULL) 
      (EVAL new_field =  
        CASE(
            STARTS_WITH(foo, "/api/v1/authn"), "Direct",
            STARTS_WITH(bar, "/oauth2/v1/authorize") OR STARTS_WITH(bar, "/oauth2/v1/token") OR LOCATE(invalid_Field, "/sso/saml") > 0, "Federated",
          null) 
      )`;

    expect(getRight(removeInvalidForkBranchesFromESQL(fields, esql))).toMatchInlineSnapshot(`
      "FROM test-index
        | WHERE foo IS NULL"
    `);
  });

  it('should not remove fork if an previous EVAL commands created a new field', () => {
    const esql =
      'FROM test-index | EVAL new_field = foo | FORK (WHERE foo IS NULL) (WHERE new_field IS NULL)';
    expect(getRight(removeInvalidForkBranchesFromESQL(fields, esql))).toEqual(esql);
  });

  it('should not remove fork if an previous EVAL commands created a new field with multiple assignments', () => {
    const esql =
      'FROM test-index | EVAL new_field1 = foo, new_field2 = bar | FORK (WHERE foo IS NULL) (WHERE new_field2 IS NULL)';
    expect(getRight(removeInvalidForkBranchesFromESQL(fields, esql))).toEqual(esql);
  });

  it('should not remove fork if an field was renamed', () => {
    const esql =
      'FROM test-index | RENAME foo as new_field | FORK (WHERE foo IS NULL) (WHERE new_field IS NULL)';
    expect(getRight(removeInvalidForkBranchesFromESQL(fields, esql))).toEqual(esql);
  });

  it('should not remove fork if an field was renamed with a multiple renamed assignments', () => {
    const esql =
      'FROM test-index | RENAME foo as new_field1, foo as new_field2 | FORK (WHERE foo IS NULL) (WHERE new_field2 IS NULL)';
    expect(getRight(removeInvalidForkBranchesFromESQL(fields, esql))).toEqual(esql);
  });

  it('should not remove fork if an field was renamed with new syntax', () => {
    const esql =
      'FROM test-index | RENAME new_field = foo | FORK (WHERE foo IS NULL) (WHERE new_field IS NULL)';
    expect(getRight(removeInvalidForkBranchesFromESQL(fields, esql))).toEqual(esql);
  });

  it('should not remove fork if an field was renamed with new syntax and expression', () => {
    const esql =
      'FROM test-index | RENAME new_field = foo + 1 | FORK (WHERE foo IS NULL) (WHERE new_field IS NULL)';
    expect(getRight(removeInvalidForkBranchesFromESQL(fields, esql))).toEqual(esql);
  });
});
