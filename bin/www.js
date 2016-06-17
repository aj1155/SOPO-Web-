/**
 * Module dependencies.
 */

var debug = require('debug')('socket:server');
var http = require('http');
var cluster = require('cluster');

/**
 * Get port from environment and store in Express.
 */
 //master process
 if(cluster.isMaster){
   var cpuCount=require('os').cpus().length;
   for(var i=0;i<cpuCount;i+=1){
     cluster.fork();
   }

   cluster.on('exit',function(worker){
     console.log('Worker %d died',process.pid);
     cluster.fork();
   });
 }else{
var app = require('../app');
var port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

/**
 * Create HTTP server.
 */

var server = http.createServer(app);
app.io.attach(server);

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10); //문자를 숫자로 변경, 10진수

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
  console.log('Worker %d running!',process.pid);
}
}
