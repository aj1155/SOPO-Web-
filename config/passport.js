var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

var mysql=require('mysql');
var connection=require('./database');
var redis = require('redis').createClient(6379,'127.0.0.1');

passport.use(new LocalStrategy({
  usernameField:'user_id',
  passwordField:'password',
  passReqToCallback:true
},function(req,user_id,password,done){
  connection.query("SELECT * FROM users where user_id=?",user_id, function(err, rows){
    if(err) next(err);
    else if(password===rows[0].password){
      var user={
        user_id:rows[0].user_id,
        name:rows[0].name,
        special:rows[0].special,
        image:rows[0].image
      };
      redis.set(user_id,user.user_id+"/"+user.name+"/"+user.special+"/"+user.image);
      return done(null,user);
    }else{
      return done(null,false);
    }
  });
}));

passport.serializeUser(function(user,done){
  console.log('serialize');
  done(null,user);
});

passport.deserializeUser(function(user,done){
  console.log('deserialize');
  done(null,user);
});

module.exports = passport;
