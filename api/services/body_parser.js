'use strict'
const Busboy = require('busboy');

function parse(req){

    var promise  =  new Promise(async(resolve, reject) => {
        var contentType = req.headers['Content-Type'] || req.headers['content-type'];
        var busboy = new Busboy({ headers: { 'content-type': contentType}});
        var data = {};	

        if(contentType.indexOf("multipart/form-data") == 0)
        {
          busboy.on('field', (fieldname, val) =>{
            console.log('Field [%s]: value: %j', fieldname, val);
            data[fieldname] = val;
          })
          .on('finish', () =>{
            resolve(data);
          })
          .on('error', err => {
            console.log('failed', err);
            reject(err);
          });
          
          busboy.end(req.body);
        }
        else {
        	resolve(req.body);
        }
    }); 
    return promise;
}

module.exports.parse = parse;