/**
 *  API
 *
 * @author Aung Khit Paing
 * @version 1.0.0
 * @license MIT
 */

'use strict';

const app        = require('lambda-api')({ version: 'v1.0', base: '1' });
const auth       = require('./api/middleware/auth');


app.register(require('./api/login/login'),{prefix:'login'})

//----------------------------------------------------------------------------//
// Define Middleware
//----------------------------------------------------------------------------//

// Add CORS Middleware
app.use((req,res,next) => {
  // Add default CORS headers for every request
  res.cors()
  // Call next to continue processing
  next()
})


// Default Options for CORS preflight
app.options('/*', (req,res) => {
  res.status(200).json({})
})

//----------------------------------------------------------------------------//
// Main router handler
//----------------------------------------------------------------------------//
module.exports.router = (event, context, callback) => {
  
  // !!!IMPORTANT: Set this flag to false, otherwise the lambda function
  // won't quit until all DB connections are closed, which is not good
  // if you want to freeze and reuse these connections
  context.callbackWaitsForEmptyEventLoop = false
  
  // Run the request
  app.run(event,context,callback);
}