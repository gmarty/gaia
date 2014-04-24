/* global SettingsListener, LazyLoader, lockScreen, DownloadsModule,
   MusicModule */
/* exported SettingsDrawer */

'use strict';

/**
 * Settings drawer gives a quick access to some settings.
 */

(function(exports) {
  var musicModule = null;

  var WINDOW_EVENTS = [
    'screenchange',
    'home',
    'utilitytrayshow',
    'attentionscreenshow',
    'emergencyalert',
    'simpinshow',
    'appopening',
    'launchapp',
    'displayapp'
  ];

  var SettingsDrawer = {
    isShowing: false, // Makes it easier for testing.

    // DOM elements as properties makes it easier for unit testing.
    screen: null,
    statusbarIcons: null,
    overlay: null,

    init: function sd_init() {
      this.screen = document.getElementById('screen');
      this.statusbarIcons = document.getElementById('statusbar-icons');
      this.overlay = document.getElementById('settings-drawer');

      // Listen for settings changes.
      SettingsListener.observe(
        'settings-drawer.enabled',
        false,
        function(value) {
          if (value) {
            this.start();
          } else {
            this.stop();
          }
        }.bind(this));

      if (navigator.mozMobileConnection || navigator.mozMobileConnections) {
        LazyLoader.load('js/settings_drawer/cost_control_module.js');
      }
    },

    /**
     * Activate the settings drawer.
     */
    start: function sd_start() {
      // Attach event listeners.
      this.statusbarIcons.addEventListener('click', this);
      this.overlay.addEventListener('click', this);

      WINDOW_EVENTS.forEach(function(eventType) {
        window.addEventListener(eventType, this);
      }.bind(this));

      this.overlay.addEventListener('transitionend', this);

      // Enable the modules.
      DownloadsModule.start();

      // Set up the music module, but only if |MusicModule| is
      // defined (we don't define it in tests)
      if (typeof MusicModule !== 'undefined') {
        musicModule = new MusicModule(document.getElementById('music-module'),
          {nowPlayingAction: 'openapp'});
      }
    },

    /**
     * Deactivate the settings drawer.
     * Will be removed when the utility tray goes away.
     */
    stop: function sd_stop() {
      this.hide(true);

      // Remove the event listeners.
      this.statusbarIcons.removeEventListener('click', this);
      this.overlay.removeEventListener('click', this);

      WINDOW_EVENTS.forEach(function(eventType) {
        window.removeEventListener(eventType, this);
      }.bind(this));

      this.overlay.removeEventListener('transitionend', this);

      // Disable the modules.
      DownloadsModule.stop();

      musicModule = null;
    },

    handleEvent: function sd_handleEvent(evt) {
      var target = evt.target;

      switch (evt.type) {
        case 'home':
          if (this.isShowing) {
            this.hide();
            evt.stopImmediatePropagation(); // Don't want other actions here.
          }
          break;

        case 'utilitytrayshow':
          this.hide();
          break;

        case 'screenchange':
          if (!evt.detail.screenEnabled) {
            this.hide(true);
          }
          break;

        case 'attentionscreenshow':
        case 'emergencyalert':
        case 'simpinshow':
        case 'appopening':
        case 'launchapp':
        case 'displayapp':
          this.hide(true);
          break;

        case 'click':
          if (lockScreen.locked) {
            return;
          }

          if (target === this.overlay) {
            this.hide();
            return;
          }

          if (target === this.statusbarIcons ||
            target.parentNode === this.statusbarIcons ||
            target.parentNode.parentNode === this.statusbarIcons) {
            if (!this.isShowing) {
              this.show();
            } else {
              this.hide();
            }
          }
          break;

        case 'transitionend':
          if (!this.isShowing) {
            this.overlay.setAttribute('hidden', '');
          }
          break;
      }
    },

    /**
     * Show the settings drawer.
     */
    show: function sd_show() {
      if (this.isShowing) {
        return;
      }

      this.isShowing = true;
      this.overlay.removeAttribute('hidden');

      // We slightly defer updating the visibility to allow the transition after
      // adding the `hidden` class.
      // `requestAnimationFrame` doesn't work here as the delay must be longer.
      setTimeout(function() {
        this.screen.classList.add('settings-drawer');
      }.bind(this), 16);

      var evt = new CustomEvent('settingsdrawershow', {
        bubbles: true,
        cancelable: true
      });
      window.dispatchEvent(evt);
    },

    /**
     * Hide the settings drawer.
     *
     * @param {boolean=} immediate Whether to animate the drawer.
     */
    hide: function sd_hide(immediate) {
      if (!this.isShowing) {
        return;
      }

      this.isShowing = false;

      if (immediate) {
        this.overlay.setAttribute('hidden', '');
        // Otherwise, this style substitution will happen at `transitionend`.
      }

      this.screen.classList.remove('settings-drawer');

      var evt = new CustomEvent('settingsdrawerhide', {
        bubbles: true,
        cancelable: true
      });
      window.dispatchEvent(evt);
    }
  };

  exports.SettingsDrawer = SettingsDrawer;

}(window));

window.SettingsDrawer.init();
