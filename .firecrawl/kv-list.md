[Skip to content](https://developers.cloudflare.com/kv/api/list-keys/#main-content)

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
4. /List keys

# List keys

Last updated Jun 22, 2026\|Copy as Markdown\| [View as Markdown](https://developers.cloudflare.com/kv/api/list-keys/index.md) \| [Agent setup](https://developers.cloudflare.com/agent-setup/)

OverviewReference list() methodGuidance List by prefix Ordering Pagination Optimizing storage with metadata for list() operationsOther methods to access KV

To list all the keys in your KV namespace, call the `list()` method of the [KV binding](https://developers.cloudflare.com/kv/concepts/kv-bindings/) on any [KV namespace](https://developers.cloudflare.com/kv/concepts/kv-namespaces/) you have bound to your Worker code:

JavaScriptPython

```
env.NAMESPACE.list();
```

```
await self.env.NAMESPACE.list()
```

The `list()` method returns a promise you can `await` on to get the value.

#### Example

An example of listing keys from within a Worker:

JavaScriptPython

```
export default {
  async fetch(request, env, ctx) {
    try {
      const value = await env.NAMESPACE.list();

      return new Response(JSON.stringify(value.keys), {
        status: 200
      });
    }
    catch (e)
    {
      return new Response(e.message, {status: 500});
    }
  },
};
```

```
from workers import WorkerEntrypoint, Response

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        try:
            value = await self.env.NAMESPACE.list()

            return Response.json(value["keys"])
        except Exception as e:
            return Response(str(e), status=500)
```

## Reference

The following method is provided to list the keys of KV:

- [list()](https://developers.cloudflare.com/kv/api/list-keys/#list-method)

### `list()` method

To list all the keys in your KV namespace, call the `list()` method of the [KV binding](https://developers.cloudflare.com/kv/concepts/kv-bindings/) on any KV namespace you have bound to your Worker code:

JavaScriptPython

```
env.NAMESPACE.list(options?)
```

```
self.env.NAMESPACE.list(options)
```

#### Parameters

- `options`: `{ prefix?: string, limit?: string, cursor?: string }`
  - An object with attributes `prefix` (optional), `limit` (optional), or `cursor` (optional).

    - `prefix` is a `string` that represents a prefix you can use to filter all keys.
    - `limit` is the maximum number of keys returned. The default is 1,000 keys, which is the maximum. It is unlikely that you will want to change this default but it is included for completeness.
    - `cursor` is a `string` used for paginating responses.

#### Response

- `response`: `Promise<{ keys: {   name: string,   expiration?: number,   metadata?: object }[], list_complete: boolean, cursor: string }>`
  - A `Promise` that resolves to an object containing `keys`, `list_complete`, and `cursor` attributes.

    - `keys` is an array that contains an object for each key listed. Each object has attributes `name`, `expiration` (optional), and `metadata` (optional). If the key-value pair has an expiration set, the expiration will be present and in absolute value form (even if it was set in TTL form). If the key-value pair has non-null metadata set, the metadata will be present.
    - `list_complete` is a boolean, which will be `false` if there are more keys to fetch, even if the `keys` array is empty.
    - `cursor` is a `string` used for paginating responses.

The `list()` method returns a promise which resolves with an object that looks like the following:

```
{
  "keys": [\
    {\
      "name": "foo",\
      "expiration": 1234,\
      "metadata": { "someMetadataKey": "someMetadataValue" }\
    }\
  ],
  "list_complete": false,
  "cursor": "6Ck1la0VxJ0djhidm1MdX2FyD"
}
```

The `keys` property will contain an array of objects describing each key. That object will have one to three keys of its own: the `name` of the key, and optionally the key's `expiration` and `metadata` values.

The `name` is a `string`, the `expiration` value is a number, and `metadata` is whatever type was set initially. The `expiration` value will only be returned if the key has an expiration and will be in the absolute value form, even if it was set in the TTL form. Any `metadata` will only be returned if the given key has non-null associated metadata.

If `list_complete` is `false`, there are more keys to fetch, even if the `keys` array is empty. You will use the `cursor` property to get more keys. Refer to [Pagination](https://developers.cloudflare.com/kv/api/list-keys/#pagination) for more details.

Consider storing your values in metadata if your values fit in the [metadata-size limit](https://developers.cloudflare.com/kv/platform/limits/). Storing values in metadata is more efficient than a `list()` followed by a `get()` per key. When using `put()`, leave the `value` parameter empty and instead include a property in the metadata object:

JavaScriptPython

```
await NAMESPACE.put(key, "", {
  metadata: { value: value },
});
```

```
await self.env.NAMESPACE.put(key, "", metadata={"value": value})
```

Changes may take up to 60 seconds (or the value set with `cacheTtl` of the `get()` or `getWithMetadata()` method) to be reflected on the application calling the method on the KV namespace.

## Guidance

### List by prefix

List all the keys starting with a particular prefix.

For example, you may have structured your keys with a user, a user ID, and key names, separated by colons (such as `user:1:<key>`). You could get the keys for user number one by using the following code:

JavaScriptPython

```
export default {
  async fetch(request, env, ctx) {
    const value = await env.NAMESPACE.list({ prefix: "user:1:" });
    return new Response(value.keys);
  },
};
```

```
from workers import WorkerEntrypoint, Response

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        value = await self.env.NAMESPACE.list(prefix="user:1:")
        return Response(str(value["keys"]))
```

This will return all keys starting with the `"user:1:"` prefix.

### Ordering

Keys are always returned in lexicographically sorted order according to their UTF-8 bytes.

### Pagination

If there are more keys to fetch, the `list_complete` key will be set to `false` and a `cursor` will also be returned. In this case, you can call `list()` again with the `cursor` value to get the next batch of keys:

JavaScriptPython

```
const value = await NAMESPACE.list();

const cursor = value.cursor;

const next_value = await NAMESPACE.list({ cursor: cursor });
```

```
value = await self.env.NAMESPACE.list()

cursor = value.get("cursor")

next_value = await self.env.NAMESPACE.list(cursor=cursor)
```

Checking for an empty array in `keys` is not sufficient to determine whether there are more keys to fetch. Instead, use `list_complete`.

It is possible to have an empty array in `keys`, but still have more keys to fetch, because [recently expired or deleted keys ↗](https://en.wikipedia.org/wiki/Tombstone_%28data_store%29) must be iterated through but will not be included in the returned `keys`.

When de-paginating a large result set while also providing a `prefix` argument, the `prefix` argument must be provided in all subsequent calls along with the initial arguments.

### Optimizing storage with metadata for `list()` operations

Consider storing your values in metadata if your values fit in the [metadata-size limit](https://developers.cloudflare.com/kv/platform/limits/). Storing values in metadata is more efficient than a `list()` followed by a `get()` per key. When using `put()`, leave the `value` parameter empty and instead include a property in the metadata object:

JavaScriptPython

```
await NAMESPACE.put(key, "", {
  metadata: { value: value },
});
```

```
await self.env.NAMESPACE.put(key, "", metadata={"value": value})
```

## Other methods to access KV

You can also [list keys on the command line with Wrangler](https://developers.cloudflare.com/kv/reference/kv-commands/#kv-namespace-list) or [with the REST API](https://developers.cloudflare.com/api/resources/kv/subresources/namespaces/subresources/keys/methods/list/).

[PreviousDelete key-value pairs](https://developers.cloudflare.com/kv/api/delete-key-value-pairs/) [NextStore and retrieve static assets](https://developers.cloudflare.com/kv/examples/workers-kv-to-serve-assets/)

Was this helpful?

YesNo

[Edit page](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/kv/api/list-keys.mdx) [Report issue](https://github.com/cloudflare/cloudflare-docs/issues/new/choose)

## On this page

- [Overview](https://developers.cloudflare.com/kv/api/list-keys/#_top)
- [Reference](https://developers.cloudflare.com/kv/api/list-keys/#reference)
- [list() method](https://developers.cloudflare.com/kv/api/list-keys/#list-method)
- [Guidance](https://developers.cloudflare.com/kv/api/list-keys/#guidance)
- [List by prefix](https://developers.cloudflare.com/kv/api/list-keys/#list-by-prefix)
- [Ordering](https://developers.cloudflare.com/kv/api/list-keys/#ordering)
- [Pagination](https://developers.cloudflare.com/kv/api/list-keys/#pagination)
- [Optimizing storage with metadata for list() operations](https://developers.cloudflare.com/kv/api/list-keys/#optimizing-storage-with-metadata-for-list-operations)
- [Other methods to access KV](https://developers.cloudflare.com/kv/api/list-keys/#other-methods-to-access-kv)

Was this helpful?

YesNo

[Edit page](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/kv/api/list-keys.mdx) [Report issue](https://github.com/cloudflare/cloudflare-docs/issues/new/choose)

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