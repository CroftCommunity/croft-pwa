// User guide page entry. Thin: wrap the rendered guide in the shared shell.
import { mountShell } from '../nav';
import { registerServiceWorker } from '../sw-register';
import { log } from '../log';
import { GUIDE } from './guide-content';
import { renderGuide } from './user-guide-view';

const app = document.getElementById('app');
if (!app) throw new Error('user-guide: #app not found');
mountShell(app, renderGuide(GUIDE));
registerServiceWorker();
log.info('shell mounted', 'user-guide');
