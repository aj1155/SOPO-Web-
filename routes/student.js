var express = require('express');
var router = express.Router();

var passport = require('../config/passport');
var connection = require('../config/database');


router.get('/logout',function(req,res,next){
  console.log('logout');
  req.logout();
  req.session.destroy();
  res.redirect('/home');
});

router.get('/main', function(req, res, next){
  if(req.user.special===0){
      console.log(req.user);
      connection.query('SELECT message_id,sender,last_text,sum(case when check_message=false then 1 else 0 end) as no_check,last_time FROM room r join letter l on r.message_id=l.id where l.student_id=? group by message_id order by last_time desc',[req.user.user_id],function(err,rooms){
        var no_read=0;
        for(var i=0;i<rooms.length;i++){
          no_read+=rooms[i].no_check;
        }
        res.render('./student/main',{user:req.user,nickName:req.user.user_id,no_read:no_read});
      });
  }else{
     res.redirect('/home/login_please');
  }
});

//------------------------------------------------------------------쪽지 라우팅--------------------------------------------------------------------------------------//

router.get('/message_list', function(req, res, next) {
if(req.user.special===0){
  connection.query('SELECT message_id,sender,last_text,sum(case when check_message=false then 1 else 0 end) as no_check,last_time FROM room r join letter l on r.message_id=l.id where l.student_id=? group by message_id order by last_time desc',[req.user.user_id],function(err,rooms){
          var no_read=0;
          for(var i=0;i<rooms.length;i++){
            no_read+=rooms[i].no_check;
          }
          res.render('./student/message_list',{user:req.user,room:rooms,nickName:req.user.user_id,no_read:no_read});
  });
  }else{
     res.redirect('/home/login_please');
  }
	});

  router.post('/check',function(req,res,next){
    if(req.user.special===0){
       connection.query('UPDATE letter SET check_message = ? where id = ? and student_id=?' ,[true,req.body.message_id,req.user.user_id],function(err,result){
          console.log(result);
          if(err){
            console.log(err);
          }
          else
          {
            console.log('message_check_success!');
          }
          connection.query('SELECT * FROM letter where id=? and student_id=? order by seq',[req.body.message_id,req.user.user_id],function(err,list){
            connection.query('SELECT message_id,sender,l.sender_id sender_id,last_text,sum(case when check_message=false then 1 else 0 end) as no_check,last_time FROM room r join letter l on r.message_id=l.id where l.student_id=? group by message_id order by last_time desc',[req.user.user_id],function(err,rooms){
              connection.query('SELECT image from users where user_id=?',rooms[0].sender_id,function(err,image){
                  var no_read=0;
                  for(var i=0;i<rooms.length;i++){
                    no_read+=rooms[i].no_check;
                  }
                  res.render('./student/check',{user:req.user,sender:rooms[0].sender,image:image[0].image,list:list,no_read:no_read,nickName:req.user.user_id});
                });
                });
           });
      });
      }else{
         res.redirect('/home/login_please');
      }

  });

//---------------------------------------------------------------------------------------------------------------------------------------------------------//

module.exports = router;
