var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var fs = require('fs');

var multipart = require('connect-multiparty');
var multipartMiddleware=multipart();

var passport = require('../config/passport');
var connection = require('../config/database');
var redis = require('redis').createClient(6379,'127.0.0.1');

var redis_user = {
  user_id:null,
  name:null,
  special:null,
  image:null
};

var a = function(req){
  redis.get(req.cookies.name,function(err,data){
    if(err){
      console.log(err);
      res.send("error "+err);
      return;
    }
    var value=data.split("/");
    redis_user.user_id=value[0];
    redis_user.name=value[1];
    redis_user.special=value[2];
    redis_user.image=value[3];
    return redis_user;
});
};

express().use(bodyParser.json());

router.post('/login', passport.authenticate('local',{failureRedirect:'../home',failureFlash:true}),
  function(req,res){
    res.cookie('name',req.user.user_id);
    if(req.user.special===0){
      res.redirect('/student/main');
    }else if(req.user.special==1){
      res.redirect('/professor/main');
    }
  });

  router.get('/logout',function(req,res,next){
    console.log('logout');
    req.logout();
    req.session.destroy();
    res.redirect('/home');
  });

//---------------------------------------------------------------------쪽지 js------------------------------------------------------------------------------------//

router.post('/chatting',function(req,res,next){
    var people_id=req.body.people_id.split(",");
    var people_name=req.body.people_name.split(",");
    var len=people_id.length;
    connection.query('SELECT max(seq) as seq,max(id) as id FROM letter',function(err,max){
      connection.query('SELECT distinct * FROM room r join letter l on id=message_id where r.count=?',len,function(err2,already){
        var count=0;
        for(var i=0;i<len;i++){
          for(var j=0;j<already.length;j++){
            if(people_id[i]===already[j].student_id){
              count++;
              break;
            }
          }
        }
        if(count===len){
          connection.query('SELECT distinct student_id,recipient FROM letter where id=?',already[0].message_id,function(err,letter){
              var people_id=[];
              var people_name=[];
              for(var i=0;i<letter.length;i++){
                people_id.push(letter[i].student_id);
                people_name.push(letter[i].recipient);
                }
              var len=people_id.length;
              var seq=max[0].seq+1;
              connection.query('SELECT distinct text,time FROM letter where id=? order by seq',already[0].message_id,function(err3,list){
                connection.query('select seq,sum(case when check_message=false then 1 else 0 end) as count from letter where id=? group by seq order by seq',already[0].message_id,function(err4,no_check){
                  res.render('./professor/letter2',{user:req.user,student_id:people_id,student_name:people_name,len:len,seq:seq,list:list,msg_id:already[0].message_id,no_check:no_check});
                });
              });
          });
        }else{
              var seq=max[0].seq+1;
              var msg_id=max[0].id+1;
              res.render('./professor/letter',{user:req.user,student_id:people_id,student_name:people_name,len:len,seq:seq,msg_id:msg_id});
      }
      });
    });
});

router.post('/chatting2',function(req,res,next){
  connection.query('SELECT max(seq) as seq FROM letter',function(err,max){
    connection.query('SELECT distinct student_id,recipient FROM letter where id=?',req.body.message_id,function(err,letter){
      var people_id=[];
      var people_name=[];
      for(var i=0;i<letter.length;i++){
        people_id.push(letter[i].student_id);
        people_name.push(letter[i].recipient);
      }
      var seq=max[0].seq+1;
      var len=people_id.length;
      connection.query('SELECT distinct text,time FROM letter where id=? order by seq',req.body.message_id,function(err2,list){
        connection.query('select seq,sum(case when check_message=false then 1 else 0 end) as count from letter where id=? group by seq order by seq',req.body.message_id,function(err3,no_check){

          res.render('./professor/letter2',{user:req.user,student_id:people_id,student_name:people_name,len:len,list:list,seq:seq,msg_id:req.body.message_id,no_check:no_check});
      });
    });
    });
  });
});

router.get('/send_message', function(req, res, next) {
        connection.query('SELECT * FROM room where sender_id=? order by last_time desc',[req.user.user_id],function(err,rooms){
				      res.render('./professor/send_message',{user:req.user,room:rooms});
          });
});

