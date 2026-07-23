import { mountChapter } from './chapter';
import { PWA } from './standards-content';
import { measure } from '../measure/measure';

measure.record('page_pwa');
mountChapter('pwa', {
  title: 'PWA mechanics',
  lede: 'Security built into the artifact, install and offline, and the console as the debugger.',
}, PWA);
