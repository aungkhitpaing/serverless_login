/**
 *
 *  Validator
 *
 * @author Aung Khit Paing
 *
 * @version 1.0.0
 * @licence MIT
 *
 * @type {module:crypto}
 */

 "use strict"

 const Joi = require('joi');
 const schema = Joi.object().keys({
    email: Joi.string().required(),
    password: Joi.string().required()
  });

/**
 * Validate the passed parameters according to the rules of "Transactional Email".
 *
 * @params
 * return validation
 *
 */
function validate(data) {

    console.log(data);

    const promise = new Promise(async (resolve, reject) => {
        
        var error_msg = {};
        
        if(!data.email){
            var error_msg = Object.assign({"email":"email is required"},error_msg);
            return reject({
                code: 400001,
                message :error_msg,
            });
        }

        if(!data.password){
            var error_msg = Object.assign({"password":"password is required"},error_msg);
            return reject({
                code: 400001,
                message :error_msg,
            });
        }
            
        
        Joi.validate(data,schema, (err, value) => {
            if(err) {
                return reject({
                    code: 40003,
                    message: "Bad request. Inputs are invalid. Please check the error data.",
                    data: {
                        message : err.details[0]['message'],
                        field : err.details[0]['path'][0],
                    }
                });
            } else {
                console.log(value);
            }
        });
    });
    return promise;    
}
module.exports.validate = validate;