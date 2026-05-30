# Coding Agent Architecture Pitfalls

Execute as superintelligent Principal AI Architect & Researcher and provide an architectural deep-dive and actionable rulebook for building an extensible, enterprise-grade AI coding agent.

## Context

I am launching a startup to build a powerful, highly extensible AI coding agent. I need to design the foundational architecture to ensure long-term scalability and avoid common early-stage engineering traps.

Research online including the following sources, with the focus on top level architecture and long term scalability:

1. Academic literature on LLM agents, tool usage (skills+cli based, no MCP)
2. Planning frameworks.
3. Reasoning frameworks.
4. Industry engineering blogs and post-mortems.
5. Auto (Yolo) mode (<https://claude.com/blog/auto-mode>)

Perform codebase analysis of the top 7 open-source coding agents: aider, claude-code, hermes-agent, kilocode, openclaw, opencode, pi.
Source code copies are available in this directory (without git history, see Directory Structure below) - please ground your findings in production code.

## Tasks

1. Identify architectural best practices for building an extensible coding agent from day one.
2. Highlight common architectural "gotchas," anti-patterns, and early-stage mistakes made by existing popular agents.
3. Detail how these 7 popular agents structured their core loops, tool execution environments, and state management.

## Expected Output

Provide a comprehensive architecture recommendations document including:

- High-level architectural patterns to adopt.
- Actionable Rules: A finalized, categorized list of absolute "Do's" and "Don'ts" for early-stage development to guarantee long-term maintainability.

## Appendix: Directory structure

```bash
srg@kub2604:~/Documents/proj/totvibe-agent/reference_clones$ find . -maxdepth 2 -not -path '*/.*' | sed -e "s/[^-][^\/]*\// │/g" -e "s/│\([^ ]\)/ ├── \1/"
.
  ├── claude-code
 │  ├── scripts
 │  ├── Script
 │  ├── examples
 │  ├── CHANGELOG.md
 │  ├── README.md
 │  ├── feed.xml
 │  ├── LICENSE.md
 │  ├── SECURITY.md
 │  ├── plugins
 │  ├── demo.gif
  ├── research-prompt.md
  ├── hermes-agent
 │  ├── constraints-termux.txt
 │  ├── RELEASE_v0.9.0.md
 │  ├── hermes-already-has-routines.md
 │  ├── AGENTS.md
 │  ├── providers
 │  ├── batch_runner.py
 │  ├── RELEASE_v0.10.0.md
 │  ├── tui_gateway
 │  ├── optional-mcps
 │  ├── hermes_state.py
 │  ├── RELEASE_v0.14.0.md
 │  ├── hermes
 │  ├── toolsets.py
 │  ├── model_tools.py
 │  ├── hermes_cli
 │  ├── cli-config.yaml.example
 │  ├── RELEASE_v0.3.0.md
 │  ├── RELEASE_v0.15.1.md
 │  ├── RELEASE_v0.7.0.md
 │  ├── toolset_distributions.py
 │  ├── agent
 │  ├── scripts
 │  ├── ui-tui
 │  ├── RELEASE_v0.12.0.md
 │  ├── docker-compose.yml
 │  ├── infographic
 │  ├── RELEASE_v0.6.0.md
 │  ├── nix
 │  ├── RELEASE_v0.5.0.md
 │  ├── setup-hermes.sh
 │  ├── tools
 │  ├── mcp_serve.py
 │  ├── website
 │  ├── LICENSE
 │  ├── RELEASE_v0.13.0.md
 │  ├── RELEASE_v0.15.0.md
 │  ├── docker-compose.windows.yml
 │  ├── datagen-config-examples
 │  ├── assets
 │  ├── flake.nix
 │  ├── RELEASE_v0.2.0.md
 │  ├── tests
 │  ├── hermes_logging.py
 │  ├── web
 │  ├── utils.py
 │  ├── RELEASE_v0.11.0.md
 │  ├── gateway
 │  ├── acp_adapter
 │  ├── mini_swe_runner.py
 │  ├── README.md
 │  ├── cli.py
 │  ├── locales
 │  ├── package.json
 │  ├── flake.lock
 │  ├── docs
 │  ├── trajectory_compressor.py
 │  ├── hermes_constants.py
 │  ├── hermes_bootstrap.py
 │  ├── packaging
 │  ├── acp_registry
 │  ├── run_agent.py
 │  ├── optional-skills
 │  ├── SECURITY.md
 │  ├── RELEASE_v0.4.0.md
 │  ├── package-lock.json
 │  ├── MANIFEST.in
 │  ├── hermes_time.py
 │  ├── plugins
 │  ├── docker
 │  ├── CONTRIBUTING.md
 │  ├── skills
 │  ├── plans
 │  ├── setup.py
 │  ├── README.zh-CN.md
 │  ├── RELEASE_v0.8.0.md
 │  ├── pyproject.toml
 │  ├── cron
 │  ├── Dockerfile
 │  ├── uv.lock
  ├── aider
 │  ├── benchmark
 │  ├── requirements.txt
 │  ├── aider
 │  ├── scripts
 │  ├── tests
 │  ├── README.md
 │  ├── CNAME
 │  ├── pytest.ini
 │  ├── MANIFEST.in
 │  ├── docker
 │  ├── LICENSE.txt
 │  ├── CONTRIBUTING.md
 │  ├── requirements
 │  ├── HISTORY.md
 │  ├── pyproject.toml
  ├── opencode
 │  ├── cmd
 │  ├── internal
 │  ├── go.mod
 │  ├── main.go
 │  ├── sqlc.yaml
 │  ├── scripts
 │  ├── install
 │  ├── LICENSE
 │  ├── go.sum
 │  ├── README.md
 │  ├── opencode-schema.json
  ├── kilocode
 │  ├── TESTING.md
 │  ├── AGENTS.md
 │  ├── logo.png
 │  ├── kilocode-2.code-workspace
 │  ├── RELEASING.md
 │  ├── packages
 │  ├── nix
 │  ├── install
 │  ├── script
 │  ├── patches
 │  ├── LICENSE
 │  ├── flake.nix
 │  ├── tsconfig.json
 │  ├── AgentManagerApp.tsx
 │  ├── bunfig.toml
 │  ├── github
 │  ├── PRIVACY.md
 │  ├── specs
 │  ├── README.md
 │  ├── package.json
 │  ├── flake.lock
 │  ├── bin
 │  ├── REVIEW.md
 │  ├── turbo.json
 │  ├── CODE_OF_CONDUCT.md
 │  ├── SECURITY.md
 │  ├── bun.lock
 │  ├── CONTRIBUTING.md
  ├── pi
 │  ├── AGENTS.md
 │  ├── pi-test.ps1
 │  ├── packages
 │  ├── scripts
 │  ├── LICENSE
 │  ├── tsconfig.json
 │  ├── biome.json
 │  ├── test.sh
 │  ├── README.md
 │  ├── package.json
 │  ├── pi-test.sh
 │  ├── package-lock.json
 │  ├── pi-test.bat
 │  ├── CONTRIBUTING.md
 │  ├── tsconfig.base.json
  ├── openclaw
 │  ├── AGENTS.md
 │  ├── tsconfig.extensions.projects.json
 │  ├── qa
 │  ├── CLAUDE.md
 │  ├── tsconfig.plugin-sdk.dts.json
 │  ├── tsdown.config.ts
 │  ├── packages
 │  ├── src
 │  ├── deploy
 │  ├── openclaw.mjs
 │  ├── extensions
 │  ├── apps
 │  ├── security
 │  ├── git-hooks
 │  ├── scripts
 │  ├── ui
 │  ├── docker-compose.yml
 │  ├── patches
 │  ├── appcast.xml
 │  ├── tsconfig.core.projects.json
 │  ├── tsconfig.extensions.json
 │  ├── render.yaml
 │  ├── LICENSE
 │  ├── pnpm-lock.yaml
 │  ├── CHANGELOG.md
 │  ├── tsconfig.json
 │  ├── README.md
 │  ├── npm-shrinkwrap.json
 │  ├── package.json
 │  ├── THIRD_PARTY_NOTICES.md
 │  ├── config
 │  ├── docs
 │  ├── tsconfig.projects.json
 │  ├── test
 │  ├── VISION.md
 │  ├── fly.toml
 │  ├── tsconfig.core.json
 │  ├── SECURITY.md
 │  ├── pnpm-workspace.yaml
 │  ├── CONTRIBUTING.md
 │  ├── skills
 │  ├── vitest.config.ts
 │  ├── Dockerfile
```
