[Skip to content](https://developers.cloudflare.com/d1/tutorials/build-an-api-to-access-d1/#main-content)

> Documentation Index
>
> Fetch the complete documentation index at: https://developers.cloudflare.com/d1/llms.txt
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

[All products](https://developers.cloudflare.com/)[D1](https://developers.cloudflare.com/d1/)

`/`

- [Overview](https://developers.cloudflare.com/d1/)
- [Getting started](https://developers.cloudflare.com/d1/get-started/)
- Best practices





  - [Import and export data](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
  - [Query a database](https://developers.cloudflare.com/d1/best-practices/query-d1/)
  - [Retry queries](https://developers.cloudflare.com/d1/best-practices/retry-queries/)
  - [Use indexes](https://developers.cloudflare.com/d1/best-practices/use-indexes/)
  - [Local development](https://developers.cloudflare.com/d1/best-practices/local-development/)
  - [Remote development](https://developers.cloudflare.com/d1/best-practices/remote-development/)
  - [Use D1 from Pages ↗](https://developers.cloudflare.com/pages/functions/bindings/#d1-databases)
  - [Global read replicationBeta](https://developers.cloudflare.com/d1/best-practices/read-replication/)

- Workers Binding API





  - [Overview](https://developers.cloudflare.com/d1/worker-api/)
  - [D1 Database](https://developers.cloudflare.com/d1/worker-api/d1-database/)
  - [Prepared statement methods](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)
  - [Return objects](https://developers.cloudflare.com/d1/worker-api/return-object/)

- SQL API





  - [SQL statements](https://developers.cloudflare.com/d1/sql-api/sql-statements/)
  - [Define foreign keys](https://developers.cloudflare.com/d1/sql-api/foreign-keys/)
  - [Query JSON](https://developers.cloudflare.com/d1/sql-api/query-json/)

- [Wrangler commands](https://developers.cloudflare.com/d1/wrangler-commands/)
- [REST API ↗API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/create/)
- Configuration





  - [Data location](https://developers.cloudflare.com/d1/configuration/data-location/)
  - [Environments](https://developers.cloudflare.com/d1/configuration/environments/)

- Observability





  - [Debug D1](https://developers.cloudflare.com/d1/observability/debug-d1/)
  - [Metrics and analytics](https://developers.cloudflare.com/d1/observability/metrics-analytics/)
  - [Billing](https://developers.cloudflare.com/d1/observability/billing/)
  - [Audit Logs](https://developers.cloudflare.com/d1/observability/audit-logs/)

- Examples





  - [Export and save D1 database ↗](https://developers.cloudflare.com/workflows/examples/backup-d1/)
  - [Query D1 from Remix](https://developers.cloudflare.com/d1/examples/d1-and-remix/)
  - [Query D1 from Hono](https://developers.cloudflare.com/d1/examples/d1-and-hono/)
  - [Query D1 from SvelteKit](https://developers.cloudflare.com/d1/examples/d1-and-sveltekit/)
  - [Query D1 from Python Workers](https://developers.cloudflare.com/d1/examples/query-d1-from-python-workers/)

- [Tutorials](https://developers.cloudflare.com/d1/tutorials/)
- [Demos and architectures](https://developers.cloudflare.com/d1/demos/)
- Platform





  - [Pricing](https://developers.cloudflare.com/d1/platform/pricing/)
  - [Limits](https://developers.cloudflare.com/d1/platform/limits/)
  - [Alpha database migration guide](https://developers.cloudflare.com/d1/platform/alpha-migration/)
  - [Choose a data or storage product ↗](https://developers.cloudflare.com/workers/platform/storage-options/)
  - [Release notes](https://developers.cloudflare.com/d1/platform/release-notes/)

- Reference





  - [Migrations](https://developers.cloudflare.com/d1/reference/migrations/)
  - [Time Travel and backups](https://developers.cloudflare.com/d1/reference/time-travel/)
  - [Community projects](https://developers.cloudflare.com/d1/reference/community-projects/)
  - [Generated columns](https://developers.cloudflare.com/d1/reference/generated-columns/)
  - [Data security](https://developers.cloudflare.com/d1/reference/data-security/)
  - [Backups (Legacy)](https://developers.cloudflare.com/d1/reference/backups/)
  - [FAQs](https://developers.cloudflare.com/d1/reference/faq/)
  - [Glossary](https://developers.cloudflare.com/d1/reference/glossary/)

- Agent resources





  - [Agent setup ↗](https://developers.cloudflare.com/agent-setup/)
  - [Cloudflare Skills ↗](https://github.com/cloudflare/skills)
  - [Code Mode MCP Server ↗](https://github.com/cloudflare/mcp)
  - [Domain-specific MCP Servers ↗MCP](https://github.com/cloudflare/mcp-server-cloudflare)
  - [D1 llms.txt ↗](https://developers.cloudflare.com/d1/llms.txt)
  - [D1 llms-full.txt ↗](https://developers.cloudflare.com/d1/llms-full.txt)
  - [Cloudflare Docs llms.txt ↗](https://developers.cloudflare.com/llms.txt)
  - [Cloudflare Docs llms-full.txt ↗](https://developers.cloudflare.com/llms-full.txt)

1. [Home](https://developers.cloudflare.com/)
2. / [D1](https://developers.cloudflare.com/d1/)
3. / [Tutorials](https://developers.cloudflare.com/d1/tutorials/)
4. /Build An Api To Access D1

# Build an API to access D1 using a proxy Worker

Last updated Aug 25, 2026\|Copy as Markdown\| [View as Markdown](https://developers.cloudflare.com/d1/tutorials/build-an-api-to-access-d1/index.md) \| [Agent setup](https://developers.cloudflare.com/agent-setup/)

OverviewPrerequisites1\. Create a new project2\. Install Hono3\. Add an API\_KEY4\. Initialize the application5\. Add API endpoints6\. Create a database7\. Add a binding8\. Create a table9\. Query the database10\. Test the API11\. Deploy the APISummaryNext steps

In this tutorial, you will learn how to create an API that allows you to securely run queries against a D1 database.

This is useful if you want to access a D1 database outside of a Worker or Pages project, customize access controls and/or limit what tables can be queried.

D1's built-in [REST API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/create/) is best suited for administrative use as the global [Cloudflare API rate limit](https://developers.cloudflare.com/fundamentals/api/reference/limits) applies.

To access a D1 database outside of a Worker project, you need to create an API using a Worker. Your application can then securely interact with this API to run D1 queries.

Note

D1 uses parameterized queries. This prevents SQL injection. To make your API more secure, validate the input using a library like [zod ↗](https://zod.dev/).

## Prerequisites

1. Sign up for a [Cloudflare account ↗](https://dash.cloudflare.com/sign-up/workers-and-pages).
2. Install [`Node.js` ↗](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm).
3. Have an existing D1 database. Refer to [Get started tutorial for D1](https://developers.cloudflare.com/d1/get-started/).

Node.js version manager

Use a Node version manager like [Volta ↗](https://volta.sh/) or
[nvm ↗](https://github.com/nvm-sh/nvm) to avoid permission issues and change
Node.js versions. [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/), discussed
later in this guide, requires a Node version of `16.17.0` or later.

## 1\. Create a new project

Create a new Worker to create and deploy your API.

1. Create a Worker named `d1-http` by running:





npmyarnpnpm







```
npm create cloudflare@latest -- d1-http
```











```
yarn create cloudflare d1-http
```











```
pnpm create cloudflare@latest d1-http
```









For setup, select the following options:
   - For _What would you like to start with?_, choose `Hello World example`.
   - For _Which template would you like to use?_, choose `Worker only`.
   - For _Which language do you want to use?_, choose `TypeScript`.
   - For _Do you want to use git for version control?_, choose `Yes`.
   - For _Do you want to deploy your application?_, choose `No` (we will be making some changes before deploying).
2. Change into your new project directory to start developing:


```
cd d1-http
```


## 2\. Install Hono

In this tutorial, you will use [Hono ↗](https://github.com/honojs/hono), an Express.js-style framework, to build the API.

1. To use Hono in this project, install it using `npm`:





npmyarnpnpmbun







```
npm i hono
```











```
yarn add hono
```











```
pnpm add hono
```











```
bun add hono
```


## 3\. Add an API\_KEY

You need an API key to make authenticated calls to the API. To ensure that the API key is secure, add it as a [secret](https://developers.cloudflare.com/workers/configuration/secrets).

1. For local development, create a `.dev.vars` file in the root directory of `d1-http`.

2. Add your API key in the file as follows.
.dev.varsbash

```
API_KEY="YOUR_API_KEY"
```


Replace `YOUR_API_KEY` with a valid string value. You can also generate this value using the following command.


```
openssl rand -base64 32
```


Note

In this step, we have defined the name of the API key to be `API_KEY`.

## 4\. Initialize the application

To initialize the application, you need to import the required packages, initialize a new Hono application, and configure the following middleware:

- [Bearer Auth ↗](https://hono.dev/docs/middleware/builtin/bearer-auth): Adds authentication to the API.
- [Logger ↗](https://hono.dev/docs/middleware/builtin/logger): Allows monitoring the flow of requests and responses.
- [Pretty JSON ↗](https://hono.dev/docs/middleware/builtin/pretty-json): Enables "JSON pretty print" for JSON response bodies.

1. Replace the contents of the `src/index.ts` file with the code below.
src/index.tsts

```
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";

type Bindings = {
   	API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", prettyJSON(), logger(), async (c, next) => {
   	const auth = bearerAuth({ token: c.env.API_KEY });
   	return auth(c, next);
});
```


## 5\. Add API endpoints

1. Add the following snippet into your `src/index.ts`.
src/index.tsts

```

// Paste this code at the end of the src/index.ts file

app.post("/api/all", async (c) => {
   	return c.text("/api/all endpoint");
});

app.post("/api/exec", async (c) => {
   	return c.text("/api/exec endpoint");
});

app.post("/api/batch", async (c) => {
   	return c.text("/api/batch endpoint");
});

export default app;
```


This adds the following endpoints:
   - POST `/api/all`
   - POST `/api/exec`
   - POST `/api/batch`
2. Start the development server by running the following command:





npmyarnpnpm







```
npm run dev
```











```
yarn run dev
```











```
pnpm run dev
```

3. To test the API locally, open a second terminal.

4. In the second terminal, execute the below cURL command. Replace `YOUR_API_KEY` with the value you set in the `.dev.vars` file.


```
curl -H "Authorization: Bearer YOUR_API_KEY" "http://localhost:8787/api/all" --data '{}'
```


You should get the following output:


```
/api/all endpoint
```

5. Stop the local server from running by pressing `x` in the first terminal.


The Hono application is now set up. You can test the other endpoints and add more endpoints if needed. The API does not yet return any information from your database. In the next steps, you will create a database, add its bindings, and update the endpoints to interact with the database.

## 6\. Create a database

If you do not have a D1 database already, you can create a new database with `wrangler d1 create`.

1. In your terminal, run:


```
npx wrangler d1 create d1-http-example
```


You may be asked to login to your Cloudflare account. Once logged in, the command will create a new D1 database. You should see a similar output in your terminal.


```
✅ Successfully created DB 'd1-http-example' in region EEUR
Created your new D1 database.

[[d1_databases]]
binding = "DB" # i.e. available in your Worker on env.DB
database_name = "d1-http-example"
database_id = "1234567890"
```


Make a note of the displayed `database_name` and `database_id`. You will use this to reference the database by creating a [binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/).

## 7\. Add a binding

1. From your `d1-http` folder, open the Wrangler file, Wrangler's configuration file.

2. Add the following binding in the file. Make sure that the `database_name` and the `database_id` are correct.



wrangler.jsoncwrangler.toml







```
{
     "d1_databases": [\
       {\
         "binding": "DB", // i.e. available in your Worker on env.DB\
         "database_name": "d1-http-example",\
         "database_id": "1234567890"\
       }\
     ]
}
```







```
[[d1_databases]]
binding = "DB"
database_name = "d1-http-example"
database_id = "1234567890"
```

3. In your `src/index.ts` file, update the `Bindings` type by adding `DB: D1Database`.


```
type Bindings = {
   	DB: D1Database;
   	API_KEY: string;
};
```


You can now access the database in the Hono application.

## 8\. Create a table

To create a table in your newly created database:

1. Create a new folder called `schemas` inside your `d1-http` folder.

2. Create a new file called `schema.sql`, and paste the following SQL statement into the file.
schema.sqlsql

```
DROP TABLE IF EXISTS posts;
CREATE TABLE IF NOT EXISTS posts (
   	id integer PRIMARY KEY AUTOINCREMENT,
   	author text NOT NULL,
   	title text NOT NULL,
   	body text NOT NULL,
   	post_slug text NOT NULL
);
INSERT INTO posts (author, title, body, post_slug) VALUES ('Harshil', 'D1 HTTP API', 'Learn to create an API to query your D1 database.','d1-http-api');
```


The code drops any table named `posts` if it exists, then creates a new table `posts` with the field `id`, `author`, `title`, `body`, and `post_slug`. It then uses an INSERT statement to populate the table.

3. In your terminal, execute the following command to create this table:


```
npx wrangler d1 execute d1-http-example --file=./schemas/schema.sql
```


Upon successful execution, a new table will be added to your database.

Note

The table will be created in the local instance of the database. If you want to add this table to your production database set `"remote" : true` in the D1 binding configuration. Refer to the [remote bindings documentation](https://developers.cloudflare.com/workers/local-development/#remote-bindings) for more information.

## 9\. Query the database

Your application can now access the D1 database. In this step, you will update the API endpoints to query the database and return the result.

1. In your `src/index.ts` file, update the code as follow.
src/index.tsts

```
// Update the API routes

/**
* Executes the `stmt.run()` method.
* https://developers.cloudflare.com/d1/worker-api/prepared-statements/#run
*/

app.post('/api/all', async (c) => {
   		return c.text("/api/all endpoint");
   	try {
   		let { query, params } = await c.req.json();
   		let stmt = c.env.DB.prepare(query);
   		if (params) {
   			stmt = stmt.bind(params);
   		}

   		const result = await stmt.run();
   		return c.json(result);
   	} catch (err) {
   		return c.json({ error: `Failed to run query: ${err}` }, 500);
   	}
});

/**
* Executes the `db.exec()` method.
* https://developers.cloudflare.com/d1/worker-api/d1-database/#exec
*/

app.post('/api/exec', async (c) => {
   		return c.text("/api/exec endpoint");
   	try {
   		let { query } = await c.req.json();
   		let result = await c.env.DB.exec(query);
   		return c.json(result);
   	} catch (err) {
   		return c.json({ error: `Failed to run query: ${err}` }, 500);
   	}
});

/**
* Executes the `db.batch()` method.
* https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
*/

app.post('/api/batch', async (c) => {
   		return c.text("/api/batch endpoint");
   	try {
   		let { batch } = await c.req.json();
   		let stmts = [];
   		for (let query of batch) {
   			let stmt = c.env.DB.prepare(query.query);
   			if (query.params) {
   				stmts.push(stmt.bind(query.params));
   			} else {
   				stmts.push(stmt);
   			}
   		}
   		const results = await c.env.DB.batch(stmts);
   		return c.json(results);
   	} catch (err) {
   		return c.json({ error: `Failed to run query: ${err}` }, 500);
   	}
});
...
```


In the above code, the endpoints are updated to receive `query` and `params`. These queries and parameters are passed to the respective functions to interact with the database.

- If the query is successful, you receive the result from the database.
- If there is an error, the error message is returned.

## 10\. Test the API

Now that the API can query the database, you can test it locally.

1. Start the development server by executing the following command:





npmyarnpnpm







```
npm run dev
```











```
yarn run dev
```











```
pnpm run dev
```

2. In a new terminal window, execute the following cURL commands. Make sure to replace `YOUR_API_KEY` with the correct value.
/api/allsh

```
curl -H "Authorization: Bearer YOUR_API_KEY" "http://localhost:8787/api/all" --data '{"query": "SELECT title FROM posts WHERE id=?", "params":1}'
```

/api/batchsh

```
curl -H "Authorization: Bearer YOUR_API_KEY" "http://localhost:8787/api/batch" --data '{"batch": [ {"query": "SELECT title FROM posts WHERE id=?", "params":1},{"query": "SELECT id FROM posts"}]}'
```

/api/execsh

```
curl -H "Authorization: Bearer YOUR_API_KEY" "localhost:8787/api/exec" --data '{"query": "INSERT INTO posts (author, title, body, post_slug) VALUES ('\''Harshil'\'', '\''D1 HTTP API'\'', '\''Learn to create an API to query your D1 database.'\'','\''d1-http-api'\'')" }'
```


If everything is implemented correctly, the above commands should result successful outputs.

## 11\. Deploy the API

Now that everything is working as expected, the last step is to deploy it to the Cloudflare network. You will use Wrangler to deploy the API.

1. To use the API in production instead of using it locally, you need to add the table to your remote (production) database. To add the table to your production database, run the following command:


```
npx wrangler d1 execute d1-http-example --file=./schemas/schema.sql --remote
```


You should now be able to view the table on the [Cloudflare dashboard > **Storage & Databases** \> **D1**. ↗](https://dash.cloudflare.com/?to=/:account/workers/d1/)

2. To deploy the application to the Cloudflare network, run the following command:


```
npx wrangler deploy
```



```
    ⛅️ wrangler 3.78.4 (update available 3.78.5)
   -------------------------------------------------------

Total Upload: 53.00 KiB / gzip: 13.16 KiB
Your worker has access to the following bindings:
- D1 Databases:
  - DB: d1-http-example (DATABASE_ID)
Uploaded d1-http (4.29 sec)
Deployed d1-http triggers (5.57 sec)
[DEPLOYED_APP_LINK]
Current Version ID: [BINDING_ID]
```

Upon successful deployment, you will get the link of the deployed app in the terminal (`DEPLOYED_APP_LINK`). Make a note of it.

3. Generate a new API key to use in production.


```
openssl rand -base64 32
```



```
[YOUR_API_KEY]
```

4. Execute the `wrangler secret put` command to add an API to the deployed project.


```
npx wrangler secret put API_KEY
```



```
✔ Enter a secret value:
```


The terminal will prompt you to enter a secret value.

5. Enter the value of your API key (`YOUR_API_KEY`). Your API key will now be added to your project. Using this value you can make secure API calls to your deployed API.


```
✔ Enter a secret value: [YOUR_API_KEY]
```



```
🌀 Creating the secret for the Worker "d1-http"
✨ Success! Uploaded secret API_KEY
```

6. To test it, run the following cURL command with the correct `YOUR_API_KEY` and `DEPLOYED_APP_LINK`.


   - Use the `YOUR_API_KEY` you have generated as the secret API key.
   - You can also find your `DEPLOYED_APP_LINK` from the Cloudflare dashboard > **Workers & Pages** \> **`d1-http`** \> **Settings** \> **Domains & Routes**.

```
curl -H "Authorization: Bearer YOUR_API_KEY" "https://DEPLOYED_APP_LINK/api/exec" --data '{"query": "SELECT 1"}'
```

## Summary

In this tutorial, you have:

1. Created an API that interacts with your D1 database.
2. Deployed this API to the Workers. You can use this API in your external application to execute queries against your D1 database. The full code for this tutorial can be found on [GitHub ↗](https://github.com/harshil1712/d1-http-example/tree/main).

## Next steps

You can check out a similar implementation that uses Zod for validation in [this GitHub repository ↗](https://github.com/elithrar/http-api-d1-example). If you want to build an OpenAPI compliant API for your D1 database, you should use the [Cloudflare Workers OpenAPI 3.1 template ↗](https://github.com/cloudflare/workers-sdk/tree/main/templates/worker-openapi).

Was this helpful?

YesNo

[Edit page](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/d1/tutorials/build-an-api-to-access-d1.mdx) [Report issue](https://github.com/cloudflare/cloudflare-docs/issues/new/choose)

## On this page

- [Overview](https://developers.cloudflare.com/d1/tutorials/build-an-api-to-access-d1/#_top)
- [Prerequisites](https://developers.cloudflare.com/d1/tutorials/build-an-api-to-access-d1/#prerequisites)
- [1\. Create a new project](https://developers.cloudflare.com/d1/tutorials/build-an-api-to-access-d1/#1-create-a-new-project)
- [2\. Install Hono](https://developers.cloudflare.com/d1/tutorials/build-an-api-to-access-d1/#2-install-hono)
- [3\. Add an API\_KEY](https://developers.cloudflare.com/d1/tutorials/build-an-api-to-access-d1/#3-add-an-api_key)
- [4\. Initialize the application](https://developers.cloudflare.com/d1/tutorials/build-an-api-to-access-d1/#4-initialize-the-application)
- [5\. Add API endpoints](https://developers.cloudflare.com/d1/tutorials/build-an-api-to-access-d1/#5-add-api-endpoints)
- [6\. Create a database](https://developers.cloudflare.com/d1/tutorials/build-an-api-to-access-d1/#6-create-a-database)
- [7\. Add a binding](https://developers.cloudflare.com/d1/tutorials/build-an-api-to-access-d1/#7-add-a-binding)
- [8\. Create a table](https://developers.cloudflare.com/d1/tutorials/build-an-api-to-access-d1/#8-create-a-table)
- [9\. Query the database](https://developers.cloudflare.com/d1/tutorials/build-an-api-to-access-d1/#9-query-the-database)
- [10\. Test the API](https://developers.cloudflare.com/d1/tutorials/build-an-api-to-access-d1/#10-test-the-api)
- [11\. Deploy the API](https://developers.cloudflare.com/d1/tutorials/build-an-api-to-access-d1/#11-deploy-the-api)
- [Summary](https://developers.cloudflare.com/d1/tutorials/build-an-api-to-access-d1/#summary)
- [Next steps](https://developers.cloudflare.com/d1/tutorials/build-an-api-to-access-d1/#next-steps)

Was this helpful?

YesNo

[Edit page](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/d1/tutorials/build-an-api-to-access-d1.mdx) [Report issue](https://github.com/cloudflare/cloudflare-docs/issues/new/choose)

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