import { mountChapter } from './chapter';
import { CONTENT_FETCH } from './standards-content';
import { measure } from '../measure/measure';

measure.record('page_content_fetch');
mountChapter('content-fetch', {
  title: 'Content fetch',
  lede:
    'How a backendless PWA reaches content the browser will not let it read: ' +
    'an extension grants the read, not a proxy — consent-gated and presence-detected.',
}, CONTENT_FETCH);
