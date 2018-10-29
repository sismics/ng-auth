'use strict';

angular
    .module('ngAuth', [])
    .service('Auth', function($window, $location) {
        var user = {};
        var prefix = '';
        var requestedPath = null;
        var requiredPrivilege = null;

        /**
         * Check if the connected user has some base function.
         * Base function can be a string, or an array of strings in which case the user must have at least one of the functions.
         *
         * @param privilege Base function or array of base functions
         * @returns Condition
         */
        var check = function(privilege) {
            return privilege == null ||
                typeof privilege == 'object' && (_(privilege).isEmpty() || !_(_.intersection(user.privileges, privilege)).isEmpty()) ||
                typeof privilege == 'string' && _.includes(user.privileges, privilege);
        };

        var hasRequiredPrivilege = function() {
            return requiredPrivilege == null || check(requiredPrivilege);
        };

        return {
            getUser: function() {
                return user;
            },

            setUser: function(newUser) {
                user = newUser;
                if (!hasRequiredPrivilege()) {
                    user = {};
                }
            },

            hasRequiredPrivilege: hasRequiredPrivilege,

            /**
             * Set a prefix for authentication endpoints.
             * 
             * @param newPrefix The prefix
             */
            setPrefix: function(newPrefix) {
                prefix = newPrefix;
                return this;
            },

            /**
             * Return the prefix for authentication endpoints.
             *
             * @return The prefix
             */
            getPrefix: function() {
                return prefix;
            },

            /**
             * Set a privilege required for login.
             *
             * @param privilege The base function
             */
            setRequiredPrivilege: function(privilege) {
                requiredPrivilege = privilege;
                return this;
            },

            isConnected: function() {
                return user.id != null;
            },

            check: check,

            goToStartPage : function() {
                var requestedPath = null;
                if ($window.location.search) {
                    var match = /\?requestedPath\=(.+)/.exec($window.location.search);
                    if (match) {
                        requestedPath = match[1];
                    }
                }
                if (requestedPath) {
                    $location.path(requestedPath)
                }
            },

            getRequestedPath: function() {
                return requestedPath;
            },

            setRequestedPath: function(path) {
                requestedPath = path;
            }
        };
    })
    .controller('AuthController', function($scope, $rootScope, Restangular, Auth, Form, $state, $q) {
        $scope.userData = {};
        $scope.username = '';
        $scope.password = '';

        $rootScope.user = Auth;

        $scope.login = function() {
            $state.go('root.login');
        };

        $scope.submitLogin = function() {
            Restangular.all(Auth.getPrefix() + 'login').post({username: $scope.username, password: $scope.password})
                .then(function(data) {
                    return Restangular.one(Auth.getPrefix() + 'user').one('info').get();
                })
                .then(function (data) {
                    Auth.setUser(data.item);
                    if (!Auth.hasRequiredPrivilege()) {
                        $rootScope.error = Form.parseError({data: {global: [{message: "login_error", key: "global", variables: []}]}});
                        Form.globalError();
                        return $q.reject();
                    }
                    $scope.reloadApp();
                });
        };

        $scope.submitLogout = function() {
            Restangular.one(Auth.getPrefix() + 'logout').post().then(function(data) {
                $scope.reloadApp();
            });
        };

        $scope.reloadApp = function() {
            $state.go('root.wait');
        };
    })
    .directive('check', function(Auth) {
        return {
            replace: true,
            restrict: 'A',
            link: function(scope, element, attr) {
                scope.$watch(attr.check, function(read) {
                    element.css('display', Auth.check(read) ? '' : 'none');
                });
            }
        };
    })
    .run(function($rootScope, $state, $location, Auth) {
        // Handle ui-router state change errors (e.g. unresolved resources due to 403)
        $rootScope.$on('$stateChangeError', function(event, toState, toParams, fromState, fromParams, error) {
            Auth.setRequestedPath($location.path());
            $state.go('root.index.home');
        });
    });