(function (root, factory) {
  // AMD
  if (typeof define === 'function' && define.amd) define(['angular'], factory);
  // Global
  else factory(angular);
}(this, function (angular) {
  'use strict';

  // Polyfill setImmediate function.
  var setImmediate = window && window.setImmediate ? window.setImmediate : function (fn) {
    setTimeout(fn, 0);
  };

  var module = angular.module('alloyeditor', []);

  module.directive('alloyEditor', [
    '$q',
    function alloyEditorDirective ($q) {

      function postLink($scope, $element, $attributes, $controllers) {
        var controller = $controllers[0];
        var ngModelController = $controllers[1];

        var editorElement = $element.find('div');
        controller.editorIsCreate = editorElement.attr('contenteditable') && editorElement.attr('contenteditable').toLowerCase() == 'true';

        // Initialize the editor content when it is ready.
        controller.ready().then(function initialize() {
          // Sync view on specific events.
          ['change', 'blur'].forEach(function syncViewEvent(event) {
            controller.onEvent(event, function syncView() {
              ngModelController.$setViewValue(controller.nativeEditor().getData() || '');
            });
          });

          $scope.$watch('readonly', function (newValue, oldValue) {
            if(newValue != oldValue){
              controller.nativeEditor().setReadOnly(!! newValue);
            }
            console.log('read', newValue);
          });

          controller.onEvent('focus', function syncTouched() {
            ngModelController.$setTouched();
          });

        });

        // Set editor data when view data change.
        ngModelController.$render = function syncEditor() {
          controller.ready().then(function () {
            controller.nativeEditor().setData(ngModelController.$viewValue || '', {
              noSnapshot: true,
              callback: function () {
                // Amends the top of the undo stack with the current DOM changes
                // ie: merge snapshot with the first empty one
                // http://docs.ckeditor.com/#!/api/CKEDITOR.editor-event-updateSnapshot
                controller.nativeEditor().fire('updateSnapshot');
              }
            });
          });
        };
      }

      var controller = [
        '$q', '$scope',
        function alloyEditorController($q, $scope) {
          var self = this;
          var readyDeferred = $q.defer(); // a deferred to be resolved when the editor is ready

          /**
          * create a instance of Editor.
          *
          * @returns {Object} instance of editor.
          */
          function createInstance() {
            if(!self.editorIsCreate) {
              self.instance = AlloyEditor.editable('myEditorTest');
              controller.editorIsCreate = true;
            }
            return self.instance;
          }

          /**
          * Listen on events of a given type.
          * This make all event asynchronous and wrapped in $scope.$apply.
          *
          * @param {String} event
          * @param {Function} listener
          *
          * @returns {Function} Deregistration function for this listener.
          */
          self.onEvent = function (event, listener) {
            self.nativeEditor().on(event, asyncListener);

            function asyncListener() {
              var args = arguments;
              setImmediate(function () {
                applyListener.apply(null, args);
              });
            }

            function applyListener() {
              var args = arguments;
              $scope.$apply(function () {
                listener.apply(null, args);
              });
            }

            // Return the deregistration function
            return function $off() {
              self.nativeEditor().removeListener(event, applyListener);
            };
          };

          /**
          * Check if the editor if ready.
          *
          * @returns {Promise}
          */
          self.ready = function ready() {
            return readyDeferred.promise;
          };

          self.nativeEditor = function nativeEditor() {
            return self.instance.get('nativeEditor');
          };

          // Destroy editor when the scope is destroyed.
          $scope.$on('$destroy', function onDestroy() {
            // do not delete too fast or pending events will throw errors
            readyDeferred.promise.then(function() {
              self.instance.destroy();
            });
          });

          createInstance();
          self.onEvent('instanceReady', function() {
            readyDeferred.resolve(true);
          });
        }
      ];

      return {
        restrict: 'E',
        scope: {
          readonly: '=',
          toolbar: '&'
        },
        require: ['alloyEditor', 'ngModel'],
        template: '<div id="myEditorTest" class="alloy-editor"></div>',
        controller: controller,
        link: postLink
      };
    }
  ]);
}));