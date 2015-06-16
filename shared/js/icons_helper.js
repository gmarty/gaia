/* exported IconsHelper */
'use strict';

/**
 *  Utility library that will help us to work with icons coming from
 *  different sources.
 */
(function IconsHelper(exports) {
  const FETCH_XHR_TIMEOUT = 10000;
  const DEBUG = false;

  var dataStore = null;

  /**
   * Return a promise that resolves to the URL of the best icon for a web page
   * given its meta data and web manifest.
   *
   * @param uri {string}
   * @param iconTargetSize {number}
   * @param placeObj {Object}
   * @param siteObj {Object}
   * @returns {Promise}
   */
  function getIcon(uri, iconTargetSize, placeObj = {}, siteObj = {}) {
    var iconUrl = null;

    iconTargetSize = iconTargetSize * window.devicePixelRatio;

    // First look for an icon in the manifest.
    if (siteObj.webManifestUrl && siteObj.webManifest) {
      iconUrl = getBestIconFromWebManifest(siteObj, iconTargetSize);
      if (DEBUG && iconUrl) {
        console.log('Icon from Web Manifest');
      }
    }

    // Otherwise, look into the meta tags.
    if (!iconUrl && placeObj.icons) {
      iconUrl = getBestIconFromMetaTags(placeObj.icons, iconTargetSize);
      if (DEBUG && iconUrl) {
        console.log('Icon from Meta tags');
      }
    }

    // Last resort, we look for a favicon.ico file.
    if (!iconUrl) {
      DEBUG && console.log('Icon from favicon.ico');
      var a = document.createElement('a');
      a.href = uri;
      iconUrl = a.origin + '/favicon.ico';
      if (iconTargetSize) {
        iconUrl += '#-moz-resolution=' + iconTargetSize + ',' + iconTargetSize;
      }
    }

    return new Promise(resolve => {
      resolve(iconUrl);
    });
  }


  /**
   * Same as above except the promise resolves as an object containing the blob
   * of the icon and its size in pixels.
   *
   * @param uri {string}
   * @param iconTargetSize {number}
   * @param placeObj {Object}
   * @param siteObj {Object}
   * @returns {Promise}
   */
  function getIconBlob(uri, iconTargetSize, placeObj = {}, siteObj = {}) {
    return new Promise((resolve, reject) => {
      getIcon(uri, iconTargetSize, placeObj, siteObj)
        .then(iconUrl => {
          // @todo Need a better syntax.
          getStore().then(iconStore => {
            iconStore.get(iconUrl).then(iconObj => {
              if (!iconObj) {
                return fetchIcon(iconUrl)
                  .then(iconObject => {
                    // We resolve here to avoid I/O blocking on dataStore and
                    // quicker display.
                    // Persisting to the dataStore takes place subsequently.
                    resolve(iconObject);

                    iconStore.add(iconObject, iconUrl);
                  })
                  .catch(err => {
                    reject(`Failed to fetch icon ${iconUrl}: ${err}`);
                  });
              }

              return resolve(iconObj);
            }).catch(err => {
              // We should fetch the icon and resolve the promise here, anyhow.
              reject(`Failed to get icon from dataStore: ${err}`);
            });
          }).catch(err => {
            // We should fetch the icon and resolve the promise here, anyhow.
            reject(`Error opening the dataStore: ${err}`);
          });
        });
    });
  }

  function getBestIconFromWebManifest(siteObj, iconSize) {
    var webManifestUrl = siteObj.webManifestUrl;
    var icons = siteObj.webManifest.icons;

    if (!icons) {
      return null;
    }

    var options = {};
    icons.forEach(icon => {
      var uri = icon.src;
      var sizeValue = guessSize(icon.sizes);
      if (!sizeValue) {
        return;
      }

      options[sizeValue] = {
        uri: uri
      };
    });

    var sizes = Object.keys(options).sort((a, b) => a - b);
    var icon = null;

    // Handle the case of no size info in the whole list
    // just return the first icon.
    if (sizes.length === 0) {
      var iconStrings = Object.keys(icons);
      if (iconStrings.length > 0) {
        icon = iconStrings[0];
      }
    } else {
      var preferredSize = getPreferredSize(sizes, iconSize);
      icon = options[preferredSize];
    }

    if (!icon) {
      return null;
    }

    // Icon paths must be resolved relatively to the manifest URI.
    var iconUrl = new URL(icon.uri, webManifestUrl);

    return iconUrl.href;
  }

  // See bug 1041482, we will need to support better
  // icons for different part of the system application.
  // A web page have different ways to defining icons
  // based on size, 'touch' capabilities and so on.
  // From gecko we will receive all the rel='icon'
  // defined which will contain as well the sizes
  // supported in that file.
  // This function will help to deliver the best suitable
  // icon based on that definition list.
  // The expected format is the following one:
  //
  // {
  //   '[uri 1]': {
  //     sizes: ['16x16 32x32 48x48', '60x60']
  //   },
  //   '[uri 2]': {
  //     sizes: ['16x16']
  //   }
  // }
  //
  // iconSize is an additional parameter to specify a concrete
  // size or the closest icon.
  function getBestIconFromMetaTags(icons, iconSize) {
    if (!icons) {
      return null;
    }

    var options = getSizes(icons);
    var sizes = Object.keys(options).sort((a, b) => a - b);

    // Handle the case of no size info in the whole list
    // just return the first icon.
    if (sizes.length === 0) {
      var iconStrings = Object.keys(icons);
      return iconStrings.length > 0 ? iconStrings[0] : null;
    }

    var preferredSize = getPreferredSize(sizes, iconSize);
    var icon = options[preferredSize];

    if (icon.rel === 'apple-touch-icon') {
      var iconsUrl = 'https://developer.mozilla.org/en-US/' +
        'Apps/Build/Icon_implementation_for_apps#General_icons_for_web_apps';
      console.warn('Warning: The apple-touch icons are being used ' +
        'as a fallback only. They will be deprecated in ' +
        'the future. See ' + iconsUrl);
    }

    return icon.uri;
  }

  // Given an object representing the icons detected in a web
  // return the list of sizes and which uris offer the specific
  // size.
  // Current implementation overrides the source if the size is
  // defined twice.
  function getSizes(icons) {
    var sizes = {};
    var uris = Object.keys(icons);
    uris.forEach(uri => {
      var uriSizes = icons[uri].sizes.join(' ').split(' ');
      uriSizes.forEach(size => {
        var sizeValue = guessSize(size);
        if (!sizeValue) {
          return;
        }

        sizes[sizeValue] = {
          uri: uri,
          rel: icons[uri].rel
        };
      });
    });

    return sizes;
  }


  function getPreferredSize(sizes, iconSize) {
    var targeted = iconSize ? parseInt(iconSize) : 0;
    // Sized based on current homescreen selected icons for apps
    // in a configuration of 3 icons per row. See:
    // https://github.com/mozilla-b2g/gaia/blob/master/
    // shared/elements/gaia_grid/js/grid_layout.js#L15
    if (targeted === 0) {
      targeted = window.devicePixelRatio > 1 ? 142 : 84;
    }

    var selected = -1;
    var length = sizes.length;
    for (var i = 0; i < length && selected < targeted; i++) {
      selected = sizes[i];
    }

    return selected;
  }


  // Given an icon size by string YYxYY returns the
  // width measurement, so will assume this will be
  // used by strings that identify a square size.
  function guessSize(size) {
    var xIndex = size.indexOf('x');
    if (!xIndex) {
      return null;
    }

    return size.substr(0, xIndex);
  }


  /**
   * Return a promise that resolves to a dataStore for icons.
   *
   * @returns {Promise}
   */
  function getStore() {
    return new Promise(resolve => {
      if (dataStore) {
        return resolve(dataStore);
      }
      navigator.getDataStores('icons').then(stores => {
        dataStore = stores[0];
        return resolve(dataStore);
      });
    });
  }


  /**
   * Return a promise that resolves to an object containing the blob and size
   * in pixels of an icon given its URL `iconUrl`.
   *
   * @param {string} iconUrl
   * @returns {Promise}
   */
  function fetchIcon(iconUrl) {
    return new Promise((resolve, reject) => {
      var xhr = new XMLHttpRequest({
        mozAnon: true,
        mozSystem: true
      });

      xhr.open('GET', iconUrl, true);
      xhr.responseType = 'blob';
      xhr.timeout = FETCH_XHR_TIMEOUT;

      // Remember that send() can throw for some non http protocols.
      // The promise wrapper here protects us.
      xhr.send();

      xhr.onload = () => {
        if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
          var iconBlob = xhr.response;
          var img = document.createElement('img');

          img.src = URL.createObjectURL(iconBlob);

          img.onload = () => {
            var iconSize = Math.max(img.naturalWidth, img.naturalHeight);

            resolve({
              blob: iconBlob,
              size: iconSize
            });
          };

          img.onerror = () => {
            reject(new Error(`Error while loading image.`));
          };

          return;
        }

        reject(new Error(
          `Got HTTP status ${xhr.status} trying to load ${iconUrl}.`));
      };

      xhr.onerror = xhr.ontimeout = () => {
        reject(new Error(`Error while getting ${iconUrl}.`));
      };
    });
  }

  exports.IconsHelper = {
    getIcon: getIcon,
    getIconBlob: getIconBlob,

    getBestIconFromWebManifest: getBestIconFromWebManifest,
    getBestIcon: getBestIconFromMetaTags,

    // Make public for unit test purposes
    getSizes: getSizes
  };

})(window);
