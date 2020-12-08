'use strict';


const uuid                = require('uuid');
const AWS                 = require('aws-sdk');
const body_parser         = require('../services/body_parser');
const Crypto              = require('crypto');
const joi                 = require('joi');
const unirest             = require('unirest'); //  unirest is a set of lightweight HTTP libraries
const { reject, resolve } = require('bluebird');
const customRes           = require('../services/responseFormatter');
const { object } = require('joi');
const DynamoDb            = new AWS.DynamoDB.DocumentClient({region: process.env.REGION});

AWS.config.setPromisesDependency(require('bluebird'));

/**
 * Create Middleware for login
 *
 * [POST] /login  endPoint.
 *
 * This endPoints work 1/login
 *
 */
const middleware = async(req,res,next) => {

    console.log('start');

    if ( !req.headers['bff-api-key'] || !req.headers['bff-signature'] || !req.headers['bff-timestamp']) 
    {
        console.log('*** Header key not exist error ***');
        await customRes.response(401,401001,{
            "message": "An application authorization was failed, please make sure to follow the documentation about API connection.",
            "code": 401001
        },req.path).then(error => {
            res.status(401).json(error);
        });
    }

    let api_key    = req.headers['bff-api-key'];
    let signature  = req.headers['bff-signature'];
    let time_stamp = req.headers['bff-timestamp'];
    let body       = {};


    body_parser.parse(req).then(inputs => {

        Object.assign(body,inputs);       
    });
    

    var params  = {
        TableName: 'Admin',
        FilterExpression: "#a = :api_key",
        ExpressionAttributeNames:{
            "#a": "api_key"
        },
        ExpressionAttributeValues: {
            ":api_key": req.headers['bff-api-key']
        }                        
    };
    console.log('1');
    // conneting with dynamo db to check credential key and connecting with hubsynch
    await DynamoDb.scan(params, async (err, data) => {
        
        if (err) {
            console.log('*** Dynamo db error ***');
            console.log(err, err.stack);
            await customRes.response(401,401001,{
                "message": "An application authorization was failed, please make sure to follow the documentation about API connection.",
                "code": 401001
            },req.path).then(error => {
                res.status(401).json(error);
            });
            
        } else {
            var dataItems = data.Items;
            if(dataItems && dataItems.length > 0) {
                console.log(data.Items);
                var hash = Crypto.createHmac('sha1', data.Items[0].api_secret).update(time_stamp + api_key).digest("hex");
                console.log('hash :'+hash);
                if(hash != signature) {

                    console.log('*** Wrong Signature key error ***');
                    await customRes.response(401,401001,{
                            "message": "An application authorization was failed, please make sure to follow the documentation about API connection.",
                            "code": 401001
                    },req.path).then(error => {
                        res.status(401).json(error);
                    });
                }            
                
                // connecting with hubsynch
                const result = connectHubsynch(data).then( hubsynchInfo => {
                     
                // Check input validation with custom message
                    inputValidation(body).then( errorMsg => {
                        console.log('*** Input validations errors ***');
                        var error_code = 400002;
                        customRes.response(400,error_code,errorMsg,req.path).then(error => {
                            res.status(400).json(error);
                        });
                    });

                    Object.assign(hubsynchInfo.params,{
                        'email' : body.email,
                        'password' : body.password
                    })    
                    console.log(hubsynchInfo);
                    
                    // Call api to hubsynch login
                    unirest.post(hubsynchInfo.url)
                    .headers(hubsynchInfo.headers).send(hubsynchInfo.params).then((response) => {
                        console.log(response.body._output);
                        if("error" in response.body._output) {

                            console.log('*** Authentication error from Hubsynch ***');
                            customRes.response(400,400500,{
                                "message": "The email or password was incorrect.",
                                "code": 400500
                            },req.path).then(error => {
                                res.status(400).json(error);
                            });

                        } 
                        else {
                            console.log('hubsynch response login data is '+ response.body._output)
                            req.email        = response.body._output.email;
                            req.hubsynch_id  = response.body._output.hubsynch_id;
                            req.session_id   = response.body._output['HVCHUBSYNCHSSID'];
                            req.hash_id      = response.body._output.hash_id;
                            req.first_name   = response.body._output.first_name;
                            req.last_name    = response.body._output.last_name;
                            next();
                        }

                    })
                });

            } else {
                console.log('*** Data is not exist error in dynamo db ***');
                await customRes.response(401,401001,{
                    "message": "An application authorization was failed, please make sure to follow the documentation about API connection.",
                    "code": 401001
                },req.path).then(error => {
                    res.status(401).json(error);
                });
            }   
        }
    })
    
}

