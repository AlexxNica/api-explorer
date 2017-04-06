/*
 * Copyright (c) 2016 VMware, Inc. All Rights Reserved.
 * This software is released under MIT license.
 * The full license information can be found in LICENSE in the root directory of this project.
 */
(function(angular) {

    "use strict";

    var serviceName = "apis";

    service.$inject = [ "$http", "$q", "$rootScope", "$cacheFactory", "filterFilter" ];

    function service($http, $q, $rootScope, $cacheFactory, filterFilter) {

        var cache = $cacheFactory(serviceName);

        var emptyResult = {
            apis : [],
            filters : {
                products : [],
                languages : [],
                types : [],
                sources : []
            }
        };

        var definitions = {
                getAllApis : function(){
                    var cacheKey = "allApis";
                    var deferred = $q.defer();

                    var result = cache.get(cacheKey);

                    if (result) {
                        deferred.resolve(result);
                    } else {
                        var result = angular.merge({}, emptyResult);

                        // Combine all API sources into a single result
                        $q.all([definitions.getRemoteApis(), definitions.getLocalApis()]).then(function(responses){
                            angular.forEach(responses, function(response, index) {
                                result.filters.products.pushUnique(response.filters.products, true);
                                result.filters.languages.pushUnique(response.filters.languages, true);
                                result.filters.types.pushUnique(response.filters.types, true);
                                result.filters.sources.pushUnique(response.filters.sources, true);
                                result.apis = result.apis.concat(response.apis);
                            });
                        }).finally(function() {
                            cache.put(cacheKey, result);
                            deferred.resolve(result);
                        });
                    }

                    return deferred.promise;
                },
                getRemoteApis : function(){
                    var deferred = $q.defer();
                    var result = angular.merge({}, emptyResult);

                    $http({
                        method : 'GET',
                        url : $rootScope.settings.remoteApisEndpoint + '/apis'
                    }).then(function(response) {

                        angular.forEach(response.data, function(value, index) {
                        	var source = "remote";

                            // Get type and products from tags
                            var type = "swagger";
                            var products = [];
                            var languages = [];
                            var add = false;

                            if (value.tags && value.tags.length > 0) {
                                if (angular.isArray(value.tags)) {
                                    type = filterFilter(value.tags, {category: "display"}, true)[0].name;
                                    var keepGoing = true;
                                    angular.forEach(filterFilter(value.tags, {category: "product"}, true), function(value, index) {
                                    	products.push(value.name);
                                    });

                                    angular.forEach(filterFilter(value.tags, {category: "programming-language"}, true), function(value, index) {
                                    	languages.push(value.name);
                                    });
                                }
                            }

                            // Clean the type
                            if (type == "iframe-documentation" || (value.api_ref_doc_url && value.api_ref_doc_url.endsWith(".html"))) {
                           		type = "html";
                            }

                            result.apis.push({
                            	id: parseInt(value.id, 10),
                            	name: value.name,
                            	version: value.version,
                            	api_uid: value.api_uid,
                            	description: value.description,
                            	url: value.api_ref_doc_url,
                            	type: type,
                            	products: products,
                            	languages: languages,
                            	source: source
                           });
                        });

                    }).finally(function() {
                        deferred.resolve(result);
                    });

                    return deferred.promise;
                },
                getLocalApis : function(){
                    var deferred = $q.defer();

                    var result = angular.merge({}, emptyResult);

                    $http({
                        method : 'GET',
                        url : $rootScope.settings.localApisEndpoint
                    }).then(function(response) {

                        angular.forEach(response.data.apis, function(value, index) {
                            value.id = 10000 + index;
                            value.source = "local";

                            // if the local api did not provide an explict type, then
                            // try to figure it out from the url spec file
                            if (!value.type || 0 === value.type.length) {
	                            if (value.url && value.url.endsWith(".json")) {
	                                value.type = "swagger";
	                            } else if (value.url && value.url.endsWith(".raml")) {
	                                value.type = "raml";
	                            } else {
	                                value.type = "html";
	                            }
                            }

                            result.filters.products.pushUnique(value.products, true);
                            result.filters.languages.pushUnique(value.languages, true);
                            result.filters.types.pushUnique(value.type);
                            result.filters.sources.pushUnique(value.source);

                            result.apis.push(value);
                        });

                    }).finally(function() {
                        deferred.resolve(result);
                    });

                    return deferred.promise;
                },
                getRemoteApiResources : function(apiId){
                	var deferred = $q.defer();
                    var result = {resources:{}};

                    $http({
                        method : 'GET',
                        url : $rootScope.settings.remoteApisEndpoint + '/apis/' + apiId + '/resources'
                    }).then(function(response) {

                    	var sdks = [];
                        var docs = [];

                        var setArray = function(resourceType, arr, value) {
                        	if (value.resource_type == resourceType) {

                        		arr.push({
                                	title: value.name + ' ' + value.version,
                                    webUrl: value.web_url,
                                    downloadUrl: value.download_url,
                                    categories: value.categories,
                                    tags: value.tags
                                });
                            }
                        }

                        angular.forEach(response.data, function(value, index) {
                            setArray("SDK", sdks, value);
                            setArray("DOC", docs, value);
                        });

                        if (sdks.length || docs.length) {
                            console.log("got " + sdks.length + " sdks, " + docs.length + " docs");
                            if (sdks.length) {
                             	result.resources.sdks = sdks;
                            }
                        	if (docs.length) {
                        		result.resources.docs = docs;

                                angular.forEach(result.resources.docs, function(value, index) {
                                    if (value.categories && (value.categories.length > 0) && value.categories[0] == 'API_OVERVIEW') {
                                        console.log("setting overview doc");
                                        console.log(value);
                                        result.resources.overview = value;
                                        value.webUrl = value.downloadUrl;
                                    }
                                });
                        	}
                        }
                    }).finally(function() {
                        deferred.resolve(result);
                    });

                    return deferred.promise;
                },
                getSamples : function(platform){
                	var deferred = $q.defer();
                    var result = null;
                    if (!platform) {
                    	return;
                    }
                    var url = $rootScope.settings.remoteSampleExchangeApiEndPoint + '/search/samples?';
                    angular.forEach(platform.split(","), function(value, index) {
                    	if (index == 0) {
                    		url = url + 'platform=' + value;
                    	} else {
                    		url = url + '&platform=' + value;
                    	}

                    });

                    $http({
                        method : 'GET',
                        url : url + '&summary=true'
                    }).then(function(response) {
                    	var samples = [];

                        angular.forEach(response.data, function(value, index) {
                        	var tags = [];
                        	if (value.tags) {
                                if (angular.isArray(value.tags)) {

                                    angular.forEach(value.tags, function(tag, index) {
                                        tags.push(tag.name);
                                    });
                                }
                            }
                        	//console.log(tags);
                        	samples.push({
                            	title: value.name,
                            	platform: platform,
                                webUrl: value.webUrl,
                                downloadUrl: value.downloadUrl,
                                contributor: value.author.communitiesUser,
                                createdDate: value.created,
                                lastUpdated: value.lastUpdated,
                                tags: tags,
                                snippet: value.readmeHtml,
                                favoriteCount: value.favoriteCount
                                //commentCount: 3
                            });
                        });

                        if (samples.length) {
                        	result = {data:{}};
                        	result.data = samples;
                        }
                    },function(response) {
                    	var temp = response.data;
                    	console.log(temp);
                    }).finally(function() {
                        deferred.resolve(result);
                    });

                    return deferred.promise;
                },
                /* as the name implies this method calls web service to get a list of available API instances
                * versions from the web service and returns the id of the latest one in the result.data.
                * @return a promise for an object with data = id of the API
                */
                getLatestRemoteApiIdForApiUid : function(api_uid) {
                    var deferred = $q.defer();
                    var result = {data:null};

                    $http({
                        method : 'GET',
                        url : $rootScope.settings.remoteApisEndpoint + '/apis/uids/' + api_uid
                    }).then(function(response) {

                        console.log("got response " + response)

                        // TODO sort through these Api instances and get the latest versions
                        // API id
                        if (response.data && response.data.length > 0) {
                            // TODO delete this debug code eventually
                            angular.forEach(response.data, function(value, index) {
                                console.log("api_uid=" + api_uid + " id=" + value.id + " version=" + value.version);
                            });
                            // get the last one
                            result.data = response.data[response.data.length-1].id;

                        } else {
                            console.log("api_uid=" + api_uid + " has no API instances.");
                        }
                    }).finally(function() {
                        deferred.resolve(result);
                    });
                    return deferred.promise;
                }
            };

        return definitions;
    }

    // Service used to fetch the APIs
    angular.module("apiExplorerApp").factory(serviceName, service);

})(angular);