router.post('/room_delete',function(req,res,next){
  if(req.user.special===1){
    connection.query('DELETE FROM room where message_id=? and sender_id=?',[req.query.message_id,req.user.user_id],function(err,row){
      connection.query('DELETE FROM letter where id=? and sender_id=?',[req.query.message_id,req.user.user_id],function(err2,row2){
        if(err) next(err);
        else{
          res.redirect('/professor/send_message');
          }
    });
  });
  }
});
router.get('/no_check',function(req,res,next){
  if(req.user.special===1){
    connection.query('SELECT * FROM letter where seq=? and check_message=0',req.query.seq,function(err,no_check){
      connection.query('SELECT * FROM users where special=0',function(err2,student){
        var images=[];
        for(var i=0;i<no_check.length;i++){
          for(var j=0;j<student.length;j++){
            if(parseInt(no_check[i].student_id)===student[j].user_id){
                images.push(student[j].image);
            }
          }
        }
        if(err) next(err);
        else{
          console.log(images);
          res.render('./professor/no_check',{no_check:no_check,image:images});
      }
  });
  });
  }
});
//---------------------------------------------------------------------------------------------------------------------------------------------------------//

  router.get('/main', function(req, res, next){
    if(req.user.special===1){
        res.render('./professor/main',{user:req.user});
    }else{
       res.redirect('/home/login_please');
    }
});

router.get('/student_list', function(req, res, next) {
  if(req.user.special===1){
  connection.query('SELECT * FROM users where special=0 order by grade;',function(err,student){
    if(err) next(err);
    else{
      connection.query('SELECT * FROM subjects where manager_id is null or manager_id=?;',req.user.user_id,function(err2,subjects){
        if(err2) next(err2);
        else{
          res.render('./professor/student_list',{user:req.user,student:student,subjects:subjects});
        }
      });
    }
  });
  }
  else{
    res.redirect('/home/login_please');
  }
});

