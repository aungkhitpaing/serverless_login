'use strict'

const duration = Math.random();
var message = "";

function response(code,error_code = 0,data,path) {
    console.log("Message is " +data);
    var promise  =  new Promise(async(resolve, reject) => {
        
        var response = {
            success: 0,
            code: code,
            meta:{
                "method": "POST",
                "endpoint": path
            },
        };

        switch(code) {
            case 200:
                message = (data) ? data : [];
            case 400:
                message = (data) ? data : "Bad request";
                break;
            case 403:
                message = (data) ? data : "Unauthorized access";
                break;
            case 404:
                message =  (data) ? data : "Data Not Found";
                break;
            default:
                message =  (data) ? data :"Bad request error";          
        }

        if(code == 200) {
            Object.assign(response,{
                'success' : 1,
                'data' : message,
                'errors' : {},
                'duration': duration
            })
        } else {
            if(code ==  400 && error_code == 400002) {
                var err_arr = {};


                Object.assign(response,{
                    'data' : [],
                    'errors' : {
                        "message": "The request parameters are incorrect, please make sure to follow the documentation about request parameters of the resource.",
                        "code" : error_code,
                        "validation": [
                            message
                        ]

                    },
                    'duration': duration
                })
            } else {
                Object.assign(response,{
                    'data' : [],
                    'errors' : message,
                    'duration': duration
                })
            }
        }
        resolve(response);
    
    }).catch(err => {
    
        console.log(err);
    
    });

    return promise;
}
module.exports.response = response;
