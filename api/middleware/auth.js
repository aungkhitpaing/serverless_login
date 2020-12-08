/**
 *
 * Authentication Middleware
 *
 * @author Aung Khit Paing
 *
 * @version 1.0.0
 * @licence MIT
 *
 */

"use strict";

var AWS         = require('aws-sdk');
var Crypto      = require('crypto-js');

    /**
     * Middleware for auth
     * @param {*} req 
     */
    function getHubsynchSession(req) {
        
        const promise = new Promise(async (resolve, reject) => {
            if ( !req.headers['bff-api-key'] || !req.headers['bff-signature'] || !req.headers['bff-timestamp']) {
                return reject("Inncorect Auth");
            }
            var api_key = req.headers['bff-api-key'];
            var signature = req.headers['bff-signature'];
            var time_stamp = req.headers['bff-timestamp'];
            
            try {
            
                resolve([api_key,signature,time_stamp]);
            } catch (error) {
                console.log(error);
                reject("Api has error!");
            }
        });
        
        return promise;
    };
module.exports.getHubsynchSession = getHubsynchSession;
