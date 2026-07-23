import { mountChapter } from './chapter';
import { CHASSIS } from './standards-content';
import { measure } from '../measure/measure';

measure.record('page_chassis');
mountChapter('chassis', {
  title: 'Chassis',
  lede: 'The frame every Croft PWA is built on: pages, one build, and a service worker.',
}, CHASSIS);