/**
 * Input validation for login
 * @param {*} body 
 */
function inputValidation(body) {

    const promise = new Promise(async (resolve, reject) => {
        var error_msg       = {};
        
        if(body.hasOwnProperty("email") == false){
            Object.assign(error_msg,{
                "attribute" : "email",
                "errors":[
                    {
                        "key"    : "required",
                        "message": "The email field is required."                        
                    }
                ] 
            });
        }
        if(body.hasOwnProperty("password") == false){
            Object.assign(error_msg,{
                "attribute" : "password",
                "errors":[
                    {
                        "key"    : "required",
                        "message": "The password field is required."                        
                    }
                ] 
            });
        }
        if(Object.keys(error_msg).length > 0) {
            resolve(error_msg);    
        }
        
    });
    return promise;
}

/**
 * Connecting with hubsynch 
 * 
 * @param {*} data 
 */
function connectHubsynch(data) {
    
    const promise = new Promise(async (resolve, reject) => {
        // call hubsynch 
        let hubsynchSecret    = data.Items[0].authentication.api_secret;
        let hubsynchApi       = data.Items[0].authentication.api_key;
        let hubsynchTimeStamp = parseInt(Date.now() / 1000);
        let hubsynchSignature = Crypto.createHmac('sha1', hubsynchSecret).update(hubsynchTimeStamp + hubsynchApi).digest("hex");
        

        const hubsynchInfo = {
            url: 'https://stage.hubsynch.com/api/onlineconsumerapi/doo/selector/onlineapi/phase/login/type/json/',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json; charset=UTF-8',
                'Hvc-Hubsynch-Api-Key'   : hubsynchApi,
                'Hvc-Hubsynch-Timestamp' : hubsynchTimeStamp,
                'Hvc-Hubsynch-Signature' : hubsynchSignature
            },
            params : {
                'app_code':data.Items[0].authentication.app_code,
                'site_id':data.Items[0].authentication.site_id,
            }
        };      
        resolve(hubsynchInfo);
        
    }).catch(err => {
        console.log(err);
        reject(err);
    });

    return promise;
}

/**
 * get Old login data
 * 
 * @param {*} email 
 */
function getOldLoginSession(email){
    const promise  = new Promise(async (resolve, reject) => {

        var params = {
            TableName: process.env.LOGIN_HISTORIES_TABLE,
            FilterExpression: "#e = :email And #d = :deleted_at",
            ExpressionAttributeNames:{
                "#e" : "email",
                "#d" : "deleted_at"
            },
            ExpressionAttributeValues: {
                ":email": email,
                ":deleted_at" : "null"
            }                        
        };

        DynamoDb.scan(params, function(err, data) {
            if(err) {
                console.log(err);
            } else {
                // console.log(data);
                resolve(data);
            }
        });   
    });
    return promise;   
}


/**
 * Add timestamp into old login data
 * 
 * @param {*} params 
 */
function updateOldLoginData(params) {
    
    const promise = new Promise(async (resolve,reject) => {

        DynamoDb.update(params, (error, result) => {
            if(error) {
                console.log(error);
            } else {
                console.log(result);
                resolve(result);
            }
        });
    });
    return promise;
}

/**
 * Check crm user with hubsynch_id 
 * 
 * @param {*} params 
 */
function checkCrmUser(params) {
    
    const promise = new Promise(async (resolve,reject) => {
        var url = process.env.crmUserEndpoint+'?hubsynch_id='+params.hubsynch_id;

        unirest.get(url)
        .headers(params.headers).then((response) => {
            console.log("** check crm response **");
            console.log(response.body);
            resolve(response.body);            
        });
    });
    return promise;
}

/**
 * Create Crm Member 
 * 
 * @param {*} $params 
 */
