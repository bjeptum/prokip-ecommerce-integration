/// <reference types="cypress" />

const adminUser = Cypress.env('ADMIN_USER') || 'admin';
const adminPass = Cypress.env('ADMIN_PASS') || 'password';
const prokipUser = Cypress.env('PROKIP_USER');
const prokipPass = Cypress.env('PROKIP_PASS');

describe('E-commerce setup smoke', () => {
  let token;

  it('logs in to local backend', function () {
    if (!adminUser || !adminPass) this.skip();
    cy.request('POST', '/auth/login', { username: adminUser, password: adminPass })
      .its('body')
      .then((body) => {
        expect(body.token).to.be.a('string');
        token = body.token;
      });
  });

  it('tests WooCommerce connection endpoint (auth only)', function () {
    if (!token) this.skip();
    const wooUrl = Cypress.env('WOO_URL');
    const wooUser = Cypress.env('WOO_USER');
    const wooAppPassword = Cypress.env('WOO_APP_PASSWORD');
    if (!wooUrl || !wooUser || !wooAppPassword) this.skip();

    cy.request({
      method: 'POST',
      url: '/woo-connections/test',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        storeUrl: wooUrl,
        wooUsername: wooUser,
        wooAppPassword
      }
    }).its('body').should('have.property', 'success', true);
  });

  it('lists sync status for a store when connectionId is provided', function () {
    if (!token) this.skip();
    const connectionId = Cypress.env('STORE_ID');
    if (!connectionId) this.skip();

    cy.request({
      url: `/setup/sync-status/${connectionId}`,
      headers: { Authorization: `Bearer ${token}` }
    }).its('status').should('eq', 200);
  });

  it('runs product matching flow when connectionId is provided', function () {
    if (!token) this.skip();
    const connectionId = Cypress.env('STORE_ID');
    if (!connectionId) this.skip();

    cy.request({
      url: `/setup/products/matches?connectionId=${connectionId}`,
      headers: { Authorization: `Bearer ${token}` }
    }).its('status').should('eq', 200);
  });

  it('runs readiness check (Prokip -> store) when Prokip creds are available', function () {
    if (!token) this.skip();
    if (!prokipUser || !prokipPass) this.skip();
    const connectionId = Cypress.env('STORE_ID');
    if (!connectionId) this.skip();

    cy.request({
      method: 'POST',
      url: '/setup/products/readiness-check',
      headers: { Authorization: `Bearer ${token}` },
      body: { connectionId }
    }).its('status').should('eq', 200);
  });
});
