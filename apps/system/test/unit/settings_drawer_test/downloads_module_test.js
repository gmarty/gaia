/* global MocksHelper, mockMozActivityInstance, DownloadsModule */

'use strict';

require('/test/unit/mock_activity.js');

require('/js/settings_drawer/downloads_module.js');

var mocksForDownloadsModule = new MocksHelper(['MozActivity']).init();

suite('system/settings_drawer/downloads_module', function() {
  mocksForDownloadsModule.attachTestHelpers();

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

  suite('click', function() {
    var fakeEvt;

    setup(function() {
      fakeEvt = createFakeEvent('click');
      DownloadsModule.handleEvent(fakeEvt);
    });

    test('should start a MozActivity', function() {
      assert.equal(mockMozActivityInstance.name, 'configure');
      assert.deepEqual(
        mockMozActivityInstance,
        {
          name: 'configure',
          data: {
            target: 'device',
            section: 'downloads'
          }
        });
    });

    test('should prevent default', function() {
      assert.isTrue(fakeEvt._prevented);
    });
  });
});