function createCrmMember(params){
    
    const promise = new Promise(async (resolve,reject) => {

        var url = process.env.crmCreateMemberEndpoint;
        unirest.post(url)
        .headers(params.headers).send(params.member_info).then((response) => {
            console.log("** create crm member **");
            console.log(response.body);
            resolve(response.body);
        });
    });
    return promise;
}

/**
 * Mail Login Function
 * 
 * @param {*} api 
 * @param {*} opts 
 */
module.exports = (api,opts) =>  {
  
/**
 * Create Route POST method.
 *
 * [POST] /login  endPoint.
 *
 * This endPoints work 1/login
 *
 */
    api.post('/',middleware,async(req,res) => {
        
        try {  
          
          var data      = await body_parser.parse(req);
          
          var timestamp = new Date().getTime();
          
          var info      = {
              id:uuid.v4(),
              email:data.email,
              password: Crypto.createHmac('SHA1',data.password).update(data.password).digest('hex'),
              first_name: req.first_name,
              last_name: req.last_name,
              session: req.session_id,
              hubsynch_id: req.hubsynch_id,
              created_at: timestamp,
              updated_at: timestamp,
              deleted_at: "null",
            };
            var crmParams = {
                'hubsynch_id' : req.hubsynch_id,
                'headers': {
                    'Hvc-Crm-Api-Key'   : req.headers['bff-api-key'] ,
                    'Hvc-Crm-Signature' : req.headers['bff-signature'],
                    'Hvc-Crm-Timestamp' : req.headers['bff-timestamp'],
                }
            };

            
            // Check record exist or not and put Into Database
            let temp = {};

            await getOldLoginSession(req.email).then(oldSession => {
                
                let items = oldSession.Items;    

                if(items.length > 0) {

                    Object.assign(temp,{
                        TableName:process.env.LOGIN_HISTORIES_TABLE,
                        Key: {
                          id: items[0].id,
                        },
                        ExpressionAttributeNames: {
                          '#d': 'deleted_at',
                        },
                        ExpressionAttributeValues: {
                          ':deleted_at': timestamp,
                        },
                        UpdateExpression: 'SET #d = :deleted_at',
                        ReturnValues: 'ALL_NEW',
                    });
                }
            });
            console.log("** old session record **");
            console.log(temp);
            // destroy old session record
            if (Object.keys(temp).length > 0) {
                await updateOldLoginData(temp).then(result => {
                    console.log(result);
                })
            }


            /**
             *  Check CRM subscription user exist or not , If not exit create subscription and member
             */         
            var user     = await checkCrmUser(crmParams);
            var nickname = "null";

            if(user.code == 200 && user.data.length > 0 ) {

                console.log('crm user exist');
                
                var nickname  = user.data[0].nickname;
                var members   = user.data[0].members;
                console.log(members);

                if (Object.keys(members).length > 0 && members.member_id === null) {
                
                    console.log('** subscription exist and member id null **');
                
                    member_info = {
                        'user_id' : user.data[0].user_id,
                        'member_status' : 200,
                    };
                    
                    Object.assign(crmParams,{'member_info' : member_info})
                    await createCrmMember(crmParams);
                    console.log('create member succesful');
                }
            } 
            else {
                console.log('crm user not exist');
                
                var member_info = {
                    'hubsynch_id'   : req.hubsynch_id,
                    'member_status' : 200,
                    'first_name'    : req.first_name,
                    'last_name'     : req.last_name,
                    'email'         : req.email
                };
                Object.assign(crmParams,{
                    'member_info' : member_info
                });
                await createCrmMember(crmParams);
            }


            await DynamoDb.put({
                TableName: process.env.LOGIN_HISTORIES_TABLE,
                Item: info,
            }).promise();

            await customRes.response(200,200, {
                "hubsynch_id":req.hubsynch_id,
                "session_id" : req.session_id,
                "hash_id": req.hash_id,
                "nickname" : nickname
          
            },req.path).then(data => {
                res.status(200).json(data);
            });

        } catch (error) {
          console.log(error);
            await customRes.response(400,400000,error,req.path).then(error => {
              res.status(400).json(error);
            });
        }
    });
}
