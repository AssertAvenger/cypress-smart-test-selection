# Selection API

**mapDiffToTests(changes, specs, options)** returns a promise containing paths, status, reasons, scores and inventory size.

Supply projectRoot when inputs refer to another project. Patterns are anchored to this root; lower-level calculateDirectoryScore expects project-relative paths.

Conservative mode uses explicit mappings/direct changes. Any relevant path without coverage, matching mapping without targets, or shared dependency/config change triggers the full discovered suite. Smoke checks cannot substitute for coverage of an unrelated change.

Opt-in heuristic mode also uses filename-token Dice overlap and tag-token overlap. Scores combine as 1 - product(1 - weightedScore), clamped to [0, 1]. This is a ranking signal, not a probability. Zero weights disable the respective heuristic; explicit/direct rules always apply.

| Legacy safety label | Heuristic threshold |
| --- | --- |
| high | Any positive score |
| moderate | 0.2 |
| medium | 0.4 |
| low | 0.7 |

A finite threshold from 0 to 1 overrides the preset. Presets do not change conservative rules. Tags do not bypass thresholds. Smoke/explicit rules are independent of scores.

Config accepts mappings, smoke, fullSuiteOnChange and ignoreChanges. See [root documentation](../../../../README.md).
