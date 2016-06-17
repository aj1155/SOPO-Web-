var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var session = require('express-session');
var flash = require('connect-flash');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var methodOverride=require('method-override');

var RedisStore = require('connect-redis')(session);
var pub = require('redis').createClient(6379,'127.0.0.1');
var sub = require('redis').createClient(6379,'127.0.0.1');
var redis = require('redis').createClient(6379,'127.0.0.1');

var connection = require('./config/database');
var home = require('./routes/home');
var professor = require('./routes/professor');
var student = require('./routes/student');

var app = express();

//--------------------------------------------------------------------------------//

var socket_io    = require( "socket.io" );
var io           = socket_io();
app.io           = io;

var socket_ids = [];

//io.emit은 모든 사용자들에게 날리는 서버메세지 각 개인 사용자에게는 socket.emit
io.on('connection', function(socket)
{
    console.log('a user connected');

    socket.on('setNickName',function(nickName){
    	socket.nickName = nickName;
    	socket_ids[nickName] = socket.id;
    	console.log('식별자 '+nickName);
    });

    socket.on('disconnect', function() {
        console.log('user disconnected');
        var nickName = socket.nickName;
        if(nickName !== undefined){
            delete socket_ids[nickName];
            console.log('해당 유저 목록에서 삭제');
        }// if
    });
        socket.on('setNickName',function(nickName){
    	socket.nickName = nickName;
    	socket_ids[nickName] = socket.id;
    	console.log('식별자 '+nickName);
    });
    socket.on('success',function(msg_id,count){
      connection.query('SELECT * FROM letter where id=? order by time desc',msg_id,function(err,last){
        connection.query('SELECT * FROM room where message_id=?',msg_id,function(err,already){
          console.log(last);
          if(err){
            next(err);
          }else if(already.length===0){
            var room_name;
            if(count>1){
              room_name=last[0].recipient+" 외 "+(count-1)+"명";
            }else{
              room_name=last[0].recipient;
            }
            var room={
              message_id:msg_id,
              sender_id:socket.nickName,
              room_name:room_name,
              count:count,
              last_time:last[0].time,
              last_text:last[0].text
            };
            connection.query('INSERT INTO room SET ?',room,function(err){
              if(err){
                console.log(err);
              }else{
                console.log('insert room!');
              }
            });
          }else{
            connection.query('UPDATE room set last_time=?,last_text=? where message_id=?',[last[0].time,last[0].text,msg_id],function(err){
              if(err){
                console.log(err);
              }else{
                console.log('update time!');
              }
            });
          }
        });
    });
    io.to(socket_ids[socket.nickName]).emit('완료');
    });
    socket.on('letter',function(id,name,seq,msg_id,msg,time){
    	console.log('받는이 정보:'+id+' '+msg);
    	console.log('보내는이 아이디:'+socket.nickName+' '+name);
  	  connection.query('SELECT * FROM users where user_id = ?',id,function(err,students){
      	var text = {
            seq:seq,
    	  		id : msg_id,
    	   		sender : name,
    	  		recipient : students[0].name,
    	  		student_id : id,
    	  		text : msg,
    	  		time : time,
    	  		check_message : false,
    	  		sender_id:socket.nickName,
    	  		check_time : null
    	  };
    	    connection.query('INSERT INTO letter SET ?' ,text,function(err,result){
 			      console.log(result);
 			        if(err){
 				           console.log(err);
 			         }
 	            else
 			        {
 				           console.log('success!');
  	 	        }
         });
    	      console.log('소켓아아디:'+socket_ids[students[0].user_id]);
    	      console.log('보내는이:'+name);
			      io.to(socket_ids[students[0].user_id]).emit('쪽지',msg,name);
    	   });
    	 });
});

//-------------------------------------------------------------------------------------------------------------------------//

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(methodOverride("_method"));
app.use(flash());

app.use(session(
  {key:'sid',
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge:1000*60*60 },
    store:new RedisStore({
      client:redis,
      prefix:"session",
      db:0
    })
  }));


var passport = require('./config/passport');
app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(path.join(__dirname, 'public')));

app.use('/home', home);
app.use('/professor', professor);
app.use('/student', student);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
