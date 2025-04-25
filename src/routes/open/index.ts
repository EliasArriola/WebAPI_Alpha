import express, { Router } from 'express';

import { messageRouter } from './message';
import { messageRouterBook } from './books';

const openRoutes: Router = express.Router();

openRoutes.use('/message', messageRouter);
openRoutes.use('/books', messageRouterBook);

export { openRoutes };
