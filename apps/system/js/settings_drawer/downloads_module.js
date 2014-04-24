/* jshint nonew: false */
/* global MozActivity */
/* exported DownloadsModule */

'use strict';

/**
 * The downloads module is a shortcut to the list of downloads.
 */

(function(exports) {
  var element = document.getElementById('settings-drawer-downloads');

  var DownloadsModule = {
    /**
     * Activate the downloads module.
     * Called by SettingsDrawer.
     */
    start: function dm_start() {
      element.addEventListener('click', this);
    },

    /**
     * Deactivate the downloads module.
     * Called by SettingsDrawer.
     */
    stop: function dm_stop() {
      element.removeEventListener('click', this);
    },

    handleEvent: function dm_handleEvent(evt) {
      evt.preventDefault();
      new MozActivity(
        {
          name: 'configure',
          data: {
            target: 'device',
            section: 'downloads'
          }
        }
      );
    }
  };

  exports.DownloadsModule = DownloadsModule;

}(window));
