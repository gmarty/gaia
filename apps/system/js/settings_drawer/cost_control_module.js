/* global applications */

'use strict';

/**
 * The cost control module gives quick access to the Usage app.
 */

(function(exports) {
  var host = document.location.host;
  var domain = host.replace(/(^[\w\d]+\.)?([\w\d]+\.[a-z]+)/, '$2');
  var protocol = document.location.protocol + '//';
  var origin = protocol + 'costcontrol.' + domain;

  var widgetContainer = document.getElementById('cost-control-module');
  var widgetFrame = null;

  var hashMark = 0;
  var activityCounter = 0;
  var ACTIVITY_THRESHOLD = 75;

  var CostControlModule = {
    init: function cc_init() {
      // Listen to `settingsdrawer` show/hide events.
      window.addEventListener('settingsdrawershow', this);
      window.addEventListener('settingsdrawerhide', this);
    },

    start: function cc_start() {
      if (!applications.ready) {
        return;
      }

      if (!applications.getByManifestURL(origin + '/manifest.webapp')) {
        return;
      }

      // Check widget is there
      widgetFrame = widgetContainer.querySelector('iframe');
      if (widgetFrame) {
        return;
      }

      widgetContainer.removeAttribute('hidden');

      // Create the widget
      if (!widgetFrame) {
        widgetFrame = document.createElement('iframe');
        widgetFrame.addEventListener('mozbrowsererror', this);
        widgetFrame.addEventListener('mozbrowserclose', this);
      }

      widgetFrame.dataset.frameType = 'widget';
      widgetFrame.dataset.frameOrigin = origin;

      widgetFrame.setAttribute('mozbrowser', true);
      widgetFrame.setAttribute('remote', 'true');
      widgetFrame.setAttribute('mozapp', origin + '/manifest.webapp');

      // Indicates the widget to load the new stylesheet rather than the one
      // used for the utility tray.
      widgetFrame.src = origin + '/widget.html#visual_refresh';
      widgetContainer.appendChild(widgetFrame);

      this.attachEvents();
    },

    attachEvents: function cc_attachEvents() {
      this.detachEvents();
      window.addEventListener('moznetworkupload', this);
      window.addEventListener('moznetworkdownload', this);
    },

    detachEvents: function cc_detachEvents() {
      window.removeEventListener('moznetworkupload', this);
      window.removeEventListener('moznetworkdownload', this);
    },

    handleEvent: function cc_handleEvent(evt) {
      switch (evt.type) {
        case 'settingsdrawershow':
          this.start();
          // Ensure the widget is updated when is visible.
          this.attachEvents();
          widgetFrame.setVisible(true);
          break;

        case 'settingsdrawerhide':
          // It's not necessary to update the widget when it is hidden.
          this.detachEvents();
          if (widgetFrame) {
            widgetFrame.setVisible(false);
          }
          break;

        case 'moznetworkupload':
        case 'moznetworkdownload':
          activityCounter++;
          if (activityCounter === ACTIVITY_THRESHOLD) {
            activityCounter = 0;
            window.removeEventListener('moznetworkupload', this);
            window.removeEventListener('moznetworkdownload', this);
            widgetFrame.addEventListener('mozbrowserlocationchange', this);
            widgetFrame.src = origin + '/widget.html#update#' + hashMark;
            hashMark = 1 - hashMark; // toogle between 0 and 1
          }
          break;

        case 'mozbrowserlocationchange':
          if (evt.detail.split('#')[1] === 'updateDone') {
            widgetFrame.removeEventListener('mozbrowserlocationchange', this);
            this.attachEvents();
          }
          break;

        case 'mozbrowsererror':
        case 'mozbrowserclose':
          widgetContainer.removeChild(widgetFrame);
          widgetFrame = null;
          break;
      }
    }
  };

  exports.CostControlModule = CostControlModule;
  CostControlModule.init();

}(window));
