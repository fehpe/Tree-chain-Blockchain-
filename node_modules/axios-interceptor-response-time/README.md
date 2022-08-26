# NodeJS Axios Interceptor Response Time

## Getting Started
An interceptor which sets http request started time (UTC format) and response elapsed time (in milliseconds) when calling an endpoint. This is written on JavaScript using node and express.

## Features
- Get UTC date on when the service endpoint was called
- Get elapsed time (in milliseconds) for the duration between the request and response call

## Requirements
- NodeJs
- ExpressJs
- Axios

## How to install

1. Install the package on NPM
```bash
npm i -S npm i axios-interceptor-response-time
```
2. Add the package in your entry file, for example, app.js
```bash
const express = require('express');
...
const axiosInterceptorResponseTime = require('axios-interceptor-response-time')

// Run axios interceptor in middleware
app.use((req, res, enxt) => {
    axiosInterceptorResponseTime();
    next();
});
...
app.listen(app.get('port'));
```

## Usage
The package registers a new global properties called `requestStartedAt` and `responseTime` on the axios object when calling an endpoint.

## Bugs or improvements

Feel free to report any bugs or improvements. Pull requests are always welcome.

## License

This project is open-sourced software licensed under the MIT License. See the LICENSE file for more information.
