import express, { Router } from 'express';

import { signinRouter } from './login';
import { registerRouter } from './register';
import { changeRouter } from './change';

const authRoutes: Router = express.Router();

authRoutes.use(signinRouter, registerRouter, changeRouter);

export { authRoutes };
