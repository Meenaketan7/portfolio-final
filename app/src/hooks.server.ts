import { sequence } from '@sveltejs/kit/hooks';
import { handle as handleParaglide } from './lib/hooks/i18n/handle.server.js';
import { handleAccess } from './routes/middlewares/access.server.js';

export const handle = sequence(handleParaglide, handleAccess);
