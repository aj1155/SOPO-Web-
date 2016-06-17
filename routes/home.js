var express = require('express');
var router = express.Router();
var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');

var connection = require('../config/database');
/* GET home page. */
router.get('/', function(req, res, next) {
  if(!req.user){
    res.render('./home/login');
  }else if(req.user.special===1){
    res.redirect('/professor/main');
  }else if(req.user.special===0){
    res.redirect('student/main');
  }
});

router.get('/join_user', function(req, res, next) {
  res.render('./home/join_user');
});

router.get('/login_please',function(req,res,next){
  res.render('./home/login_please');
});


router.post('/join_user', function(req, res, next) {
    var user = { user_id: req.body.user_id,
          password: req.body.password,
          grade: req.body.grade,
          name:req.body.name,
          phone:req.body.phone,
          email:req.body.email,
          status:req.body.status
        };

    var message;
    if (!user.user_id) message = '학번을 입력하세요';
    else if (!user.password) message = '비밀번호를 입력하세요';
    else if (!user.grade) message = '학년을 입력하세요';
    else if (!user.name) message = '이름을 입력하세요';
    else if (!user.phone) message = '연락처를 입력하세요';
    else if (!user.email) message = '메일주소를 입력하세요';
    else if (user.status==='--선택--') message = '재학상태를 입력하세요';

    if (message)
        res.render('./home/user_edit', { user: user, message: message });
    else
        connection.query('INSERT INTO users SET ?',user,function(err, result) {
            console.log(result);
            if (err) next(err);
            else
                res.render('./home/user_edit', { user: user, message: '저장되었습니다' });
        });
});

router.get('/password_search',function(req,res,next){
  res.render('./home/password_search');
});

router.post('/password_search',function(req,res,next){
  var search={
    user_id:req.body.user_id,
    email:req.body.email
  };
    connection.query('SELECT * FROM users where user_id=?;',search.user_id,function(err,user){
      if(err) next(err);
      else if(user[0].email===search.email){

        var chars="0123456789abcdefghijklmnopqrstuvwxyz";
        var new_pass="";
        var length=6;
        for(var i=0;i<length;i++){
          var rnum=Math.floor(Math.random()*chars.length);
          new_pass+=chars.substring(rnum,rnum+1);
        }
        connection.query('UPDATE users set password=? where user_id=?;',[new_pass,search.user_id],function(err2){
          if(err2) next (err2);
          else{

            smtpTransport = nodemailer.createTransport(smtpTransport({
              service:'gmail',
              auth:{
                user:'sopomanager@gmail.com',
                pass:'a456852a'
              }
            }));

            var mailOptions = {
              from:'소포 <sopomanager@gmail.com>',
              to:search.email,
              subject:'소포 비밀번호 찾기 서비스',
              html:"<h1>비밀번호 찾기</h1><p>"+user[0].name+"님의 비밀번호는 "+new_pass+"입니다.</p>"
            };

            smtpTransport.sendMail(mailOptions,function(error,response){
              if(error){
                console.log(error);
              }else{
                console.log("Message send : " + response.message);
              }
              smtpTransport.close();
            });

          res.render('./home/password_search',{message:'임시 비밀번호가 전송되었습니다.'});
          }
          });
      }else{
          res.render('./home/password_search',{message:'아이디(학번) 혹은 이메일주소가 잘못되었습니다.'});
      }

});
});

module.exports = router;
