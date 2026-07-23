import { mountChapter } from './chapter';
import { BRAND } from './standards-content';
import { measure } from '../measure/measure';

measure.record('page_brand');
mountChapter('brand', {
  title: 'Brand',
  lede: 'A tuned tectonic palette with colour in one file, contrast recorded, and two honest themes.',
}, BRAND);
