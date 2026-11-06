# Modules

Each folder is one domain. Pages in `app/` stay thin and compose these modules.

Dependencies run one way: `agent → investigation → analytics → memory`. Games in
`assessments` never import from `agent`.
