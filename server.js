const express = require('express');

const app = express();
const port = 3000;
app.listen(port, () => { console.log('listening on port', port); });
// get data from request
app.use(express.json());
app.use(express.urlencoded());

// Connect to frontend
app.use(express.static('public'));

// User Route
const userRoutes = require('./routes/user_route');
app.use('/api/users', userRoutes);

// Post Route
const postRoutes = require('./routes/post_route');
app.use('/api/posts', postRoutes);