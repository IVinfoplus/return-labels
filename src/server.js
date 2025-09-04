const path = require('path');
const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const loaded = require('./routes/labels');
const labelsRouter = loaded?.default || loaded; // handles accidental ESM default
if (typeof labelsRouter !== 'function') {
  console.error(
    'labels export typeof =',
    typeof labelsRouter,
    'keys=',
    labelsRouter && Object.keys(labelsRouter)
  );
  throw new TypeError('labels router did not load as a middleware function');
}
app.use('/api/labels', labelsRouter);

// Mount returnOrders router
const returnOrdersRouter = require('./routes/returnOrders');
app.use('/api/returns', returnOrdersRouter);

app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.listen(PORT, () =>
  console.log(`Server listening on http://localhost:${PORT}`)
);
