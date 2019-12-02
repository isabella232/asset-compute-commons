/**
 * ADOBE CONFIDENTIAL
 * ___________________
 *
 *  Copyright 2019 Adobe
 *  All Rights Reserved.
 *
 * NOTICE:  All information contained herein is, and remains
 * the property of Adobe and its suppliers, if any. The intellectual
 * and technical concepts contained herein are proprietary to Adobe
 * and its suppliers and are protected by all applicable intellectual
 * property laws, including trade secret and copyright laws.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Adobe.
 */

'use strict';

const clone = require('clone');
const urlValidator = require('valid-url');
const urlParser = require('url');

// <----------------------- Fields to redact ----------------------->
const CREDENTIAL_FIELDS_TO_REDACT = [
                                        "newRelicApiKey", 
                                        "accessToken", 
                                        "uploadToken"
                                    ];
const URL_FIELDS_TO_REDACT = [
                                "url",
                                "urls",
                                "source",
                                "target"
                            ];

// <---------------------- Redaction helpers ---------------------->
// redacts a field by replacing it with "[...REDACTED...]"
function redactField(){
    return "[...REDACTED...]";
}

// redacts a url field keeping only protocol and hostname (host+port)
function redactUrlField(url){
    if(url && urlValidator.isHttpsUri(url)){
        const urlParts = urlParser.parse(url);
        return urlParts.protocol.concat("//", urlParts.host);
    } else {
        return url;
    }
}

// redacts an url or url array by keeping only protocol and hostname
function redactUrls(url){
    if(Array.isArray(url)){ // redact content of array, one by one
        for(let i = 0; i < url.length; i++){
            url[i] = redactUrlField(url[i]);
        }
        return url;
    } else if(typeof url === "string"){ // single field
        return redactUrlField(url);
    } else {
        return url;
    }
}

// <--------------------- Redaction functions --------------------->
/**
 * Recursively goes through an object and redacts values for the
 * list of known fields.
 *
 * @param {object} obj object with fields to redact
 * @param {array} redactionList list of fields to remove/redact
 * @param {boolean} silentRemove remove field when true, marks it as redacted when false
 * @param {function} redactionFn optional, function to use for field redaction
 */
function redact(obj, redactionOptions, silentRemove, callCount=0) {
    if(callCount === 0){ // first recursion call
        obj = clone(obj);
    }

    const innerKeyRedaction = function (redactionOptions, key){
        if(!Array.isArray(redactionOptions)) return;

        for(let i = 0; i < redactionOptions.length; i++){
            const currentRule = redactionOptions[i];
            if (currentRule.redactionList.includes(key)) {
                if(silentRemove){
                    delete obj[key];
                } else if(typeof currentRule.redactionFn === "function"){
                    obj[key] = currentRule.redactionFn(obj[key]);
                }
            } 
        }
    };

    const innerFlatFieldRedaction = function(redactionOptions){
        if(!Array.isArray(redactionOptions)) return;

        for(let i = 0; i < redactionOptions.length; i++){
            const currentRule = redactionOptions[i];
            if(typeof currentRule.redactionFn === "function"){
                obj = currentRule.redactionFn(obj);
            }
        }
    }

    if(typeof obj === "string" || Array.isArray(obj)){
        innerFlatFieldRedaction(redactionOptions);
    } else {
        Object.keys(obj).forEach(key => {
            innerKeyRedaction(redactionOptions, key);
            
            const value = obj[key];
            if ((typeof value === 'object') && (value !== null)) {
                redact(value, redactionOptions, silentRemove, ++callCount);
            }
        });
    }

    return obj;
}

// <--------------------- Redacted fields logger --------------------->
class AssetComputeLogUtils {
    /**
     * Prevent full urls from ending in activation results etc.
     * Recursively goes through the object and redact values for the
     * list of known fields. Note: this modifies the object!
     * Redaction will keep only protocol, hostname and port from
     * the original url.
     *
     * @param {any} item item with url(s) to redact. 
     * Can be a string (single url) or an array of urls or an object containing urls.
     */
    static redactUrl(item) {
        const rules = [{ redactionList: URL_FIELDS_TO_REDACT, redactionFn: redactUrls}];
        return redact(item, rules, false);
    }

    /**
     * Log an object, redacts credential and url fields
     *
     * @param {object} params object to log. Credentials will be redacted
     * @param {string} message message for log function
     */
    static log(item, message){
        const rules = [
                { redactionList: CREDENTIAL_FIELDS_TO_REDACT, redactionFn: redactField },
                { redactionList: URL_FIELDS_TO_REDACT, redactionFn: redactUrls }
            ];
        const clonedObj = redact(item, rules, false);

        if(message) {
            console.log(message, ":", clonedObj);
        } else {
            console.log(clonedObj);
        }        
    }
}

module.exports = AssetComputeLogUtils;