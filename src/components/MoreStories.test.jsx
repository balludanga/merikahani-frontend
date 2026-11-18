import React from 'react';
import ReactDOM from 'react-dom';
import { MemoryRouter } from 'react-router-dom';
import { act } from 'react-dom/test-utils';
import MoreStories from './MoreStories';
import { postsAPI } from '../services/api';
import { setChoice, setPrimary } from '../languages/store';

jest.mock('../services/api', () => ({ postsAPI: { getAll: jest.fn() } }));
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, updateUser: () => {} }),
}));

let host;
beforeEach(() => {
  localStorage.clear();
  host = document.createElement('div');
  document.body.appendChild(host);
  postsAPI.getAll.mockReset();
  postsAPI.getAll.mockResolvedValue({
    data: [
      { id: 1, slug: 'one', title: 'पहली', author: { username: 'a' } },
      { id: 2, slug: 'two', title: 'दूसरी', author: { username: 'b' } },
    ],
  });
});
afterEach(() => {
  act(() => {
    ReactDOM.unmountComponentAtNode(host);
  });
  host.remove();
});

const mount = async (currentId = 99) => {
  await act(async () => {
    ReactDOM.render(
      <MemoryRouter>
        <MoreStories currentId={currentId} />
      </MemoryRouter>,
      host
    );
  });
};

describe('the stories offered under a story', () => {
  test('ask for every language when the reader has chosen none', async () => {
    await mount();
    expect(postsAPI.getAll).toHaveBeenCalledWith({ limit: 7 });
  });

  test('ask only for the languages the reader chose, their preferred one first', async () => {
    setChoice('read', ['ta', 'hi']);
    setPrimary('ta');
    await mount();
    expect(postsAPI.getAll).toHaveBeenCalledWith({ limit: 7, lang: 'ta,hi', primary: 'ta' });
  });

  test('ask again when the choice changes while the story is open', async () => {
    await mount();
    expect(postsAPI.getAll).toHaveBeenCalledTimes(1);
    await act(async () => {
      setChoice('read', ['bn']);
    });
    expect(postsAPI.getAll).toHaveBeenCalledTimes(2);
    expect(postsAPI.getAll).toHaveBeenLastCalledWith({ limit: 7, lang: 'bn' });
  });

  test('never offer the story that is open', async () => {
    await mount(1);
    expect(host.textContent).toContain('दूसरी');
    expect(host.textContent).not.toContain('पहली');
  });
});
