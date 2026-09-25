[View source on GitHub](https://github.com/jaredwray/keyv)![logo](https://keyv.org/logo.svg)

# Simple key-value storage with support for multiple backends

[Documentation](https://keyv.org/docs)

## Contributors

[![jaredwray](https://avatars.githubusercontent.com/u/1205481?v=4)](https://github.com/jaredwray "jaredwray")[![lukechilds](https://avatars.githubusercontent.com/u/2123375?v=4)](https://github.com/lukechilds "lukechilds")[![stropicall](https://avatars.githubusercontent.com/u/39932421?v=4)](https://github.com/stropicall "stropicall")[![greenkeeper[bot]](https://avatars.githubusercontent.com/in/505?v=4)](https://github.com/apps/greenkeeper "greenkeeper[bot]")[![adityapatadia](https://avatars.githubusercontent.com/u/1086617?v=4)](https://github.com/adityapatadia "adityapatadia")[![trevor-scheer](https://avatars.githubusercontent.com/u/29644393?v=4)](https://github.com/trevor-scheer "trevor-scheer")[![mahdavipanah](https://avatars.githubusercontent.com/u/1397846?v=4)](https://github.com/mahdavipanah "mahdavipanah")[![Sadzurami](https://avatars.githubusercontent.com/u/47674424?v=4)](https://github.com/Sadzurami "Sadzurami")[![darky](https://avatars.githubusercontent.com/u/1832800?v=4)](https://github.com/darky "darky")[![cprendergast19](https://avatars.githubusercontent.com/u/34251406?v=4)](https://github.com/cprendergast19 "cprendergast19")[![brunocamargos](https://avatars.githubusercontent.com/u/4685378?v=4)](https://github.com/brunocamargos "brunocamargos")[![mcfedr](https://avatars.githubusercontent.com/u/704356?v=4)](https://github.com/mcfedr "mcfedr")[![tatejones](https://avatars.githubusercontent.com/u/452235?v=4)](https://github.com/tatejones "tatejones")[![Kikobeats](https://avatars.githubusercontent.com/u/2096101?v=4)](https://github.com/Kikobeats "Kikobeats")[![e0ipso](https://avatars.githubusercontent.com/u/1140906?v=4)](https://github.com/e0ipso "e0ipso")[![nathan-knight](https://avatars.githubusercontent.com/u/20479649?v=4)](https://github.com/nathan-knight "nathan-knight")[![airtoxin](https://avatars.githubusercontent.com/u/2460874?v=4)](https://github.com/airtoxin "airtoxin")[![ComfortablyCoding](https://avatars.githubusercontent.com/u/44623501?v=4)](https://github.com/ComfortablyCoding "ComfortablyCoding")[![nolliebigspin](https://avatars.githubusercontent.com/u/34278963?v=4)](https://github.com/nolliebigspin "nolliebigspin")[![colmer](https://avatars.githubusercontent.com/u/4122445?v=4)](https://github.com/colmer "colmer")[![ariesclark](https://avatars.githubusercontent.com/u/10256477?v=4)](https://github.com/ariesclark "ariesclark")[![BeastGamer81](https://avatars.githubusercontent.com/u/57034210?v=4)](https://github.com/BeastGamer81 "BeastGamer81")[![becca-miller](https://avatars.githubusercontent.com/u/18152496?v=4)](https://github.com/becca-miller "becca-miller")[![theaussiepom](https://avatars.githubusercontent.com/u/53800477?v=4)](https://github.com/theaussiepom "theaussiepom")[![mshah-ap](https://avatars.githubusercontent.com/u/132661471?v=4)](https://github.com/mshah-ap "mshah-ap")[![claabs](https://avatars.githubusercontent.com/u/6274312?v=4)](https://github.com/claabs "claabs")[![AuspeXeu](https://avatars.githubusercontent.com/u/2115696?v=4)](https://github.com/AuspeXeu "AuspeXeu")[![cialese](https://avatars.githubusercontent.com/u/45037795?v=4)](https://github.com/cialese "cialese")[![csjewell](https://avatars.githubusercontent.com/u/67483?v=4)](https://github.com/csjewell "csjewell")[![cesarfd](https://avatars.githubusercontent.com/u/10957618?v=4)](https://github.com/cesarfd "cesarfd")

## Latest's Releases

[v6.0.0-beta.1](https://github.com/jaredwray/keyv/releases/tag/v6.0.0-beta.1) April 01, 2026


## What's Changed

- keyv - feat (breaking) stats / telemetry overhaul by @jaredwray in [https://github.com/jaredwray/keyv/pull/1912](https://github.com/jaredwray/keyv/pull/1912)
- keyv - feat: (breaking) memory adapter, bridge adapter, keyv overhaul by @jaredwray in [https://github.com/jaredwray/keyv/pull/1913](https://github.com/jaredwray/keyv/pull/1913)
- bigmap - feat: Optimize BigMap hash function and hot path performance by @jaredwray in [https://github.com/jaredwray/keyv/pull/1915](https://github.com/jaredwray/keyv/pull/1915)
- dynamo - feat: Add disconnect and iterator methods to KeyvDynamo by @jaredwray in [https://github.com/jaredwray/keyv/pull/1914](https://github.com/jaredwray/keyv/pull/1914)
- keyv - fix: handling has and hasMany better by @jaredwray in [https://github.com/jaredwray/keyv/pull/1916](https://github.com/jaredwray/keyv/pull/1916)
- keyv - fix: adding in decode expiring to has by @jaredwray in [https://github.com/jaredwray/keyv/pull/1917](https://github.com/jaredwray/keyv/pull/1917)
- keyv - feat: adding hooks for setMany and deleteMany by @jaredwray in [https://github.com/jaredwray/keyv/pull/1918](https://github.com/jaredwray/keyv/pull/1918)
- keyv - fix: dead code on getManyRaw by @jaredwray in [https://github.com/jaredwray/keyv/pull/1919](https://github.com/jaredwray/keyv/pull/1919)
- keyv - fix: on set with no result do not send telemetry STAT\_SET by @jaredwray in [https://github.com/jaredwray/keyv/pull/1920](https://github.com/jaredwray/keyv/pull/1920)
- keyv - fix: telemetry issue on setRaw by @jaredwray in [https://github.com/jaredwray/keyv/pull/1921](https://github.com/jaredwray/keyv/pull/1921)
- keyv - fix: having encode / decode propegate errors by @jaredwray in [https://github.com/jaredwray/keyv/pull/1922](https://github.com/jaredwray/keyv/pull/1922)
- keyv - feat: (breaking) by default keyv no longer checks expires by @jaredwray in [https://github.com/jaredwray/keyv/pull/1923](https://github.com/jaredwray/keyv/pull/1923)
- keyv - feat: adding in hooks for clear and disconnect by @jaredwray in [https://github.com/jaredwray/keyv/pull/1924](https://github.com/jaredwray/keyv/pull/1924)
- keyv - fix: minor bug fixes on memory, ttl, etc by @jaredwray in [https://github.com/jaredwray/keyv/pull/1925](https://github.com/jaredwray/keyv/pull/1925)
- mono - feat: moving to tsdown for build by @jaredwray in [https://github.com/jaredwray/keyv/pull/1926](https://github.com/jaredwray/keyv/pull/1926)
- encryption-node - feat: Add Node.js encryption adapter for Keyv by @jaredwray in [https://github.com/jaredwray/keyv/pull/1927](https://github.com/jaredwray/keyv/pull/1927)
- encrypt-web - feat: adding new web crypto module by @jaredwray in [https://github.com/jaredwray/keyv/pull/1928](https://github.com/jaredwray/keyv/pull/1928)
- keyv - feat: (breaking) removing StoredData and StoredDataRaw types by @jaredwray in [https://github.com/jaredwray/keyv/pull/1929](https://github.com/jaredwray/keyv/pull/1929)
- keyv - feat: enhancing capabilities by @jaredwray in [https://github.com/jaredwray/keyv/pull/1930](https://github.com/jaredwray/keyv/pull/1930)
- test-suite - feat (breaking) overhaul based on v6 changes by @jaredwray in [https://github.com/jaredwray/keyv/pull/1931](https://github.com/jaredwray/keyv/pull/1931)

**Full Changelog**: [https://github.com/jaredwray/keyv/compare/v6.0.0](https://github.com/jaredwray/keyv/compare/v6.0.0)-alpha.4...v6.0.0-beta.1

[v6.0.0-alpha.4](https://github.com/jaredwray/keyv/releases/tag/v6.0.0-alpha.4) March 27, 2026


## What's Changed

- keyv - feat: (breaking) moving to Hookified by @jaredwray in [https://github.com/jaredwray/keyv/pull/1900](https://github.com/jaredwray/keyv/pull/1900)
- compression - feat: moving to KeyvCompressionAdapter standard by @jaredwray in [https://github.com/jaredwray/keyv/pull/1901](https://github.com/jaredwray/keyv/pull/1901)
- keyv - feat: (breaking) api changes and iterator simplification by @jaredwray in [https://github.com/jaredwray/keyv/pull/1902](https://github.com/jaredwray/keyv/pull/1902)
- keyv - feat: moving storage setMany to use KeyvEntry by @jaredwray in [https://github.com/jaredwray/keyv/pull/1903](https://github.com/jaredwray/keyv/pull/1903)
- keyv - feat: (breaking) moving to boolean return on set by @jaredwray in [https://github.com/jaredwray/keyv/pull/1904](https://github.com/jaredwray/keyv/pull/1904)
- keyv - fix: (breaking) setRaw and setMany raw do not need ttl param by @jaredwray in [https://github.com/jaredwray/keyv/pull/1905](https://github.com/jaredwray/keyv/pull/1905)
- keyv - feat: (breaking) removing opts from KeyvStorageAdapter by @jaredwray in [https://github.com/jaredwray/keyv/pull/1906](https://github.com/jaredwray/keyv/pull/1906)
- keyv - feat: browser compatability by @jaredwray in [https://github.com/jaredwray/keyv/pull/1907](https://github.com/jaredwray/keyv/pull/1907)
- keyv - fix: updating checks for browser tests by @jaredwray in [https://github.com/jaredwray/keyv/pull/1908](https://github.com/jaredwray/keyv/pull/1908)
- feat: updating capability helper functions by @jaredwray in [https://github.com/jaredwray/keyv/pull/1909](https://github.com/jaredwray/keyv/pull/1909)
- keyv - feat: clean up of code with fixes and helpers by @jaredwray in [https://github.com/jaredwray/keyv/pull/1910](https://github.com/jaredwray/keyv/pull/1910)

**Full Changelog**: [https://github.com/jaredwray/keyv/compare/v6.0.0](https://github.com/jaredwray/keyv/compare/v6.0.0)-alpha.3...v6.0.0-alpha.4

[v6.0.0-alpha.3](https://github.com/jaredwray/keyv/releases/tag/v6.0.0-alpha.3) March 22, 2026


## What's Changed

- sqlite - feat: moving to namespace and modern adapter methods by @jaredwray in [https://github.com/jaredwray/keyv/pull/1884](https://github.com/jaredwray/keyv/pull/1884)
- sqlite - feat: adding in benchmarks by @jaredwray in [https://github.com/jaredwray/keyv/pull/1885](https://github.com/jaredwray/keyv/pull/1885)
- sqlite - feat: adding in driver for sqlite3 for legacy by @jaredwray in [https://github.com/jaredwray/keyv/pull/1886](https://github.com/jaredwray/keyv/pull/1886)
- sqlite - feat: major clean up of drivers and code base by @jaredwray in [https://github.com/jaredwray/keyv/pull/1887](https://github.com/jaredwray/keyv/pull/1887)
- memcache - feat: moving to using faker for unit tests by @jaredwray in [https://github.com/jaredwray/keyv/pull/1888](https://github.com/jaredwray/keyv/pull/1888)
- redis - chore: updating tests with faker by @jaredwray in [https://github.com/jaredwray/keyv/pull/1889](https://github.com/jaredwray/keyv/pull/1889)
- dynamo - chore: moving to using faker for tests by @jaredwray in [https://github.com/jaredwray/keyv/pull/1890](https://github.com/jaredwray/keyv/pull/1890)
- etcd - chore: moving to faker for tests by @jaredwray in [https://github.com/jaredwray/keyv/pull/1891](https://github.com/jaredwray/keyv/pull/1891)
- bigmap - feat: moving this to core folder as it Map interface by @jaredwray in [https://github.com/jaredwray/keyv/pull/1892](https://github.com/jaredwray/keyv/pull/1892)
- etcd - feat: moving to v6 functionality by @jaredwray in [https://github.com/jaredwray/keyv/pull/1893](https://github.com/jaredwray/keyv/pull/1893)
- dynamo - feat: moving to v6 requirements many functions and namespace by @jaredwray in [https://github.com/jaredwray/keyv/pull/1894](https://github.com/jaredwray/keyv/pull/1894)
- mono - fix: working to speed up actions by @jaredwray in [https://github.com/jaredwray/keyv/pull/1895](https://github.com/jaredwray/keyv/pull/1895)
- memcache - fix: handling namespace support better by @jaredwray in [https://github.com/jaredwray/keyv/pull/1896](https://github.com/jaredwray/keyv/pull/1896)
- keyv - feat: adding raw set features by @jaredwray in [https://github.com/jaredwray/keyv/pull/1897](https://github.com/jaredwray/keyv/pull/1897)
- keyv - feat: moving to serialization optional by @jaredwray in [https://github.com/jaredwray/keyv/pull/1898](https://github.com/jaredwray/keyv/pull/1898)
- keyv - feat: (breaking) no longer supporting key prefixing in core by @jaredwray in [https://github.com/jaredwray/keyv/pull/1899](https://github.com/jaredwray/keyv/pull/1899)

**Full Changelog**: [https://github.com/jaredwray/keyv/compare/v6.0.0](https://github.com/jaredwray/keyv/compare/v6.0.0)-alpha.2...v6.0.0-alpha.3

[All Releases\\
→](https://keyv.org/releases)

 Powered by
 [![docula logo](https://docula.org/logo_horizontal.png)](https://docula.org/)