router.post('/student_list',function(req,res,next){
  var s={
    grade:req.body.grade,
    name:req.body.name,
    status:req.body.status,
    subject:req.body.subject
  };

if(s.grade==='--전체--'&&s.name===''&&s.status==='--전체--'&&s.subject==='--전체--'){
    res.redirect('/professor/student_list');
}else{
  connection.query('SELECT * FROM subjects where manager_id is null or manager_id=?',req.user.user_id,function(err2,subjects){
  if(err2) next(err2);
  else{

   if(s.grade!=='--전체--'&&s.name===''&&s.status==='--전체--'&&s.subject==='--전체--'){
    connection.query('SELECT * FROM users where grade=? and special=0 order by grade;',s.grade,function(err,student){
      if(err) next(err);
      else {
        res.render('./professor/student_list_edit',{user:req.user,search:s,student:student,subjects:subjects});
      }
    });
  }else if(s.grade==='--전체--'&&s.name!==''&&s.status==='--전체--'&&s.subject==='--전체--'){
    connection.query('SELECT * FROM users WHERE name LIKE "%"?"%" and special=0 order by grade;',s.name,function(err,student){
      if(err) next(err);
      else {
        res.render('./professor/student_list_edit',{user:req.user,search:s,student:student,subjects:subjects});
      }
    });
  }else if(s.grade==='--전체--'&&s.name===''&&s.status!=='--전체--'&&s.subject==='--전체--'){
    connection.query('SELECT * FROM users where status=? and special=0 order by grade;',s.status,function(err,student){
      if(err) next(err);
      else {
        res.render('./professor/student_list_edit',{user:req.user,search:s,student:student,subjects:subjects});
      }
    });
  }else if(s.grade==='--전체--'&&s.name===''&&s.status==='--전체--'&&s.subject!=='--전체--'){
    connection.query('SELECT * FROM users a join user_subject b on a.user_id=b.user_id where b.subject_name=? and a.special=0 order by a.grade;',s.subject,function(err,student){
      if(err) next(err);
      else {
        res.render('./professor/student_list_edit',{user:req.user,search:s,student:student,subjects:subjects});
      }
    });
  }else if(s.grade!=='--전체--'&&s.name!==''&&s.status==='--전체--'&&s.subject==='--전체--'){
    connection.query('SELECT * FROM users where grade=? and name LIKE "%"?"%" and special=0 order by grade;',[s.grade,s.name],function(err,student){
      if(err) next(err);
      else {
        res.render('./professor/student_list_edit',{user:req.user,search:s,student:student,subjects:subjects});
      }
    });
  }else if(s.grade!=='--전체--'&&s.name===''&&s.status!=='--전체--'&&s.subject==='--전체--'){
    connection.query('SELECT * FROM users where grade=? and status=? and special=0 order by grade;',[s.grade,s.status],function(err,student){
      if(err) next(err);
      else {
        res.render('./professor/student_list_edit',{user:req.user,search:s,student:student,subjects:subjects});
      }
    });
  }else if(s.grade!=='--전체--'&&s.name===''&&s.status==='--전체--'&&s.subject!=='--전체--'){
    connection.query('SELECT * FROM users a join user_subject b on a.user_id=b.user_id where a.grade=? and b.subject_name=? and a.special=0 order by grade;',[s.grade,s.subject],function(err,student){
      if(err) next(err);
      else {
        res.render('./professor/student_list_edit',{user:req.user,search:s,student:student,subjects:subjects});
      }
    });
  }else if(s.grade==='--전체--'&&s.name!==''&&s.status!=='--전체--'&&s.subject==='--전체--'){
    connection.query('SELECT * FROM users where name LIKE "%"?"%" and status=? and special=0 order by grade;',[s.name,s.status],function(err,student){
      if(err) next(err);
      else {
        res.render('./professor/student_list_edit',{user:req.user,search:s,student:student,subjects:subjects});
      }
    });
  }else if(s.grade==='--전체--'&&s.name!==''&&s.status==='--전체--'&&s.subject!=='--전체--'){
    connection.query('SELECT * FROM users a join user_subject b on a.user_id=b.user_id where a.name LIKE "%"?"%" and b.subject_name=? and a.special=0 order by grade;',[s.name,s.subject],function(err,student){
      if(err) next(err);
      else {
        res.render('./professor/student_list_edit',{user:req.user,search:s,student:student,subjects:subjects});
      }
    });
  }else if(s.grade==='--전체--'&&s.name===''&&s.status!=='--전체--'&&s.subject!=='--전체--'){
    connection.query('SELECT * FROM users a join user_subject b on a.user_id=b.user_id where a.status=? and b.subject_name=? and a.special=0 order by grade;',[s.status,s.subject],function(err,student){
      if(err) next(err);
      else {
        res.render('./professor/student_list_edit',{user:req.user,search:s,student:student,subjects:subjects});
      }
    });
  }else if(s.grade!=='--전체--'&&s.name!==''&&s.status!=='--전체--'&&s.subject==='--전체--'){
    connection.query('SELECT * FROM users where grade=? and name LIKE "%"?"%" and status=? and special=0 order by grade;',[s.grade,s.name,s.status],function(err,student){
      if(err) next(err);
      else {
        res.render('./professor/student_list_edit',{user:req.user,search:s,student:student,subjects:subjects});
      }
    });
  }else if(s.grade!=='--전체--'&&s.name!==''&&s.status==='--전체--'&&s.subject!=='--전체--'){
    connection.query('SELECT * FROM users a join user_subject b on a.user_id=b.user_id where a.grade=? and a.name LIKE "%"?"%" and b.subject_name=? and a.special=0 order by grade;',[s.grade,s.name,s.subject],function(err,student){
      if(err) next(err);
      else {
        res.render('./professor/student_list_edit',{user:req.user,search:s,student:student,subjects:subjects});
      }
    });
  }else if(s.grade!=='--전체--'&&s.name===''&&s.status!=='--전체--'&&s.subject!=='--전체--'){
    connection.query('SELECT * FROM users a join user_subject b on a.user_id=b.user_id where a.grade=? and a.status=? and b.subject_name=? and a.special=0 order by grade;',[s.grade,s.status,s.subject],function(err,student){
      if(err) next(err);
      else {
        res.render('./professor/student_list_edit',{user:req.user,search:s,student:student,subjects:subjects});
      }
    });
  }else if(s.grade==='--전체--'&&s.name!==''&&s.status!=='--전체--'&&s.subject!=='--전체--'){
    connection.query('SELECT * FROM users a join user_subject b on a.user_id=b.user_id where a.name LIKE "%"?"%" and a.status=? and b.subject_subject_name=? and a.special=0 order by grade;',[s.name,s.status,s.subject],function(err,student){
      if(err) next(err);
      else {
        res.render('./professor/student_list_edit',{user:req.user,search:s,student:student,subjects:subjects});
      }
    });
  }else if(s.grade!=='--전체--'&&s.name!==''&&s.status!=='--전체--'&&s.subject!=='--전체--'){
    connection.query('SELECT * FROM users a join user_subject b on a.user_id=b.user_id where a.grade=? and a.name LIKE "%"?"%" and a.status=? and b.subject_name=? and a.special=0 order by grade;',[s.grade,s.name,s.status,s.subject],function(err,student){
      if(err) next(err);
      else {
        res.render('./professor/student_list_edit',{user:req.user,search:s,student:student,subjects:subjects});
      }
    });
  }
  }
  });
  }
});

