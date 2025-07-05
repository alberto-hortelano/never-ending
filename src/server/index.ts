import express from 'express';

import { Api } from './Api';

const app = express();
app.use(express.json());
const port = 3000;
new Api(app, port);
