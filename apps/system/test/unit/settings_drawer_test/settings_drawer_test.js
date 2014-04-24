/* global SettingsDrawer, MocksHelper */

'use strict';

requireApp('system/shared/test/unit/mocks/mock_lazy_loader.js');
requireApp('system/shared/test/unit/mocks/mock_settings_listener.js');
requireApp('system/test/unit/settings_drawer_test/mock_downloads_module.js');
requireApp('system/test/unit/mock_lock_screen.js');

mocha.globals(['SettingsDrawer', 'lockScreen']);

var mocksHelperForSettingsDrawerModule = new MocksHelper(
  [
    'LazyLoader',
    'SettingsListener',
    'DownloadsModule'
  ]).init();

suite('system/settings_drawer/settings_drawer', function() {
  var stubById;
  var fakeEvt;
  var screen;
  var statusbarIcons;
  var overlay;
  var originalLocked;

  mocksHelperForSettingsDrawerModule.attachTestHelpers();

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

  setup(function(done) {
    window.lockScreen = window.MockLockScreen;
    originalLocked = window.lockScreen.locked;
    window.lockScreen.locked = false;

    screen = document.createElement('div');
    statusbarIcons = document.createElement('div');
    overlay = document.createElement('div');

    stubById = this.sinon.stub(document, 'getElementById', function(id) {
      switch (id) {
        case 'screen':
          return screen;
        case 'statusbar-icons':
          return statusbarIcons;
        case 'settings-drawer':
          return overlay;
        default:
          return null;
      }
    });
    requireApp('system/js/settings_drawer/settings_drawer.js', function() {
      SettingsDrawer.start();
      done();
    });
  });

  teardown(function() {
    window.lockScreen.locked = originalLocked;
    stubById.restore();
  });


  suite('show', function() {
    setup(function() {
      SettingsDrawer.screen.class = '';
      SettingsDrawer.show();
    });

    test('SettingsDrawer.isShowing should be true', function() {
      assert.isTrue(SettingsDrawer.isShowing);
    });

    test('SettingsDrawer.overlay should be visible', function() {
      assert.isFalse(SettingsDrawer.overlay.hasAttribute('hidden'));
    });

    test('Screen element should have an appropriate CSS class', function() {
      assert.isTrue(SettingsDrawer.screen.classList
                      .contains('settings-drawer'));
    });

    test('window should emit a `settingsdrawershow` event', function(done) {
      function evtListener() {
        window.removeEventListener('settingsdrawershow', evtListener);
        done();
      }

      window.addEventListener('settingsdrawershow', evtListener);
      SettingsDrawer.hide(true);
      SettingsDrawer.show();
    });
  });


  suite('hide', function() {
    setup(function() {
      SettingsDrawer.show();
      SettingsDrawer.hide();
    });

    test('SettingsDrawer.isShowing should be false', function() {
      assert.isFalse(SettingsDrawer.isShowing);
    });

    test('SettingsDrawer.overlay should still be visible', function() {
      assert.isFalse(SettingsDrawer.overlay.hasAttribute('hidden'));
    });

    test('Screen element should not have an appropriate CSS class', function() {
      assert.isFalse(SettingsDrawer.screen.classList
                       .contains('settings-drawer'));
    });
  });


  suite('hide immediate', function() {
    setup(function() {
      SettingsDrawer.show();
      SettingsDrawer.hide(true);
    });

    test('SettingsDrawer.isShowing should be false', function() {
      assert.isFalse(SettingsDrawer.isShowing);
    });

    test('SettingsDrawer.overlay should hide', function() {
      assert.isTrue(SettingsDrawer.overlay.hasAttribute('hidden'));
    });

    test('Screen element should not have a `settings-drawer` CSS class',
         function() {
           assert.isFalse(SettingsDrawer.screen.classList
                            .contains('settings-drawer'));
         });

    test('window should emit a `settingsdrawerhide` event', function(done) {
      function evtListener() {
        window.removeEventListener('settingsdrawerhide', evtListener);
        done();
      }

      window.addEventListener('settingsdrawerhide', evtListener);
      SettingsDrawer.show();
      SettingsDrawer.hide(true);
    });
  });


  suite('handleEvent', function() {
    setup(function() {
      SettingsDrawer.show();
    });

    suite('home', function() {
      setup(function() {
        fakeEvt = createFakeEvent('home', {bubbles: true});
      });

      test('should hide', function() {
        SettingsDrawer.show();
        SettingsDrawer.handleEvent(fakeEvt);

        assert.isFalse(SettingsDrawer.isShowing);
      });

      test('should stop immediate propagation if visible', function() {
        SettingsDrawer.show();
        SettingsDrawer.handleEvent(fakeEvt);

        assert.isTrue(fakeEvt._immediatelyStopped);
      });

      test('should not stop immediate propagation if hidden', function() {
        SettingsDrawer.hide(true);
        SettingsDrawer.handleEvent(fakeEvt);

        assert.isFalse(fakeEvt._immediatelyStopped);
      });
    });

    suite('utilitytrayshow', function() {
      setup(function() {
        fakeEvt = createFakeEvent('utilitytrayshow');
        SettingsDrawer.handleEvent(fakeEvt);
      });

      test('should hide', function() {
        assert.isFalse(SettingsDrawer.isShowing);
      });
    });

    suite('screenchange', function() {
      setup(function() {
        SettingsDrawer.show();
      });

      test('should hide', function() {
        fakeEvt = createFakeEvent('screenchange', {
          detail: {
            screenEnabled: false
          }
        });
        SettingsDrawer.handleEvent(fakeEvt);
        assert.isFalse(SettingsDrawer.isShowing);
      });

      test('should still be visible', function() {
        fakeEvt = createFakeEvent('screenchange', {
          detail: {
            screenEnabled: true
          }
        });
        SettingsDrawer.handleEvent(fakeEvt);
        assert.isTrue(SettingsDrawer.isShowing);
      });
    });

    suite('attentionscreenshow', function() {
      setup(function() {
        fakeEvt = createFakeEvent('attentionscreenshow');
        SettingsDrawer.handleEvent(fakeEvt);
      });

      test('should hide', function() {
        assert.isFalse(SettingsDrawer.isShowing);
      });
    });

    suite('emergencyalert', function() {
      setup(function() {
        fakeEvt = createFakeEvent('emergencyalert');
        SettingsDrawer.handleEvent(fakeEvt);
      });

      test('should hide', function() {
        assert.isFalse(SettingsDrawer.isShowing);
      });
    });

    suite('simpinshow', function() {
      setup(function() {
        fakeEvt = createFakeEvent('simpinshow');
        SettingsDrawer.handleEvent(fakeEvt);
      });

      test('should hide', function() {
        assert.isFalse(SettingsDrawer.isShowing);
      });
    });

    suite('appopening', function() {
      setup(function() {
        fakeEvt = createFakeEvent('appopening');
        SettingsDrawer.handleEvent(fakeEvt);
      });

      test('should hide', function() {
        assert.isFalse(SettingsDrawer.isShowing);
      });
    });

    suite('launchapp', function() {
      setup(function() {
        fakeEvt = createFakeEvent('launchapp');
        SettingsDrawer.handleEvent(fakeEvt);
      });

      test('should hide', function() {
        assert.isFalse(SettingsDrawer.isShowing);
      });
    });

    suite('displayapp', function() {
      setup(function() {
        fakeEvt = createFakeEvent('displayapp');
        SettingsDrawer.handleEvent(fakeEvt);
      });

      test('should hide', function() {
        assert.isFalse(SettingsDrawer.isShowing);
      });
    });

    suite('click', function() {
      suite('to open', function() {
        setup(function() {
          SettingsDrawer.hide(true);
          fakeEvt = createFakeEvent('click', {
            target: SettingsDrawer.statusbarIcons
          });
        });

        teardown(function() {
          window.lockScreen.locked = false;
        });

        test('should not be visible when the status bar is clicked',
             function() {
               SettingsDrawer.handleEvent(fakeEvt);

               assert.isTrue(SettingsDrawer.isShowing);
             });

        test('should not be visible when screen is locked', function() {
          window.lockScreen.locked = true;
          SettingsDrawer.handleEvent(fakeEvt);

          assert.isFalse(SettingsDrawer.isShowing);
        });
      });

      suite('to close', function() {
        setup(function() {
          SettingsDrawer.show();
          fakeEvt = createFakeEvent('click');
        });

        test('should hide when the overlay is clicked', function() {
          fakeEvt.target = SettingsDrawer.overlay;
          SettingsDrawer.handleEvent(fakeEvt);

          assert.isFalse(SettingsDrawer.isShowing);
        });

        test('should hide when the status bar is clicked', function() {
          fakeEvt.target = SettingsDrawer.statusbarIcons;
          SettingsDrawer.handleEvent(fakeEvt);

          assert.isFalse(SettingsDrawer.isShowing);
        });
      });
    });

    suite('transitionend', function() {
      setup(function() {
        fakeEvt = createFakeEvent('transitionend');
        SettingsDrawer.isShowing = false;
        SettingsDrawer.handleEvent(fakeEvt);
      });

      test('should hide', function() {
        assert.isTrue(SettingsDrawer.overlay.hasAttribute('hidden'));
      });
    });
  });

});