router.get('/profile',function(req,res,next){
  if(req.user.special===1){
    connection.query('SELECT * FROM users where user_id=?;',req.query.userId,function(err,student){
      if(err) next(err);
      else{
          res.render('./professor/profile',{student:student[0]});
      }
});
}
});

router.get('/profile_edit',function(req,res,next){
  if(req.user.special===1){
    connection.query('SELECT * FROM users where user_id=?;',req.query.userId,function(err,student){
      if(err) next(err);
      else{
          res.render('./professor/profile_edit',{student:student[0]});
      }
});
}
});

router.post('/profile_edit',multipartMiddleware,function(req,res,next){
  fs.readFile(req.files.uploadFile.path,function(error,data){
    console.log(req.files.uploadFile.name);
    console.log(req.files);
  var p_user = {
        user_id: req.body.user_id,
        name:req.body.name,
        grade: req.body.grade,
        status:req.body.status,
        phone:req.body.phone,
        email:req.body.email,
        image:req.files.uploadFile.name
      };
  var url='/professor/profile?userId=';
  var message;
  if (!p_user.user_id) message = '학번을 입력하세요';
  else if (!p_user.name) message = '이름을 입력하세요';
  else if (!p_user.grade) message = '학년을 입력하세요';
  else if (!p_user.phone) message = '연락처를 입력하세요';
  else if (!p_user.email) message = '메일주소를 입력하세요';

  if (message){
      res.render('./professor/profile_edit',{student:p_user,message:message});
}else if(req.user.special===1)
    if(p_user.image===""){
            connection.query('UPDATE users set user_id=?,name=?,grade=?,status=?,phone=?,email=?,image=? where user_id=?',[p_user.user_id,p_user.name,p_user.grade,p_user.status,p_user.phone,p_user.email,null,p_user.user_id],function(err, result) {
                console.log(result);
                if (err) next(err);
                else{
                    url=url+p_user.user_id;
                    res.redirect(url);
                }
            });
    }else{
      var filePath=__dirname+"/../public/images/"+req.files.uploadFile.name;
      fs.writeFile(filePath,data,function(error){
        if(error){
          throw error;
        }else{
            connection.query('UPDATE users set user_id=?,name=?,grade=?,status=?,phone=?,email=?,image=? where user_id=?',[p_user.user_id,p_user.name,p_user.grade,p_user.status,p_user.phone,p_user.email,p_user.image,p_user.user_id],function(err, result) {
                console.log(result);
                if (err) next(err);
                else{
                    url=url+p_user.user_id;
                    res.redirect(url);
                }
            });
        }
      });
      }
    });


});


router.get('/subject',function(req,res,next){
  if(req.user.special===1){
    connection.query('SELECT * FROM user_subject where user_id=?',req.query.userId,function(err,subject){
      if(err) next(err);
      else{
        res.render('./professor/subject',{user_subject:subject});
    }
  });
  }
});

router.post('/subject',function(req,res,next){
  if(req.body.subject==='수강과목')
    console.log('req.body.subject');
  else  if(req.user.special===1){
    var user_subject={
      user_id:req.query.userId,
      subject_id:null,
      subject_name:req.body.subject
    };
    var url='/professor/subject?userId=';
    connection.query('SELECT * FROM subjects where subject_name=?',req.body.subject,function(err,row){
      if(err) next(err);
      else{
        user_subject.subject_id=row[0].subject_id;
        connection.query('INSERT INTO user_subject SET ?',user_subject,function(err2,result){
          if(err2) next(err2);
          else{
            url=url+req.query.userId;
            res.redirect(url);
          }
        });
        }
    });
  }
});

router.post('/subject_delete',function(req,res,next){
  if(req.user.special===1){
    var url='/professor/subject?userId=';
    connection.query('DELETE FROM user_subject where subject_name=? and user_id=?',[req.body.subject,req.query.userId],function(err,row){
        if(err) next(err);
        else{
          url=url+req.query.userId;
          res.redirect(url);
          }
    });
  }
});

  router.get('/chat',function(req,res,next){
    res.render('./professor/chat',{user:req.user});
  });

module.exports = router;
