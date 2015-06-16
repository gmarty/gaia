/* global IconsHelper, MocksHelper, MockNavigatorDatastore, MockDatastore,
          MockXMLHttpRequest */

'use strict';

require('/shared/test/unit/mocks/mock_navigator_datastore.js');
require('/apps/system/test/unit/mock_xmlhttprequest.js');

require('/shared/js/icons_helper.js');

if (!window.XMLHttpRequest) {
  window.XMLHttpRequest = null;
}

var mocksForIconsHelper = new MocksHelper([
  'Datastore'
]).init();

suite('Icons Helper', () => {
  var devicePixelRatioProperty;
  var dpr = 1;
  var fakeDevicePixelRatio = {
    get: () => {
      return dpr;
    }
  };
  var realDataStores;
  var realXHR;

  mocksForIconsHelper.attachTestHelpers();

  suiteSetup(() => {
    // As we are selecting the icons based on device pixel ratio
    // let's mock the property.
    devicePixelRatioProperty =
      Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      get: fakeDevicePixelRatio.get
    });

    realDataStores = navigator.getDataStores;
    realXHR = window.XMLHttpRequest;

    navigator.getDataStores = MockNavigatorDatastore.getDataStores;
    window.XMLHttpRequest = MockXMLHttpRequest;
  });

  suiteTeardown(() => {
    Object.defineProperty(window, 'devicePixelRatio', devicePixelRatioProperty);
    navigator.getDataStores = realDataStores;
    window.XMLHttpRequest = realXHR;
  });

  suite('IconsHelper.getIcon()', () => {
    var placeObj, siteObj;

    suiteSetup(() => {
      placeObj = {
        icons: {
          'http://example.com/metaTagIconUrl': {
            sizes: ['32x32']
          }
        }
      };
      siteObj = {
        webManifestUrl: 'http://example.com',
        webManifest: {
          icons: [
            {
              src: 'webManifestIconUrl',
              sizes: '32x32'
            }
          ]
        }
      };
    });

    test('Prioritise icons from the web manifest over the rest', done => {
      IconsHelper.getIcon('http://example.com', 32, placeObj, siteObj)
        .then(iconUrl => {
          assert.equal((new URL(iconUrl)).pathname, '/webManifestIconUrl');
          done();
        });
    });

    test('Return meta tag icons when the web manifest hasn\'t any', done => {
      siteObj.webManifest.icons = [];
      IconsHelper.getIcon('http://example.com', 32, placeObj, siteObj)
        .then(iconUrl => {
          assert.equal((new URL(iconUrl)).pathname, '/metaTagIconUrl');
          done();
        });
    });

    test('Prioritise icons from the meta tags over favicon', done => {
      IconsHelper.getIcon('http://example.com', 32, placeObj)
        .then(iconUrl => {
          assert.equal((new URL(iconUrl)).pathname, '/metaTagIconUrl');
          done();
        });
    });

    test('Return favicon when no icons in the meta tags or manifest', done => {
      siteObj.webManifest.icons = [];
      placeObj.icons = [];
      IconsHelper.getIcon('http://example.com', 32, placeObj, siteObj)
        .then(iconUrl => {
          assert.equal((new URL(iconUrl)).pathname, '/favicon.ico');
          done();
        });
    });

    test('Ensure we fallback to favicon.ico', done => {
      IconsHelper.getIcon('http://example.com')
        .then(iconUrl => {
          assert.equal((new URL(iconUrl)).pathname, '/favicon.ico');
          done();
        });
    });

    suite('-moz-resolution fragment', () => {
      teardown(() => {
        dpr = 1;
      });

      test('Without icon target size', done => {
        IconsHelper.getIcon('http://example.com')
          .then(iconUrl => {
            assert.equal((new URL(iconUrl)).hash, '');
          })
          .then(() => {
            done();
          })
          .catch(() => {
            done();
          });
      });

      test('With icon target size', done => {
        dpr = 1.5;
        IconsHelper.getIcon('http://example.com', 64)
          .then(iconUrl => {
            // targetSize * devicePixelRatio
            assert.ok(new URL(iconUrl).includes('-moz-resolution=96,96'));
          })
          .then(() => {
            done();
          })
          .catch(() => {
            done();
          });
      });
    });
  });

  suite('IconsHelper.getIconBlob()', () => {
    var createElementStub, createObjectURLStub;

    function getStubs() {
      createElementStub = sinon.stub(document, 'createElement', () => {
        return {
          src: '',
          naturalWidth: 32,
          naturalHeight: 32,
          set onload(fn) {
            fn();
          },
          onerror: null
        };
      });
      createObjectURLStub = sinon.stub(URL, 'createObjectURL', url => url);
    }

    teardown(() => {
      createElementStub.restore();
      createObjectURLStub.restore();
      MockXMLHttpRequest.mTeardown();
    });

    test('The dataStore should be empty on first call', done => {
      getStubs();
      IconsHelper.getIconBlob('http://example.com', 32)
        .then(() => {
          assert.equal(MockDatastore.getLength(), 0);
          done();
        })
        .catch(() => {
          done();
        });
      setTimeout(() => {
        MockXMLHttpRequest.mSendReadyState();
        MockXMLHttpRequest.mSendOnLoad({response: 'abc'});
      });
    });

    test('The icon should already be in the datastore', done => {
      getStubs();
      IconsHelper.getIconBlob('http://example.com', 32)
        .then(() => {
          assert.equal(MockDatastore.getLength(), 1);
          done();
        })
        .catch(() => {
          done();
        });
      setTimeout(() => {
        MockXMLHttpRequest.mSendReadyState();
        MockXMLHttpRequest.mSendOnLoad({response: 'abc'});
      });
    });
  });

  suite('IconsHelper.getBestIconFromWebManifest()', () => {
    var siteObj;

    suiteSetup(() => {
      siteObj = {
        webManifestUrl: 'http://example.com',
        webManifest: {
          icons: []
        }
      };
    });

    test('Get correct icon with no size support', () => {
      siteObj.webManifest.icons = [
        {
          src: 'uri1',
          sizes: ''
        }
      ];

      var iconUrl = IconsHelper.getBestIconFromWebManifest(siteObj);
      assert.isNotNull(iconUrl);
      assert.equal((new URL(iconUrl)).pathname, '/uri1');
    });

    test('Get icon with size support', () => {
      siteObj.webManifest.icons = [
        {
          src: 'uri1',
          sizes: ''
        },
        {
          src: 'uri2',
          sizes: '16x16'
        }
      ];

      var iconUrl = IconsHelper.getBestIconFromWebManifest(siteObj);
      assert.isNotNull(iconUrl);
      assert.equal((new URL(iconUrl)).pathname, '/uri2');
    });

    test('Get best icon which doesn\'t match specific size', () => {
      // With dpr = 1
      siteObj.webManifest.icons = [
        {
          src: 'uri1',
          sizes: '90x90'
        },
        {
          src: 'uri2',
          sizes: '200x200'
        }
      ];

      var iconUrl = IconsHelper.getBestIconFromWebManifest(siteObj);
      assert.isNotNull(iconUrl);
      assert.equal((new URL(iconUrl)).pathname, '/uri1');
    });

    test('With higher dpi', () => {
      // With dpr = 1.5
      dpr = 1.5;
      siteObj.webManifest.icons = [
        {
          src: 'uri1',
          sizes: '90x90'
        },
        {
          src: 'uri2',
          sizes: '200x200'
        },
        {
          src: 'uri3',
          sizes: '500x500'
        }
      ];

      var iconUrl = IconsHelper.getBestIconFromWebManifest(siteObj);
      assert.isNotNull(iconUrl);
      assert.equal((new URL(iconUrl)).pathname, '/uri2');
      dpr = 1;
    });

    test('Specific icon size', () => {
      // With dpr = 1.5
      dpr = 1.5;
      siteObj.webManifest.icons = [
        {
          src: 'uri1',
          sizes: '90x90'
        },
        {
          src: 'uri2',
          sizes: '200x200'
        },
        {
          src: 'uri3',
          sizes: '500x500'
        }
      ];

      // With dpr 1.5 we should get icon 'uri2'
      // Let's ask for a bigger size.

      var iconUrl = IconsHelper.getBestIconFromWebManifest(siteObj, 400);
      assert.isNotNull(iconUrl);
      assert.equal((new URL(iconUrl)).pathname, '/uri3');
      dpr = 1;
    });
  });

  suite('IconsHelper.getBestIconFromMetaTags()', () => {
    test('Get correct icon with no size support', () => {
      var icons = {
        'uri1': {
          sizes: []
        }
      };

      var iconUrl = IconsHelper.getBestIconFromMetaTags(icons);
      assert.isNotNull(iconUrl);
      assert.equal(iconUrl, 'uri1');
    });

    test('Get icon with size support', () => {
      var icons = {
        'uri1': {
          sizes: []
        },
        'uri2': {
          sizes: ['16x16']
        }
      };

      var iconUrl = IconsHelper.getBestIconFromMetaTags(icons);
      assert.isNotNull(iconUrl);
      assert.equal(iconUrl, 'uri2');
    });

    test('Get best icon which doesn\'t match specific size', () => {
      // With dpr = 1
      var icons = {
        'uri1': {
          sizes: ['90x90']
        },
        'uri2': {
          sizes: ['200x200']
        }
      };

      var iconUrl = IconsHelper.getBestIconFromMetaTags(icons);
      assert.isNotNull(iconUrl);
      assert.equal(iconUrl, 'uri1');
    });

    test('With higher dpi', () => {
      // With dpr = 1.5
      dpr = 1.5;
      var icons = {
        'uri1': {
          sizes: ['90x90']
        },
        'uri2': {
          sizes: ['200x200']
        },
        'uri3': {
          sizes: ['500x500']
        }
      };

      var iconUrl = IconsHelper.getBestIconFromMetaTags(icons);
      assert.isNotNull(iconUrl);
      assert.equal(iconUrl, 'uri2');
      dpr = 1;
    });

    test('Specific icon size', () => {
      // With dpr = 1.5
      dpr = 1.5;
      var icons = {
        'uri1': {
          sizes: ['90x90']
        },
        'uri2': {
          sizes: ['200x200']
        },
        'uri3': {
          sizes: ['500x500']
        }
      };

      // With dpr 1.5 we should get icon 'uri2'
      // Let's ask for a bigger size.

      var iconUrl = IconsHelper.getBestIconFromMetaTags(icons, 400);
      assert.isNotNull(iconUrl);
      assert.equal(iconUrl, 'uri3');
      dpr = 1;
    });
  });

  suite('IconsHelper.getSizes()', () => {
    suite('No size information', () => {
      test('Single element with no size info', () => {
        var icons = {
          'uri1': {
            sizes: []
          }
        };

        var sizesSupported = IconsHelper.getSizes(icons);
        assert.deepEqual(sizesSupported, {});
      });

      test('Several items one without size info', () => {
        var icons = {
          'uri1': {
            sizes: []
          },
          'uri2': {
            sizes: ['10x10']
          }
        };

        var sizesSupported = IconsHelper.getSizes(icons);
        assert.isNotNull(sizesSupported);
        var sizes = Object.keys(sizesSupported);
        assert.equal(sizes.length, 1);
        assert.equal(sizes[0], '10');
      });
    });

    suite('Correct size support', () => {
      test('Check sizes detected', () => {
        var icons = {
          'uri1': {
            sizes: ['10x10', '20x20', '30x30']
          }
        };

        var sizesSupported = IconsHelper.getSizes(icons);
        assert.isNotNull(sizesSupported);
        var sizes = Object.keys(sizesSupported);
        assert.equal(sizes.length, 3);
        assert.equal(sizes[0], '10');
        assert.equal(sizes[1], '20');
        assert.equal(sizes[2], '30');
      });

      test('Check with incorrect file sizes', () => {
        var icons = {
          'uri1': {
            sizes: ['10', '', '30x30', 'x']
          }
        };

        var sizesSupported = IconsHelper.getSizes(icons);
        assert.isNotNull(sizesSupported);
        var sizes = Object.keys(sizesSupported);
        assert.equal(sizes.length, 1);
        assert.equal(sizes[0], '30');
      });
    });
  });

  suite('IconsHelper.fetchIcon()', () => {
    var createElementStub, createObjectURLStub;

    function getStubs(naturalWidth = 32) {
      createElementStub = sinon.stub(document, 'createElement', () => {
        return {
          src: '',
          naturalWidth: naturalWidth,
          naturalHeight: 32,
          set onload(fn) {
            fn();
          },
          onerror: null
        };
      });
      createObjectURLStub = sinon.stub(URL, 'createObjectURL', url => url);
    }

    teardown(() => {
      createElementStub.restore();
      createObjectURLStub.restore();
      MockXMLHttpRequest.mTeardown();
    });

    test('Should resolve to an object', done => {
      getStubs();
      IconsHelper.fetchIcon('http://example.com')
        .then((iconObject) => {
          assert.isTrue(createObjectURLStub.calledOnce);
          assert.isObject(iconObject);
          assert.equal(iconObject.blob, 'abc');
          assert.equal(iconObject.size, '32');
          done();
        })
        .catch(() => {
          assert.isTrue(false, 'Should not throw.');
          done();
        });
      MockXMLHttpRequest.mSendReadyState();
      MockXMLHttpRequest.mSendOnLoad({response: 'abc'});
    });

    test('Should return the largest side of the image', done => {
      getStubs(512);
      IconsHelper.fetchIcon('http://example.com')
        .then((iconObject) => {
          assert.equal(iconObject.size, '512');
          done();
        })
        .catch(() => {
          assert.isTrue(false, 'Should not throw.');
          done();
        });
      MockXMLHttpRequest.mSendReadyState();
      MockXMLHttpRequest.mSendOnLoad({response: 'abc'});
    });
  });
});
