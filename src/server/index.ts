import express from 'express';

import { Api } from './Api';
import { sendMessage } from '../models/claude';

const app = express();
app.use(express.json());
const port = 3000;
export const api = new Api(app, port, sendMessage);
