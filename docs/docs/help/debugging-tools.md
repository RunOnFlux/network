---
sidebar_position: 2
---

# Debugging streams
<!-- TODO, talking through common connectivity issues and so on -->
Turning up the log level is a good way to diagnose tricky connectivity problems. There are two ways to set a desired logging level.

You can pass the logging level in the Streamr constructor as follows:

```ts
const Streamr = require('streamr-client')

const streamr = new Streamr({
  logLevel: 'debug',
  // ... more options
})
```

Alternatively, when running your application in Node.js, you can provide the logging level via the environment variable LOG_LEVEL, for example, by running your application as follows:

```ts
LOG_LEVEL=trace node your-app.js
```

When defining both the environment variable takes precedence. Default logging level is info. Valid logging levels are silent, fatal, error, warn, info, debug, and trace.

# Debugging connections
Underlying internet connectivity plays a role in how data is propagated through the Streamr Network. Connectivity issues (data loss) may emerge from low bandwidth nodes, heavily firewalled nodes that may not be reachable and excessive node churn (nodes leaving or going offline) in the stream topology.

You can learn more about the underlying network connections with this code:

```ts
setInterval(() => {
    const info = await streamr.getDiagnosticInfo()
    console.log(JSON.stringify(info))
}, 10 * 1000) // every 10 sec
```
