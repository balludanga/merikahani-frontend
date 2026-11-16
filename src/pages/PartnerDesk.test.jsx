import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import PartnerDesk from './PartnerDesk';

// Who sees which tab of the partner desk. The tabs' own content is stubbed: it has its own calls.
let mockUser;

jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser, loading: false }) }));
jest.mock('../utils/seo', () => ({ updateMetaTags: jest.fn(), resetMetaTags: jest.fn() }));
jest.mock('../components/PartnerApplications', () => () => <div>आवेदन-सूची</div>);
jest.mock('../components/PartnerMonths', () => () => <div>महीनों-की-सूची</div>);
jest.mock('../components/PartnerPayouts', () => () => <div>भुगतान-सूची</div>);
jest.mock('../components/ProfitSheet', () => () => <div>लाभ-पत्र</div>);
jest.mock('../components/OwnerPayments', () => () => <div>ऑनलाइन-सूची</div>);
jest.mock('../components/ReviewerTeam', () => () => <div>टीम-सूची</div>);

let host;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  ReactDOM.unmountComponentAtNode(host);
  host.remove();
});

const render = (user, path = '/review/partners') => {
  mockUser = user;
  act(() => {
    ReactDOM.render(
      <MemoryRouter initialEntries={[path]}>
        <PartnerDesk />
      </MemoryRouter>,
      host
    );
  });
};

const tabs = () => Array.from(host.querySelectorAll('[role="tab"]')).map((tab) => tab.textContent);

describe('the partner desk', () => {
  it('gives a reviewer the applications and the months, and no payouts, profit or online payments', () => {
    render({ id: 2, is_admin: true, is_owner: false });
    expect(tabs()).toEqual(['आवेदन', 'मासिक कोष']);
    expect(host.textContent).toContain('केवल मालिक का काम है');
  });

  it('gives the owner every tab', () => {
    render({ id: 1, is_admin: true, is_owner: true });
    expect(tabs()).toEqual(['आवेदन', 'मासिक कोष', 'भुगतान', 'लाभ-हानि', 'ऑनलाइन भुगतान', 'समीक्षक टीम']);
    expect(host.textContent).not.toContain('केवल मालिक का काम है');
  });

  it('does not open the payouts or team tabs for a reviewer who asks for them by address', () => {
    render({ id: 2, is_admin: true, is_owner: false }, '/review/partners?tab=payouts');
    expect(host.textContent).toContain('आवेदन-सूची');
    expect(host.textContent).not.toContain('भुगतान-सूची');
    ReactDOM.unmountComponentAtNode(host);
    render({ id: 2, is_admin: true, is_owner: false }, '/review/partners?tab=team');
    expect(host.textContent).toContain('आवेदन-सूची');
    expect(host.textContent).not.toContain('टीम-सूची');
  });

  it('opens the payouts tab for the owner who asks for it', () => {
    render({ id: 1, is_admin: true, is_owner: true }, '/review/partners?tab=payouts');
    expect(host.textContent).toContain('भुगतान-सूची');
  });
});
