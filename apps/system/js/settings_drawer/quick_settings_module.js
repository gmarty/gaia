/* jshint loopfunc: true, nonew: false */
/* global SettingsHelper, SettingsListener, AirplaneMode, SettingsDrawer,
          MozActivity, applications */
/* exported QuickSettingsModule */

'use strict';

/**
 * Quick settings module of Settings Drawer.
 */

(function(exports) {
  var WIFI_STATUSCHANGE_TIMEOUT = 2000;

  var LABEL = {
    'lte': '4G', // 4G LTE
    'ehrpd': '4G', // 4G CDMA
    'hspa+': 'H+', // 3.5G HSPA+
    'hsdpa': 'H', 'hsupa': 'H', 'hspa': 'H', // 3.5G HSDPA
    // 3G CDMA
    'evdo0': '3G', 'evdoa': '3G', 'evdob': '3G', '1xrtt': '3G',
    'umts': '3G', // 3G
    'edge': 'E', // EDGE
    'is95a': '2G', 'is95b': '2G', // 2G CDMA
    'gprs': '2G'
  };


  // ID of elements to create references.
  var ELEMENTS = [
    'wifi',
    'data',
    'bluetooth',
    'airplane-mode',
    'full-app'
  ];

  var overlay;

  var QuickSettingsModule = {
    init: function qs_init() {
      var settings = navigator.mozSettings;
      if (!settings) {
        return;
      }

      this.getAllElements();

      (function initNetworkSprite() {
        var networkTypeSetting = SettingsHelper('operatorResources.data.icon',
          {});

        networkTypeSetting.get(function gotNS(networkTypeValues) {
          if (!networkTypeValues) {
            return;
          }
          var sprite = networkTypeValues.data_sprite;
          if (sprite) {
            this.data.style.backgroundImage = 'url("' + sprite + '")';
          }
        });
      })();

      overlay = document.getElementById('quick-settings-module');
      overlay.addEventListener('click', this);

      this.monitorDataChange();
      this.monitorBluetoothChange();
      this.monitorWifiChange();
      this.monitorAirplaneModeChange();
    },

    /**
     * Monitor wifi setting and initialization/disable ready event
     * - when settings changed, update UI and lock toogle to prevent quickly
     *   tapping on it.
     * - when got bluetooth initialization/disable ready, active toogle, so
     *   return the control to user.
     */
    monitorWifiChange: function qs_monitorWifiChange() {
      var wifiFirstSet = true;
      SettingsListener.observe('wifi.enabled', true, function(value) {
        // check this.wifi.dataset.enabled and value are identical
        if ((this.wifi.dataset.enabled && value) ||
          (this.wifi.dataset.enabled === undefined && !value)) {
          return;
        }

        if (value) {
          this.wifi.dataset.enabled = 'true';
        } else {
          delete this.wifi.dataset.enabled;
        }
        // Set to the initializing state to block user interaction until the
        // operation completes. (unless we are being called for the first time,
        // where Wifi is already initialize
        if (!wifiFirstSet) {
          this.wifi.dataset.initializing = 'true';
        }
        wifiFirstSet = false;
      }.bind(this));

      window.addEventListener('wifi-enabled', this);
      window.addEventListener('wifi-disabled', this);
      window.addEventListener('wifi-statuschange', this);
    },

    monitorAirplaneModeChange: function qs_monitorAirplaneModeChange() {
      SettingsListener.observe('ril.radio.disabled', false, function(value) {
        this.data.dataset.airplaneMode = value;
        if (value) {
          this.data.classList.add('quick-settings-airplane-mode');
          this.airplaneMode.dataset.enabled = 'true';
        } else {
          this.data.classList.remove('quick-settings-airplane-mode');
          delete this.airplaneMode.dataset.enabled;
        }
      }.bind(this));
    },

    /**
     * Monitor bluetooth setting and initialization/disable ready event
     * - when settings changed, update UI and lock toggle to prevent quickly
     *   tapping on it.
     * - when got bluetooth initialization/disable ready, active toggle, so
     *   return the control to user.
     */
    monitorBluetoothChange: function qs_monitorBluetoothChange() {
      var btFirstSet = true;
      SettingsListener.observe('bluetooth.enabled', true, function(value) {
        // check this.bluetooth.dataset.enabled and value are identical
        if ((this.bluetooth.dataset.enabled && value) ||
          (this.bluetooth.dataset.enabled === undefined && !value)) {
          return;
        }

        if (value) {
          this.bluetooth.dataset.enabled = 'true';
        } else {
          delete this.bluetooth.dataset.enabled;
        }

        // Set to the initializing state to block user interaction until the
        // operation completes. (unless we are being called for the first time,
        // where Bluetooth is already initialize
        if (!btFirstSet) {
          this.bluetooth.dataset.initializing = 'true';
        }
        btFirstSet = false;
      }.bind(this));

      window.addEventListener('bluetooth-adapter-added', this);
      window.addEventListener('bluetooth-disabled', this);
    },

    monitorDataChange: function qs_monitorDataChange() {
      var connections = navigator.mozMobileConnection ||
        navigator.mozMobileConnections;

      if (!connections) {
        // Hide data icon without mozMobileConnection object.
        overlay.classList.add('non-mobile');
      } else {
        for (var i = 0; i < connections.length; i++) {
          connections[i].addEventListener('datachange', this);
        }

        /*
         * monitor data setting
         * TODO prevent quickly tapping on it
         */
        SettingsListener.observe('ril.data.enabled', true, function(value) {
          if (value) {
            this.data.dataset.enabled = 'true';
          } else {
            delete this.data.dataset.enabled;
          }
        }.bind(this));
      }
    },

    handleEvent: function qs_handleEvent(evt) {
      evt.preventDefault();
      switch (evt.type) {
        case 'click':
          evt.stopPropagation();
          var enabled = false;
          switch (evt.target) {
            case this.wifi:
              // Do nothing if wifi isn't ready.
              if (this.wifi.dataset.initializing) {
                return;
              }

              enabled = !!this.wifi.dataset.enabled;
              SettingsListener.getSettingsLock().set({
                'wifi.enabled': !enabled
              });
              SettingsListener.getSettingsLock().set({
                'wifi.connect_via_settings': !enabled
              });
              if (!enabled) {
                this.toggleAutoConfigWifi = true;
              }
              break;

            case this.data:
              if (this.data.dataset.airplaneMode !== 'true') {
                // TODO Ignore the action if data initialization isn't done
                enabled = !!this.data.dataset.enabled;
                SettingsListener.getSettingsLock().set({
                  'ril.data.enabled': !enabled
                });
              }
              break;

            case this.bluetooth:
              // do nothing if bluetooth isn't ready
              if (this.bluetooth.dataset.initializing) {
                return;
              }

              enabled = !!this.bluetooth.dataset.enabled;
              SettingsListener.getSettingsLock().set({
                'bluetooth.enabled': !enabled
              });
              break;

            case this.airplaneMode:
              AirplaneMode.enabled = !this.airplaneMode.dataset.enabled;
              break;

            case this.fullApp:
              // XXX: This should be replaced probably by Web Activities
              var host = document.location.host;
              var domain = host.replace(/(^[\w\d]+\.)?([\w\d]+\.[a-z]+)/, '$2');
              var protocol = document.location.protocol + '//';
              applications.getByManifestURL(protocol + 'settings.' +
                domain +
                '/manifest.webapp').launch();

              SettingsDrawer.hide();
              break;
          }
          break;

        // Unlock wifi toggle.
        case 'wifi-enabled':
          delete this.wifi.dataset.initializing;
          this.wifi.dataset.enabled = 'true';
          if (this.toggleAutoConfigWifi) {
            // Check whether it found a wifi to connect after a timeout.
            this.wifiStatusTimer = setTimeout(this.autoConfigWifi.bind(this),
              WIFI_STATUSCHANGE_TIMEOUT);
          }
          break;

        case 'wifi-disabled':
          delete this.wifi.dataset.initializing;
          delete this.wifi.dataset.enabled;
          if (this.toggleAutoConfigWifi) {
            clearTimeout(this.wifiStatusTimer);
            this.wifiStatusTimer = null;
            this.toggleAutoConfigWifi = false;
          }
          break;

        case 'wifi-statuschange':
          if (this.toggleAutoConfigWifi && !this.wifi.dataset.initializing) {
            this.autoConfigWifi();
          }
          break;

        // Unlock bluetooth toggle.
        case 'bluetooth-adapter-added':
        case 'bluetooth-disabled':
          delete this.bluetooth.dataset.initializing;
          break;

        case 'datachange':
          var connections = navigator.mozMobileConnection ||
            navigator.mozMobileConnections;
          var dataType = '';

          if (!connections) {
            return;
          }

          // Whenever a data connection is updated, we would just use that.
          for (var i = 0; i < connections.length; i++) {
            dataType = LABEL[connections[i].data.type] || dataType;
          }
          this.data.dataset.network = dataType;
          break;
      }
    },

    getAllElements: function qs_getAllElements() {
      var toCamelCase = function toCamelCase(str) {
        return str.replace(/\-(.)/g, function replacer(str, p1) {
          return p1.toUpperCase();
        });
      };

      ELEMENTS.forEach(function createElementRef(name) {
        this[toCamelCase(name)] =
          document.getElementById('quick-settings-module-' + name);
      }, this);
    },

    /**
     * Auto-config wifi if user enabled wifi from quick settings bar.
     * If there are no known networks around, wifi settings page
     * will be opened. Otherwise nothing will be done.
     */
    autoConfigWifi: function qs_autoConfigWifi() {
      clearTimeout(this.wifiStatusTimer);
      this.wifiStatusTimer = null;
      this.toggleAutoConfigWifi = false;

      var wifiManager = navigator.mozWifiManager;
      var status = wifiManager.connection.status;

      if (status == 'disconnected') {
        SettingsListener.getSettingsLock().set({
          'wifi.connect_via_settings': false
        });
        new MozActivity({
          name: 'configure',
          data: {
            target: 'device',
            section: 'wifi'
          }
        });
      } else if (status == 'connectingfailed') {
        SettingsListener.getSettingsLock().set({
          'wifi.connect_via_settings': false
        });
      }
    }
  };

  exports.QuickSettingsModule = QuickSettingsModule;

}(window));

window.QuickSettingsModule.init();
