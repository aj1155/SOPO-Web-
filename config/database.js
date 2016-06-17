var mysql = require('mysql');

var pool  = mysql.createPool({
    host :'localhost',
    port : 3306,
    user : 'root',
    password : 'test123',
    database:'software'
});

module.exports = pool;
