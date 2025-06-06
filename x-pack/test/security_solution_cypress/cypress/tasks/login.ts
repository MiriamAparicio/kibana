/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { LoginState } from '@kbn/security-plugin/common/login_state';
import { KNOWN_SERVERLESS_ROLE_DEFINITIONS } from '@kbn/security-solution-plugin/common/test';
import { LOGOUT_URL } from '../urls/navigation';
import {
  CLOUD_SERVERLESS,
  DEFAULT_SERVERLESS_ROLE,
  ELASTICSEARCH_PASSWORD,
  ELASTICSEARCH_USERNAME,
  IS_SERVERLESS,
} from '../env_var_names_constants';
import { API_HEADERS, rootRequest } from './api_calls/common';

export interface User {
  username: string;
  password: string;
}

export const defaultUser: User = {
  username: Cypress.env(ELASTICSEARCH_USERNAME),
  password: Cypress.env(ELASTICSEARCH_PASSWORD),
};

export const getEnvAuth = (role: string): User => {
  if (
    (Cypress.env(IS_SERVERLESS) || Cypress.env(CLOUD_SERVERLESS)) &&
    !(role in KNOWN_SERVERLESS_ROLE_DEFINITIONS)
  ) {
    throw new Error(`An attempt to log in with unsupported by Serverless role "${role}".`);
  }
  const user: User = {
    username: role,
    password: 'changeme',
  };
  return user;
};

export const login = (role?: string): void => {
  let testRole = '';

  if (Cypress.env(IS_SERVERLESS)) {
    if (!role) {
      testRole = DEFAULT_SERVERLESS_ROLE;
    } else {
      testRole = role;
    }

    cy.task('getSessionCookie', testRole).then((cookie) => {
      cy.setCookie('sid', cookie as string, {
        // "hostOnly: true" sets the cookie without a domain.
        // This makes cookie available only for the current host (not subdomains).
        // It's needed to match the Serverless backend behavior where cookies are set without a domain.
        // More info: https://github.com/elastic/kibana/issues/221741
        hostOnly: true,
      });
    });

    cy.visit('/');

    cy.getCookies().then((cookies) => {
      // Ensure that there's only a single session cookie named 'sid'.
      const sessionCookies = cookies.filter((cookie) => cookie.name === 'sid');
      expect(sessionCookies).to.have.length(1);
    });
  } else {
    const user = role ? getEnvAuth(role) : defaultUser;
    loginWithUser(user);
  }
};

export const loginWithUser = (user: User): void => {
  const baseUrl = Cypress.config().baseUrl;
  if (!baseUrl) {
    throw Error(`Cypress config baseUrl not set!`);
  }

  // Programmatically authenticate without interacting with the Kibana login page.
  rootRequest<LoginState>({
    url: `${baseUrl}/internal/security/login_state`,
  }).then((loginState) => {
    const basicProvider = loginState.body.selector.providers.find(
      (provider) => provider.type === 'basic'
    );

    cy.request({
      url: `${baseUrl}/internal/security/login`,
      method: 'POST',
      body: {
        providerType: basicProvider?.type,
        providerName: basicProvider?.name,
        currentURL: '/',
        params: { username: user.username, password: user.password },
      },
      headers: API_HEADERS,
    });
  });
};

export const logout = (): void => {
  cy.visit(LOGOUT_URL);
};
