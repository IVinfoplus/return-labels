const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.use(express.static(path.join(__dirname, 'public')));

const returnsRouter = require('./routes/returnOrders');
const labelsRouter = require('./routes/labels');

app.use('/api/returns', returnsRouter);
app.use('/api/labels', labelsRouter);

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
