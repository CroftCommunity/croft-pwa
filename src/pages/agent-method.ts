import { mountChapter } from './chapter';
import { AGENT_METHOD } from './standards-content';
import { measure } from '../measure/measure';

measure.record('page_agent_method');
mountChapter('agent-method', {
  title: 'Agent method',
  lede: 'How the work is done: test first, plans that record the why, and run summaries that carry the evidence.',
}, AGENT_METHOD);
