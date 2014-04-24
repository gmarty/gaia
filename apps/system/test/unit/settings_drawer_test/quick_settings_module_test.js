/* global MocksHelper, MockWifiManager, MockNavigatorSettings, MockL10n,
          MockNavigatorMozMobileConnections, MockSettingsListener,
          QuickSettingsModule, AirplaneMode */

'use strict';

require('/test/unit/mock_activity.js');
require('/test/unit/mock_l10n.js');
require('/test/unit/mock_wifi_manager.js');
require('/shared/test/unit/mocks/mock_settings_helper.js');
require('/shared/test/unit/mocks/mock_settings_listener.js');
require('/shared/test/unit/mocks/mock_navigator_moz_settings.js');
require('/shared/test/unit/mocks/mock_navigator_moz_mobile_connections.js');

require('/js/settings_drawer/quick_settings_module.js');

mocha.globals(['AirplaneMode']);

var mocksForQuickSettingsModule = new MocksHelper(
  [
    'MozActivity',
    'SettingsHelper',
    'SettingsListener',
    'NavigatorMozMobileConnections'
  ]).init();

suite('system/settings_drawer/quick_settings_module', function() {
  var originalWifiManager;
  var originalL10n;
  var originalSettings;
  var originalMozMobileConnections;
  var fakeQuickSettingsNode;
  var fakeEvt;

  mocksForQuickSettingsModule.attachTestHelpers();

  function createFakeEvent(type, opt) {
    opt = opt || {};

    return {
      type: type,
      target: opt.target,
      bubbles: opt.bubbles || false,
      cancelable: opt.cancelable || false,
      detail: opt.detail,
      _prevented: false,
      preventDefault: function() {
        this._prevented = true;
      },
      _stopped: false,
      stopPropagation: function() {
        this._stopped = true;
      },
      _immediatelyStopped: false,
      stopImmediatePropagation: function() {
        this._immediatelyStopped = true;
      }
    };
  }

  suiteSetup(function() {
    originalWifiManager = navigator.mozWifiManager;
    navigator.mozWifiManager = MockWifiManager;
    originalSettings = navigator.mozSettings;
    navigator.mozSettings = MockNavigatorSettings;
    originalL10n = navigator.mozL10n;
    navigator.mozL10n = MockL10n;
    originalMozMobileConnections = navigator.mozMobileConnections;
    navigator.mozMobileConnections = MockNavigatorMozMobileConnections;
  });

  suiteTeardown(function() {
    navigator.mozWifiManager = originalWifiManager;
    navigator.MozMobileConnections = originalMozMobileConnections;
    navigator.mozL10n = originalL10n;
    navigator.mozSettings = originalSettings;
  });

  setup(function() {
    MockNavigatorMozMobileConnections.mAddMobileConnection();
    window.AirplaneMode = {
      enabled: false
    };

    fakeQuickSettingsNode = document.createElement('div');
    fakeQuickSettingsNode.id = 'quick-settings-module';
    document.body.appendChild(fakeQuickSettingsNode);

    [
      'wifi',
      'data',
      'bluetooth',
      'airplane-mode',
      'full-app'
    ].forEach(function testAddElement(elementName) {
                var elt = document.createElement('div');
                elt.id = 'quick-settings-module-' + elementName;
                fakeQuickSettingsNode.appendChild(elt);
              });
    QuickSettingsModule.init();
  });

  teardown(function() {
    fakeQuickSettingsNode.parentNode.removeChild(fakeQuickSettingsNode);
  });

  suite('Wifi', function() {
    function changeStatusAndFireEvents(status) {
      MockWifiManager.connection.status = status;
      QuickSettingsModule.handleEvent(createFakeEvent('click', {
        target: QuickSettingsModule.wifi
      }));
      QuickSettingsModule.handleEvent(createFakeEvent('wifi-statuschange'));
    }

    test('connected', function() {
      changeStatusAndFireEvents('connected');
      assert
        .isTrue(MockNavigatorSettings.mSettings['wifi.connect_via_settings']);
    });

    test('connecting failed', function() {
      changeStatusAndFireEvents('connectingfailed');
      assert
        .isFalse(MockNavigatorSettings.mSettings['wifi.connect_via_settings']);
    });

    test('disconnected', function() {
      changeStatusAndFireEvents('disconnected');
      assert
        .isFalse(MockNavigatorSettings.mSettings['wifi.connect_via_settings']);
    });

    test('disable', function() {
      MockSettingsListener.mCallbacks['wifi.enabled'](true);
      QuickSettingsModule.handleEvent(createFakeEvent('click', {
        target: QuickSettingsModule.wifi
      }));

      assert
        .isFalse(MockNavigatorSettings.mSettings['wifi.connect_via_settings']);
    });

    suite('click events', function() {
      setup(function() {
        fakeEvt = createFakeEvent('click', QuickSettingsModule.wifi);
        QuickSettingsModule.handleEvent(fakeEvt);
      });

      test('should prevent default', function() {
        assert.isTrue(fakeEvt._prevented);
      });

      test('should stop propagation', function() {
        assert.isTrue(fakeEvt._stopped);
      });
    });
  });


  suite('Data', function() {
    var label = {
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

    function setDataTypeOnConn(index, value) {
      MockNavigatorMozMobileConnections[index].data = {};
      MockNavigatorMozMobileConnections[index].data.type = value;
    }

    suite('only one sim has data', function() {
      setup(function() {
        setDataTypeOnConn(0, 'umts');
        setDataTypeOnConn(1, undefined);
        var fakeEvt = createFakeEvent('datachange');
        MockNavigatorMozMobileConnections[0]
          .triggerEventListeners('datachange', fakeEvt);
      });

      test('we should get 3G label', function() {
        assert.equal(QuickSettingsModule.data.dataset.network, label.umts);
      });
    });

    suite('no sim has data', function() {
      setup(function() {
        setDataTypeOnConn(0, undefined);
        setDataTypeOnConn(1, undefined);
        var fakeEvt = createFakeEvent('datachange');
        MockNavigatorMozMobileConnections[0]
          .triggerEventListeners('datachange', fakeEvt);
      });

      test('we should get an empty label', function() {
        assert.equal(QuickSettingsModule.data.dataset.network, '');
      });
    });

    suite('click events', function() {
      setup(function() {
        fakeEvt = createFakeEvent('click', QuickSettingsModule.wifi);
        QuickSettingsModule.handleEvent(fakeEvt);
      });

      test('should prevent default', function() {
        assert.isTrue(fakeEvt._prevented);
      });

      test('should stop propagation', function() {
        assert.isTrue(fakeEvt._stopped);
      });
    });
  });


  suite('Airplane mode', function() {
    setup(function() {
      AirplaneMode.enabled = false;
    });

    test('click should disable AirplaneMode', function() {
      MockSettingsListener.mCallbacks['ril.radio.disabled'](false);
      QuickSettingsModule.handleEvent(createFakeEvent('click', {
        target: QuickSettingsModule.airplaneMode
      }));

      assert.isTrue(AirplaneMode.enabled);
    });

    test('click should toggle AirplaneMode', function() {
      MockSettingsListener.mCallbacks['ril.radio.disabled'](true);
      QuickSettingsModule.handleEvent(createFakeEvent('click', {
        target: QuickSettingsModule.airplaneMode
      }));

      assert.isFalse(AirplaneMode.enabled);
    });

    test('enabling RIL should update the UI', function() {
      MockSettingsListener.mCallbacks['ril.radio.disabled'](true);

      assert.equal(QuickSettingsModule.data.dataset.airplaneMode, 'true');
      assert.isTrue(QuickSettingsModule.data.classList
                      .contains('quick-settings-airplane-mode'));
      assert.equal(QuickSettingsModule.airplaneMode.dataset.enabled, 'true');
    });

    test('disabling RIL should update the UI', function() {
      MockSettingsListener.mCallbacks['ril.radio.disabled'](false);

      assert.equal(QuickSettingsModule.data.dataset.airplaneMode, 'false');
      assert.isFalse(QuickSettingsModule.data.classList
                       .contains('quick-settings-airplane-mode'));
      assert.isUndefined(QuickSettingsModule.airplaneMode.dataset.enabled);
    });

    suite('click events', function() {
      setup(function() {
        fakeEvt = createFakeEvent('click', QuickSettingsModule.wifi);
        QuickSettingsModule.handleEvent(fakeEvt);
      });

      test('should prevent default', function() {
        assert.isTrue(fakeEvt._prevented);
      });

      test('should stop propagation', function() {
        assert.isTrue(fakeEvt._stopped);
      });
    });
  });
});
