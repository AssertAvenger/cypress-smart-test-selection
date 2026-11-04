# CLI or core library?

| Need | Interface |
| --- | --- |
| Read Git, load config, produce CI JSON | cy-select diff --base REF --json |
| Supply changes or integrate with another runner | Core /diff, /discovery and /mapper exports |
| Execute Cypress | Separate consumer/runner; this project returns a plan |

Both interfaces share one selection policy. Core has no subprocess/CLI dependency. The CLI uses the workspace core during development. Local tarball verification checks the package boundary without publication.

See [README.md](README.md) for contracts and limitations.
