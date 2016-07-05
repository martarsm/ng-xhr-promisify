export default function xhrPromisifyFactory($q) {
  function parseResponseHeaders(responseHeaders) {
    // xhr.spec.whatwg.org/#the-getallresponseheaders()-method
    return responseHeaders.split('\x0d\x0a').reduce((headers, str) => {
      const index = str.indexOf('\x3a\x20');
      if (index > 0) {
        const name = str.substring(0, index).trim().toLowerCase();
        const value = str.substring(index + 2).trim();
        headers[name] = value;
      }
      return headers;
    }, Object.create(null));
  }

  function createHeadersGetter(xhr) {
    const responseHeaders = xhr.getAllResponseHeaders() || '';
    const headers = parseResponseHeaders(responseHeaders);
    return (name) => {
      if (!name) {
        return headers;
      }
      name = name.toLowerCase();
      return name in headers ? headers[name] : null;
    }
  }

  function getResponse(xhr) {
    return 'response' in xhr ? xhr.response :
      typeof xhr.responseText === 'string' ? xhr.responseText : // IE9
        null;
  }

  function parseResponseData(xhr, headers) {
    let data = getResponse(xhr);
    const jsonMIME = (/application\/json/i).test(headers('Content-Type'));
    if (jsonMIME && typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        data = null;
      }
    }
    return data;
  }

  function getStatusCode(xhr) {
    let statusCode = xhr.status;
    const response = getResponse(xhr);
    const headers = xhr.getAllResponseHeaders();
    // error
    if (statusCode === 0 && !response && !headers && !xhr.statusText) {
      statusCode = -1;
    }
    // IE bug
    if (statusCode === 1223) {
      statusCode = 204;
    }
    // handle 0 status on file protocol
    if (statusCode === 0) {
      const protocolRegExp = /^(?:([^:\/]+):)/;
      const match = xhr.responseURL.match(protocolRegExp);
      const protocol = match && match[1];
      statusCode = response ? 200 : protocol === 'file' ? 404 : 0;
    }
    return statusCode;
  }

  function createResponse(xhr) {
    const headers = createHeadersGetter(xhr);
    const data = parseResponseData(xhr, headers);
    const status = getStatusCode(xhr);
    const statusText = xhr.statusText || '';
    return { headers, data, status, statusText };
  }

  function promisify(xhr) {
    if (!(xhr instanceof XMLHttpRequest)) {
      throw new Error('Invalid XMLHttpRequest object');
    }
    const deferred = $q.defer();
    function onXhrDone() {
      const response = createResponse(xhr);
      if (response.status >= 200 && response.status < 300) {
        deferred.resolve(response);
      } else {
        deferred.reject(response);
      }
    }
    if (xhr.readyState === 4 || xhr.readyState === 0) {
      onXhrDone();
    } else {
      xhr.addEventListener('loadend', onXhrDone);
    }
    return deferred.promise;
  }

  return promisify;
}
xhrPromisifyFactory.$inject = ['$q'];