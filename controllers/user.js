'use strict'

const User = require('../models/user')
const bcrypt = require('bcrypt-nodejs')
const crypto = require('crypto')
const async = require('async');
var momenttz = require('moment-timezone');
var nodemailer =  require('nodemailer')
var configfile = require('../config/config-file')

var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth : {
    user: configfile.emailUser,
    pass: configfile.emailPassword
  }
})
var domainName = configfile.domainName

function actualizarLastLogin(username){
  var hora = momenttz().tz("America/Lima").format()
    User.update(
      {username: username}, {$set: {
          lastLogin: hora
      }}, {
        upsert: false,
        multi: false
      }, function(err, affected){
        if(err){
          console.log(err)
          return false
        }
      }
    )
  return true
}

function cambiarPassword(req,res, sess){
  var userSession = new User()
  //var userSession = sess.user
  try{
    userSession.username = sess.user.username
    userSession.password = sess.user.password
  }catch(err){
    res.status(500).send({codErr: 500, descerror: err})
  }

  var username = userSession.username
  var password = req.body.password.trim()
  var newpassword = req.body.newpassword.trim()
  var newpassword1 = req.body.newpassword1.trim()
  var hash
  //Verificar password actualizarLastLogin
  if(!userSession.validPassword(userSession.password, password)){
    console.log('-----------> Error: Contrasena incorrecta')
    res.status(401).send({codErr: '401', descerror: 'Error: Contrasena incorrecta'})
  }
  //Verificar que nuevas contrasena sean iguales
  if(newpassword !== newpassword1){
    console.log('-----------> Error: Contrasenas nuevas no coinciden')
    res.status(401).send({codErr: '401', descerror: 'Error: Contrasenas nuevas no coinciden'})
  }
  //hash de nueva clave
  hash = userSession.generateHash(newpassword)

  console.log('User en cambiar Password:[' + username +']')
  console.log('-------> Pass Sess:[' + userSession.password + ']')
  console.log('-------> OldPass:  [' + password + ']')
  console.log('-------> newPass:  [' + newpassword + ']')
  console.log('-------> newPass1: [' + newpassword1 + ']')
  console.log('-------> newHash: [' + hash + ']')
  //actualizar nueva clave
  User.update(
    {username: username}, {$set:
      {password: hash}},
      {
          upsert: false,
          multi:false
      }, function(err, affected){
        if(err){
          console.log('--->Error - Error al actualizar clave en BD')
          res.status(401).send({codErr: '401', descerror: err})
        }
      }

  )
  res.status(200).send({codErr: '200', descerror: 'Cambio de contrasenas OK'})
}

function recuperarPassword(req,res){
  var username = req.body.username.toLowerCase().trim();
  var token=''
  async.waterfall([
    function (done){
      console.log('-----> Primero en DONE');
      crypto.randomBytes(20, function(err, buf){
        var token = buf.toString('hex')
        done(err, token)
      })
    },
    function (token, done){
      console.log('-----> Luego en Token, Done');
      User.findOne({username: {$regex: username, $options: "i"}}, function(err, user){
        if (!user) {
          console.log('Usuario no existe')
          res.status(401).send({codErr: '401', descerror: 'El usuario no existe'})
        }
        else{
          console.log('-----> Token-->'+ token+ '<---------------');
          user.resetPasswordToken = token
          user.resetPasswordExpires = Date.now() + 3600000;
          user.save(function(err){
            done(err, token, user)
          })
        }
      })
    },
    function(token, user, done){
      console.log('-----> Luego 2 en Token, Done, User');
      console.log('--> Guardar token pra pruebas['+ token+']');
      res.status(200).send({codErr: '200', descerror: 'Revisa tu correo con las instrucciones para restablecer tu contraseña'})
      //Descomentar para pruebas con envio de correo
      //sendResetPasswordEmail(req, res, user.username, token)
    }
  ],function(err){
    console.log('-----> Ahora en error');
    if (err) return next(err);
    res.status(401).send({codErr: '500', descerror: 'Error al recuperar contraseña'})
  })


/*
    User.findOne({username: {$regex: username, $options: "i"}}).then(function(user){
      console.log('------>user:-->'+ user + '<-----' );
      if (user) {
        console.log('Encontro a usuario')
        crypto.randomBytes(20, function(err, buf){
          token = buf.toString('hex');
          console.log('-----> Token-->'+ token+ '<---------------');
        })
          console.log('-----> Token 2-->'+ token+ '<---------------');

          res.status(200).send({'msg' : 'todo OK'})

        //sendResetPasswordEmail(req, res, user.username)
      }else{
          console.log('Usuario no existe')
          res.status(401).send({codErr: '401', descerror: 'El usuario no existe'})
      }
    })
*/
}

function sendResetPasswordEmail(req, res, email, token){
  console.log('---------->Enviando correo de recuperacion de contraseña<--------------');
  console.log('Token antes de enviar email---->' + token + '<--------');
  var mailOptions = {
    from: '"Le Drug Store" <' + configfile.emailUser + '>', // sender address
    to: email, // list of receivers
    subject: 'Recuperar contraseña', // Subject line
    text: 'Hello world ?', // plain text body
    html: '<div style="background: black;width:500px;margin:0px auto;margin-top:10px;margin-bottom:40px;padding:40px;font-style:tahoma">'+
          '<p style="text-align:center;color:white;font-size:15px">To reset your password, please click on the button below,'+
          ' or click the following link if the button does not work.</p><br><br>'+
          '<a style="text-decoration:none;margin-left:36%;background:rgb(25, 176, 153);'+
          'padding:20px;width:200px;border:none;color:white;font-style:bold;font-size:20px" '+
          'href="' + configfile.domainName + 'auth/reset/'+ token +'">Reset Password</a></div><br>'+
              configfile.domainName+  'auth/reset/' + token // html bod
  }

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        return console.log(error);
    }
    console.log('----->Message %s sent: %s', info.messageId, info.response);
});

  res.status(200).send({codErr: '200', descerror: 'Revisa tu correo con las instrucciones para restablecer tu contraseña'})
}

function verificarTokenParaResetearPassword(req, res){
  var tokenparaverificar = req.params.token.trim()
  console.log('-->token recibido['+ tokenparaverificar+']')
  console.log('Ahora buscar en DB');
  User.findOne({resetPasswordToken: tokenparaverificar, resetPasswordExpires: {$gt: new Date()}}, function(err, user){
    if(!user){
      console.log('dentro de if - token invalido');
      res.status(401).send({codErr: '401', descerror: 'El token ha expirado o es inválido'})
    }else{
      console.log('token ok - continua recuperar clave');
      res.status(200).send({codErr: '200', descerror: 'Token correcto, restablecer contraseña'})
    }
  })
}

module.exports = {
  actualizarLastLogin,
  cambiarPassword,
  recuperarPassword,
  verificarTokenParaResetearPassword
}
