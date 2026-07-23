// User guide page entry. Thin: wrap the rendered guide in the shared shell.
import { mountShell } from '../nav';
import { registerServiceWorker } from '../sw-register';
import { log } from '../log';
import { GUIDE } from './guide-content';
import { renderGuide } from './user-guide-view';
import { measure } from '../measure/measure';

const app = document.getElementById('app');
if (!app) throw new Error('user-guide: #app not found');
measure.record('page_guide');
mountShell(
  app,
  renderGuide(GUIDE, {
    title: 'How to build a Croft PWA',
    lede:
      'A short tour of the standard, in the order you would build one. Every ' +
      'section describes what a piece is for; the repo itself is the worked example.',
  }),
);
registerServiceWorker();
log.info('shell mounted', 'user-guide');
