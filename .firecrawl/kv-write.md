[Skip to content](https://developers.cloudflare.com/kv/api/write-key-value-pairs/#main-content)

> Documentation Index
>
> Fetch the complete documentation index at: https://developers.cloudflare.com/kv/llms.txt
>
> Use this file to discover all available pages before exploring further.

[![](https://developers.cloudflare.com/_astro/logo.te5VL_aD.svg)Docs](https://developers.cloudflare.com/) [Directory](https://developers.cloudflare.com/directory/) [API](https://developers.cloudflare.com/api/) [SDKs](https://developers.cloudflare.com/fundamentals/api/reference/sdks/) [Changelog](https://developers.cloudflare.com/changelog/)

Search`Ctrl`  `K`

Start typing to search

`↑`  `↓` Navigate

`↵` Select

`Esc` Close

Powered by [Cloudflare AI Search](https://workers.cloudflare.com/product/ai-search)

[GitHub](https://github.com/cloudflare/cloudflare-docs)

[Log inDashboard](https://dash.cloudflare.com/)

[All products](https://developers.cloudflare.com/)[KV](https://developers.cloudflare.com/kv/)

`/`

- [Overview](https://developers.cloudflare.com/kv/)
- [Getting started](https://developers.cloudflare.com/kv/get-started/)
- Key concepts





  - [How KV works](https://developers.cloudflare.com/kv/concepts/how-kv-works/)
  - [KV bindings](https://developers.cloudflare.com/kv/concepts/kv-bindings/)
  - [KV namespaces](https://developers.cloudflare.com/kv/concepts/kv-namespaces/)

- Workers Binding API





  - [Read key-value pairs](https://developers.cloudflare.com/kv/api/read-key-value-pairs/)
  - [Write key-value pairs](https://developers.cloudflare.com/kv/api/write-key-value-pairs/)
  - [Delete key-value pairs](https://developers.cloudflare.com/kv/api/delete-key-value-pairs/)
  - [List keys](https://developers.cloudflare.com/kv/api/list-keys/)

- Examples





  - [Store and retrieve static assets](https://developers.cloudflare.com/kv/examples/workers-kv-to-serve-assets/)
  - [Build a distributed configuration store](https://developers.cloudflare.com/kv/examples/distributed-configuration-with-workers-kv/)
  - [Cache data with Workers KV](https://developers.cloudflare.com/kv/examples/cache-data-with-workers-kv/)
  - [Route requests across various web servers](https://developers.cloudflare.com/kv/examples/routing-with-workers-kv/)
  - [A/B testing with Workers KV ↗](https://developers.cloudflare.com/reference-architecture/diagrams/serverless/a-b-testing-using-workers/)

- [Tutorials](https://developers.cloudflare.com/kv/tutorials/)
- [Demos and architectures](https://developers.cloudflare.com/kv/demos/)
- Observability





  - [Metrics and analytics](https://developers.cloudflare.com/kv/observability/metrics-analytics/)

- Platform





  - [Pricing](https://developers.cloudflare.com/kv/platform/pricing/)
  - [Limits](https://developers.cloudflare.com/kv/platform/limits/)
  - [Choose a data or storage product ↗](https://developers.cloudflare.com/workers/platform/storage-options/)
  - [Release notes](https://developers.cloudflare.com/kv/platform/release-notes/)
  - [Event subscriptions](https://developers.cloudflare.com/kv/platform/event-subscriptions/)

- Reference





  - [Wrangler KV commands](https://developers.cloudflare.com/kv/reference/kv-commands/)
  - [Environments](https://developers.cloudflare.com/kv/reference/environments/)
  - [Data location](https://developers.cloudflare.com/kv/reference/data-location/)
  - [Data security](https://developers.cloudflare.com/kv/reference/data-security/)
  - [FAQ](https://developers.cloudflare.com/kv/reference/faq/)

- [Glossary](https://developers.cloudflare.com/kv/glossary/)
- [KV REST API ↗API](https://developers.cloudflare.com/api/resources/kv/)
- Agent resources





  - [Agent setup ↗](https://developers.cloudflare.com/agent-setup/)
  - [Cloudflare Skills ↗](https://github.com/cloudflare/skills)
  - [Code Mode MCP Server ↗](https://github.com/cloudflare/mcp)
  - [Domain-specific MCP Servers ↗MCP](https://github.com/cloudflare/mcp-server-cloudflare)
  - [KV llms.txt ↗](https://developers.cloudflare.com/kv/llms.txt)
  - [KV llms-full.txt ↗](https://developers.cloudflare.com/kv/llms-full.txt)
  - [Cloudflare Docs llms.txt ↗](https://developers.cloudflare.com/llms.txt)
  - [Cloudflare Docs llms-full.txt ↗](https://developers.cloudflare.com/llms-full.txt)

1. [Home](https://developers.cloudflare.com/)
2. / [KV](https://developers.cloudflare.com/kv/)
3. /Workers Binding API
4. /Write key-value pairs

# Write key-value pairs

Last updated Jun 22, 2026\|Copy as Markdown\| [View as Markdown](https://developers.cloudflare.com/kv/api/write-key-value-pairs/index.md) \| [Agent setup](https://developers.cloudflare.com/agent-setup/)

OverviewReference put() methodGuidance Concurrent writes to the same key Write data in bulk Expiring keys Metadata Limits to KV writes to the same keyOther methods to access KV

To create a new key-value pair, or to update the value for a particular key, call the `put()` method of the [KV binding](https://developers.cloudflare.com/kv/concepts/kv-bindings/) on any [KV namespace](https://developers.cloudflare.com/kv/concepts/kv-namespaces/) you have bound to your Worker code:

JavaScriptPython

```
env.NAMESPACE.put(key, value);
```

```
self.env.NAMESPACE.put(key, value)
```

#### Example

An example of writing a key-value pair from within a Worker:

JavaScriptPython

```
export default {
	async fetch(request, env, ctx) {
		try {
			await env.NAMESPACE.put("first-key", "This is the value for the key");

			return new Response("Successful write", {
				status: 201,
			});
		} catch (e) {
			return new Response(e.message, { status: 500 });
		}
	},
};
```

```
from workers import WorkerEntrypoint, Response

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        try:
            await self.env.NAMESPACE.put("first-key", "This is the value for the key")

            return Response("Successful write", status=201)
        except Exception as e:
            return Response(str(e), status=500)
```

## Reference

The following method is provided to write to KV:

- [put()](https://developers.cloudflare.com/kv/api/write-key-value-pairs/#put-method)

### `put()` method

To create a new key-value pair, or to update the value for a particular key, call the `put()` method on any KV namespace you have bound to your Worker code:

JavaScriptPython

```
env.NAMESPACE.put(key, value, options?);
```

```
self.env.NAMESPACE.put(key, value, options)
```

#### Parameters

- `key`: `string`
  - The key to associate with the value. A key cannot be empty or be exactly equal to `.` or `..`. All other keys are valid. Keys have a maximum length of 512 bytes.
- `value`: `string` \| `ReadableStream` \| `ArrayBuffer`
  - The value to store. The type is inferred. The maximum size of a value is 25 MiB.
- `options`: `{ expiration?: number, expirationTtl?: number, metadata?: object }`
  - Optional. An object containing the `expiration` (optional), `expirationTtl` (optional), and `metadata` (optional) attributes.

    - `expiration` is the number that represents when to expire the key-value pair in seconds since epoch.
    - `expirationTtl` is the number that represents when to expire the key-value pair in seconds from now. The minimum value is 60.
    - `metadata` is an object that must serialize to JSON. The maximum size of the serialized JSON representation of the metadata object is 1024 bytes.

#### Response

- `response`: `Promise<void>`
  - A `Promise` that resolves if the update is successful.

The put() method returns a Promise that you should `await` on to verify a successful update.

## Guidance

### Concurrent writes to the same key

Due to the eventually consistent nature of KV, concurrent writes to the same key can end up overwriting one another. It is a common pattern to write data from a single process with Wrangler, Durable Objects, or the API. This avoids competing concurrent writes because of the single stream. All data is still readily available within all Workers bound to the namespace.

If concurrent writes are made to the same key, the last write will take precedence.

Writes are immediately visible to other requests in the same global network location, but can take up to 60 seconds (or the value of the `cacheTtl` parameter of the `get()` or `getWithMetadata()` methods) to be visible in other parts of the world.

Refer to [How KV works](https://developers.cloudflare.com/kv/concepts/how-kv-works/) for more information on this topic.

### Write data in bulk

Write more than one key-value pair at a time with Wrangler or [via the REST API](https://developers.cloudflare.com/api/resources/kv/subresources/namespaces/subresources/keys/methods/bulk_update/).

The bulk API can accept up to 10,000 KV pairs at once.

A `key` and a `value` are required for each KV pair. The entire request size must be less than 100 megabytes. Bulk writes are not supported using the [KV binding](https://developers.cloudflare.com/kv/concepts/kv-bindings/).

### Expiring keys

KV offers the ability to create keys that automatically expire. You may configure expiration to occur either at a particular point in time (using the `expiration` option), or after a certain amount of time has passed since the key was last modified (using the `expirationTtl` option).

Once the expiration time of an expiring key is reached, it will be deleted from the system. After its deletion, attempts to read the key will behave as if the key does not exist. The deleted key will not count against the KV namespace’s storage usage for billing purposes.

Note

An `expiration` setting on a key will result in that key being deleted, even in cases where the `cacheTtl` is set to a higher (longer duration) value. Expiration always takes precedence.

There are two ways to specify when a key should expire:

- Set a key's expiration using an absolute time specified in a number of [seconds since the UNIX epoch ↗](https://en.wikipedia.org/wiki/Unix_time). For example, if you wanted a key to expire at 12:00AM UTC on April 1, 2019, you would set the key’s expiration to `1554076800`.

- Set a key's expiration time to live (TTL) using a relative number of seconds from the current time. For example, if you wanted a key to expire 10 minutes after creating it, you would set its expiration TTL to `600`.


Expiration targets that are less than 60 seconds into the future are not supported. This is true for both expiration methods.

#### Create expiring keys

To create expiring keys, set `expiration` in the `put()` options to a number representing the seconds since epoch, or set `expirationTtl` in the `put()` options to a number representing the seconds from now:

JavaScriptPython

```
await env.NAMESPACE.put(key, value, {
	expiration: secondsSinceEpoch,
});

await env.NAMESPACE.put(key, value, {
	expirationTtl: secondsFromNow,
});
```

```
await self.env.NAMESPACE.put(key, value, expiration=seconds_since_epoch)

await self.env.NAMESPACE.put(key, value, expirationTtl=seconds_from_now)
```

These assume that `secondsSinceEpoch`/`seconds_since_epoch` and `secondsFromNow`/`seconds_from_now` are variables defined elsewhere in your Worker code.

### Metadata

To associate metadata with a key-value pair, set `metadata` in the `put()` options to an object (serializable to JSON):

JavaScriptPython

```
await env.NAMESPACE.put(key, value, {
	metadata: { someMetadataKey: "someMetadataValue" },
});
```

```
await self.env.NAMESPACE.put(key, value, metadata={"someMetadataKey": "someMetadataValue"})
```

### Limits to KV writes to the same key

Workers KV has a maximum of 1 write to the same key per second. Writes made to the same key within 1 second will cause rate limiting (`429`) errors to be thrown.

You should not write more than once per second to the same key. Consider consolidating your writes to a key within a Worker invocation to a single write, or wait at least 1 second between writes.

The following example serves as a demonstration of how multiple writes to the same key may return errors by forcing concurrent writes within a single Worker invocation. This is not a pattern that should be used in production.

TypeScriptPython

```
export default {
	async fetch(request, env, ctx): Promise<Response> {
		// Rest of code omitted
		const key = "common-key";
		const parallelWritesCount = 20;

		// Helper function to attempt a write to KV and handle errors
		const attemptWrite = async (i: number) => {
			try {
				await env.YOUR_KV_NAMESPACE.put(key, `Write attempt #${i}`);
				return { attempt: i, success: true };
			} catch (error) {
				// An error may be thrown if a write to the same key is made within 1 second with a message. For example:
				// error: {
				//	"message": "KV PUT failed: 429 Too Many Requests"
				// }

				return {
					attempt: i,
					success: false,
					error: { message: (error as Error).message },
				};
			}
		};

		// Send all requests in parallel and collect results
		const results = await Promise.all(
			Array.from({ length: parallelWritesCount }, (_, i) =>
				attemptWrite(i + 1),
			),
		);
		// Results will look like:
		// [\
		// 	  {\
		// 		  "attempt": 1,\
		// 		  "success": true\
		// 	  },\
		//    {\
		// 		  "attempt": 2,\
		// 		  "success": false,\
		// 		  "error": {\
		// 			  "message": "KV PUT failed: 429 Too Many Requests"\
		// 		  }\
		// 	  },\
		// 	  ...\
		// ]

		return new Response(JSON.stringify(results), {
			headers: { "Content-Type": "application/json" },
		});
	},
};
```

```
from workers import WorkerEntrypoint, Response
import asyncio

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        key = "common-key"
        parallel_writes_count = 20

        async def attempt_write(i):
            try:
                await self.env.YOUR_KV_NAMESPACE.put(key, f"Write attempt #{i}")
                return {"attempt": i, "success": True}
            except Exception as error:
                # An error may be thrown if a write to the same key is made
                # within 1 second with a message like:
                # "KV PUT failed: 429 Too Many Requests"
                return {"attempt": i, "success": False, "error": {"message": str(error)}}

        results = await asyncio.gather(
            *[attempt_write(i + 1) for i in range(parallel_writes_count)]
        )

        # Results will look like:
        # [\
        #     {\
        #         "attempt": 1,\
        #         "success": True\
        #     },\
        #     {\
        #         "attempt": 2,\
        #         "success": False,\
        #         "error": {\
        #             "message": "KV PUT failed: 429 Too Many Requests"\
        #         }\
        #     },\
        #     ...\
        # ]

        return Response.json(list(results))
```

To handle these errors, we recommend implementing a retry logic, with exponential backoff. Here is a simple approach to add retries to the above code.

TypeScriptPython

```
export default {
	async fetch(request, env, ctx): Promise<Response> {
		// Rest of code omitted
		const key = "common-key";
		const parallelWritesCount = 20;

		// Helper function to attempt a write to KV with retries
		const attemptWrite = async (i: number) => {
			return await retryWithBackoff(async () => {
				await env.YOUR_KV_NAMESPACE.put(key, `Write attempt #${i}`);
				return { attempt: i, success: true };
			});
		};

		// Send all requests in parallel and collect results
		const results = await Promise.all(
			Array.from({ length: parallelWritesCount }, (_, i) =>
				attemptWrite(i + 1),
			),
		);

		return new Response(JSON.stringify(results), {
			headers: { "Content-Type": "application/json" },
		});
	},
};

async function retryWithBackoff(
	fn: Function,
	maxAttempts = 5,
	initialDelay = 1000,
) {
	let attempts = 0;
	let delay = initialDelay;

	while (attempts < maxAttempts) {
		try {
			// Attempt the function
			return await fn();
		} catch (error) {
			// Check if the error is a rate limit error
			if (
				(error as Error).message.includes(
					"KV PUT failed: 429 Too Many Requests",
				)
			) {
				attempts++;
				if (attempts >= maxAttempts) {
					throw new Error("Max retry attempts reached");
				}

				// Wait for the backoff period
				console.warn(`Attempt ${attempts} failed. Retrying in ${delay} ms...`);
				await new Promise((resolve) => setTimeout(resolve, delay));

				// Exponential backoff
				delay *= 2;
			} else {
				// If it's a different error, rethrow it
				throw error;
			}
		}
	}
}
```

```
from workers import WorkerEntrypoint, Response
import asyncio

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        key = "common-key"
        parallel_writes_count = 20

        async def attempt_write(i):
            return await retry_with_backoff(
                lambda: self.env.YOUR_KV_NAMESPACE.put(key, f"Write attempt #{i}"),
                success_result={"attempt": i, "success": True},
            )

        results = await asyncio.gather(
            *[attempt_write(i + 1) for i in range(parallel_writes_count)]
        )

        return Response.json(list(results))

async def retry_with_backoff(fn, success_result, max_attempts=5, initial_delay=1.0):
    attempts = 0
    delay = initial_delay

    while attempts < max_attempts:
        try:
            await fn()
            return success_result
        except Exception as error:
            if "KV PUT failed: 429 Too Many Requests" in str(error):
                attempts += 1
                if attempts >= max_attempts:
                    raise Exception("Max retry attempts reached")

                print(f"Attempt {attempts} failed. Retrying in {delay}s...")
                await asyncio.sleep(delay)

                delay *= 2
            else:
                raise
```

## Other methods to access KV

You can also [write key-value pairs from the command line with Wrangler](https://developers.cloudflare.com/kv/reference/kv-commands/#kv-namespace-create) and [write data via the REST API](https://developers.cloudflare.com/api/resources/kv/subresources/namespaces/subresources/values/methods/update/).

[PreviousRead key-value pairs](https://developers.cloudflare.com/kv/api/read-key-value-pairs/) [NextDelete key-value pairs](https://developers.cloudflare.com/kv/api/delete-key-value-pairs/)

Was this helpful?

YesNo

[Edit page](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/kv/api/write-key-value-pairs.mdx) [Report issue](https://github.com/cloudflare/cloudflare-docs/issues/new/choose)

## On this page

- [Overview](https://developers.cloudflare.com/kv/api/write-key-value-pairs/#_top)
- [Reference](https://developers.cloudflare.com/kv/api/write-key-value-pairs/#reference)
- [put() method](https://developers.cloudflare.com/kv/api/write-key-value-pairs/#put-method)
- [Guidance](https://developers.cloudflare.com/kv/api/write-key-value-pairs/#guidance)
- [Concurrent writes to the same key](https://developers.cloudflare.com/kv/api/write-key-value-pairs/#concurrent-writes-to-the-same-key)
- [Write data in bulk](https://developers.cloudflare.com/kv/api/write-key-value-pairs/#write-data-in-bulk)
- [Expiring keys](https://developers.cloudflare.com/kv/api/write-key-value-pairs/#expiring-keys)
- [Metadata](https://developers.cloudflare.com/kv/api/write-key-value-pairs/#metadata)
- [Limits to KV writes to the same key](https://developers.cloudflare.com/kv/api/write-key-value-pairs/#limits-to-kv-writes-to-the-same-key)
- [Other methods to access KV](https://developers.cloudflare.com/kv/api/write-key-value-pairs/#other-methods-to-access-kv)

Was this helpful?

YesNo

[Edit page](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/kv/api/write-key-value-pairs.mdx) [Report issue](https://github.com/cloudflare/cloudflare-docs/issues/new/choose)

Getting started

[Plans](https://www.cloudflare.com/plans/) [Contact sales](https://www.cloudflare.com/resource/contact-enterprise-sales/) [Partners](https://www.cloudflare.com/partners/) [Find a partner](https://partnerlocator.cloudflare.com/dashboard) [Startups](https://www.cloudflare.com/startups/) [Under attack?](https://www.cloudflare.com/under-attack-hotline/) [Domain name search](https://domains.cloudflare.com/)

Company

[About](https://www.cloudflare.com/about/) [Careers](https://www.cloudflare.com/careers/) [Investors](https://cloudflare.net/) [Press](https://www.cloudflare.com/press/) [Press kit](https://www.cloudflare.com/press/press-kit/) [Global network](https://www.cloudflare.com/network/)

Public interest

[Project Galileo](https://www.cloudflare.com/galileo/) [Athenian Project](https://www.cloudflare.com/athenian/) [Cloudflare for Campaigns](https://www.cloudflare.com/campaigns/) [Project Fairshot](https://www.cloudflare.com/fair-shot/) [Impact/ESG](https://www.cloudflare.com/impact/)

Compliance

[Compliance resources](https://www.cloudflare.com/trust-hub/compliance-resources/) [Trust Hub](https://www.cloudflare.com/trust-hub/) [Data Protection](https://www.cloudflare.com/trust-hub/gdpr/) [Responsible AI](https://www.cloudflare.com/trust-hub/responsible-ai/) [Transparency report](https://www.cloudflare.com/transparency/) [Report abuse](https://www.cloudflare.com/trust-hub/abuse-approach/)

Resources

[App innovation report](https://www.cloudflare.com/resource/app-innovation-report/) [Cloudflare Radar](https://radar.cloudflare.com/) [Case studies](https://www.cloudflare.com/case-studies/) [Status](https://www.cloudflarestatus.com/) [Support](https://support.cloudflare.com/) [Events](https://www.cloudflare.com/events/) [Blog](https://blog.cloudflare.com/)

Developers

[Documentation](https://developers.cloudflare.com/) [Learning center](https://www.cloudflare.com/learning/) [Community](https://community.cloudflare.com/)

Solutions

[SSE and SASE platform](https://www.cloudflare.com/sase/) [Cloudflare AI Cloud](https://www.cloudflare.com/solutions/ai/) [AI Security](https://www.cloudflare.com/solutions/ai-security/) [Frontend Development Platform](https://www.cloudflare.com/solutions/frontends/) [Multi-Tenant Platform Development](https://www.cloudflare.com/solutions/platforms/) [Web Security Platform](https://www.cloudflare.com/solutions/security/)

[Start Building](https://dash.cloudflare.com/sign-up) [Log In](https://dash.cloudflare.com/login)

© 2026 Cloudflare, Inc.

[Privacy policy](https://www.cloudflare.com/policies/privacy/) \| [Report security issues](https://www.cloudflare.com/disclosure/) \| [Terms of use](https://www.cloudflare.com/policies/terms/) \| [Trademark](https://www.cloudflare.com/trademark/)

\|

![privacy options](https://developers.cloudflare.com/cdn-cgi/image/onerror=redirect,width=26,height=12,format=svg/_astro/privacyoptions.BWXSiJOZ.svg)Your privacy choices

[![](https://developers.cloudflare.com/_astro/logo.te5VL_aD.svg)Docs](https://developers.cloudflare.com/)