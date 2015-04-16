'use strict';

import React from 'react';
import Iso from 'iso';
import debug from 'debug';

import alt from 'utils/alt';
import LocaleActions from 'actions/locale';
import ErrorPage from 'pages/server-error';

const toResolve = [];

export default {
  resolve(promise, later) {
    if (process.env.BROWSER && !later) {
      return new Promise(promise);
    }
    else {
      toResolve.push(promise);
    }
  },
  mapPromises() {
    return toResolve.map((promise) => new Promise(promise));
  },
  cleanPromises() {
    toResolve.length = 0;
  },
  async render(Handler, locale, messages, force) {
    if (process.env.BROWSER && !force) {
      debug('dev')('`altResolver.render` should not be used in browser, something went wrong');
      return null;
    }
    else {
      let content;
      try {
        // Set the locale and correct `data/[locale].js`
        LocaleActions.switchLocaleSuccess({locale, messages});

        // Fire first render to collect XHR promises
        debug('dev')('first render');
        React.renderToString(React.createElement(Handler));

        // Resolve all promises
        await Promise.all(this.mapPromises());

        // We have done async operations, re-set the Locale store
        // maybe another requests at the same time already fired `alt.flush()`
        //
        // TODO: find a cleaner way to keep alt stores unique to requests
        debug('dev')('second render');
        LocaleActions.switchLocaleSuccess({locale, messages});

        // Get the new content with promises resolved
        const app = React.renderToString(React.createElement(Handler));

        // Render the html with state in it
        content = Iso.render(app, alt.flush());
      }
      catch (error) {
        // catch script error, render 500 page
        debug('koa')('`rendering error`');
        debug('koa')(error);
        const app = React.renderToString(React.createElement(ErrorPage));
        content = Iso.render(app, alt.flush());
      }

      // clean server for next request
      this.cleanPromises();

      // return the content
      return content;
    }
  }
};