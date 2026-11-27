import { expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../messages/en.json';
import { SharedView } from './SharedView';

it('renders a shared snapshot with its translated labels', () => {
  const view = createElement(SharedView, {
    snapshot: {
      v: 1 as const,
      list: 'Work',
      sharedAt: 1795775400000,
      tasks: [
        {
          id: 'a1',
          title: 'Send the launch email',
          due: '2026-11-27',
          done: false,
          notes: '',
          pinned: false,
          list: 'Work',
          tags: [],
          priority: 0,
          subtasks: [],
          evening: false,
        },
      ],
    },
  });
  const html = renderToStaticMarkup(
    createElement(NextIntlClientProvider, { locale: 'en', messages, children: view }),
  );
  expect(html).toContain('Send the launch email');
  expect(html).toContain('Shared list');
});
