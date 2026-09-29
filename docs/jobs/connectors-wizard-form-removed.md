# Connectors — wizard's ad-hoc "New connector" form removed (1 of 2)

## Job

Split commit 1/2 for R4/R6 slice 4: removes the wizard's ad-hoc "New
connector" form (its own auth-type list including the unsupported OAUTH2,
no action editor) so the next commit can wire the shared connector editor
in within the 400-line commit cap. Import from Library and the deployed
connectors list still work in this commit — only the form nobody should
keep using once the shared editor exists is gone.

## Proof

Type-checks clean (`npx tsc --noEmit`, exit 0). Import from Library and the
connectors list are otherwise untouched. Full functional proof (creating and
publishing a connector from the wizard) lands on the next commit.
